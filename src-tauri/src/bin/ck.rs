use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

// Minimal re-definition of RegisteredCommand (no Tauri dependency needed)
#[derive(Debug, serde::Deserialize, Clone)]
struct RegisteredCommand {
    name: String,
    command_str: String,
}

const APP_IDENTIFIER: &str = "com.ayaan.command-kosh";

// HMAC helpers (uses the exact same verification algorithm as the Tauri app)
type HmacSha256 = Hmac<Sha256>;

fn load_commands() -> Result<HashMap<String, RegisteredCommand>, String> {
    let app_dir = dirs::data_dir()
        .map(|p| p.join(APP_IDENTIFIER))
        .ok_or_else(|| "Could not determine app data directory".to_string())?;

    let cmd_path = app_dir.join("commands.json");
    let sig_path = app_dir.join("commands.json.sig");

    if !cmd_path.exists() {
        return Err(
            "No commands found. Open Command Kosh and add some commands first.".to_string(),
        );
    }

    let raw_bytes =
        fs::read(&cmd_path).map_err(|e| format!("Failed to read commands file: {}", e))?;

    if raw_bytes.is_empty() {
        return Err("Commands file is empty.".to_string());
    }

    let data = String::from_utf8(raw_bytes.clone())
        .map_err(|_| "Commands file contains invalid UTF-8.".to_string())?;

    let commands: HashMap<String, RegisteredCommand> =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse commands: {}", e))?;

    // Verify integrity
    // Securely retrieve HMAC key from OS Keyring (must match Tauri app exactly)
    let hmac_key = (|| -> Option<Vec<u8>> {
        let entry = keyring::Entry::new("command-kosh", "hmac-key").ok()?;
        let hex_key = entry.get_password().ok()?;
        let key = hex::decode(&hex_key).ok()?;
        if key.len() == 32 {
            Some(key)
        } else {
            None
        }
    })();

    if let Some(key) = hmac_key {
        let sig = fs::read_to_string(&sig_path).map_err(|_| {
            "Signature file missing - commands may have been tampered with.".to_string()
        })?;

        let sig = sig.trim();

        let mut mac = HmacSha256::new_from_slice(&key).expect("HMAC key can be any size");
        mac.update(&raw_bytes);
        let is_valid = match hex::decode(sig) {
            Ok(expected_bytes) => mac.verify_slice(&expected_bytes).is_ok(),
            Err(_) => false,
        };

        if sig.is_empty() || !is_valid {
            return Err(
                "Integrity check failed - commands file may have been tampered with.\nOpen Command Kosh to review and resolve."
                    .to_string(),
            );
        }
    } else {
        // If we can't access the keyring, warn but continue
        eprintln!("Warning: Could not access keyring - skipping integrity check.");
    }

    Ok(commands)
}

/// Extract all unique `{{name}}` placeholder names from a command string.
fn extract_placeholders(command_str: &str) -> Vec<String> {
    let mut placeholders = Vec::new();
    let mut rest = command_str;

    while let Some(start) = rest.find("{{") {
        let after_open = &rest[start + 2..];
        if let Some(end) = after_open.find("}}") {
            let name = after_open[..end].trim().to_string();
            if !name.is_empty() && !placeholders.contains(&name) {
                placeholders.push(name);
            }
            rest = &after_open[end + 2..];
        } else {
            break;
        }
    }

    placeholders
}

/// Replace all `{{name}}` occurrences with the provided values.
fn substitute_placeholders(command_str: &str, values: &HashMap<String, String>) -> String {
    let mut result = String::new();
    let mut rest = command_str;

    while let Some(start) = rest.find("{{") {
        result.push_str(&rest[..start]);
        let after_open = &rest[start + 2..];
        if let Some(end) = after_open.find("}}") {
            let name = after_open[..end].trim();
            if let Some(val) = values.get(name) {
                result.push_str(val);
            } else {
                // Leave unresolved placeholders as-is
                result.push_str(&rest[start..start + 2 + end + 2]);
            }
            rest = &after_open[end + 2..];
        } else {
            result.push_str(&rest[start..]);
            rest = "";
            break;
        }
    }
    result.push_str(rest);
    result
}

/// Parse CLI args into (command_name, key=value pairs).
/// Args that contain `=` are treated as template values.
/// The first arg (without `=`) is the command name.
fn parse_args(args: &[String]) -> (String, HashMap<String, String>) {
    let mut command_name_parts: Vec<&str> = Vec::new();
    let mut values: HashMap<String, String> = HashMap::new();

    for arg in args {
        if let Some(eq_pos) = arg.find('=') {
            let key = arg[..eq_pos].to_string();
            let value = arg[eq_pos + 1..].to_string();
            if !key.is_empty() {
                values.insert(key, value);
            }
        } else {
            command_name_parts.push(arg);
        }
    }

    (command_name_parts.join(" "), values)
}

fn execute_command(command_str: &str) -> i32 {
    let mut child = if cfg!(target_os = "windows") {
        #[cfg(target_os = "windows")]
        use std::os::windows::process::CommandExt;

        let mut cmd = Command::new("cmd");
        cmd.arg("/C");

        #[cfg(target_os = "windows")]
        cmd.raw_arg(command_str);

        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::inherit());
        match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to spawn command: {}", e);
                return 1;
            }
        }
    } else {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", command_str]);
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::inherit());
        match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to spawn command: {}", e);
                return 1;
            }
        }
    };

    // Stream stdout and stderr in real-time, concurrently to prevent buffer deadlocks
    let stream_pipe = |pipe: Option<Box<dyn std::io::Read + Send + 'static>>,
                       is_stderr: bool|
     -> Option<std::thread::JoinHandle<()>> {
        pipe.map(|p| {
            std::thread::spawn(move || {
                // Read from either stderr or stdout pipe
                let reader = BufReader::new(p);
                for line in reader.lines().map_while(Result::ok) {
                    if is_stderr {
                        let _ = writeln!(std::io::stderr(), "{}", line);
                    } else {
                        let _ = writeln!(std::io::stdout(), "{}", line);
                    }
                }
            })
        })
    };

    let out_thread = stream_pipe(
        child
            .stdout
            .take()
            .map(|s| Box::new(s) as Box<dyn std::io::Read + Send + 'static>),
        false,
    );
    let err_thread = stream_pipe(
        child
            .stderr
            .take()
            .map(|s| Box::new(s) as Box<dyn std::io::Read + Send + 'static>),
        true,
    );

    if let Some(t) = out_thread {
        let _ = t.join();
    }
    if let Some(t) = err_thread {
        let _ = t.join();
    }

    match child.wait() {
        Ok(status) => status.code().unwrap_or(1),
        Err(e) => {
            eprintln!("Command failed: {}", e);
            1
        }
    }
}

fn print_header() {
    eprintln!("\x1b[36mck\x1b[0m - Command Kosh CLI\n");
}

fn print_usage() {
    print_header();
    eprintln!("Usage:");
    eprintln!("  ck <command_name>                   Run a stored command");
    eprintln!("  ck <command_name> key=value ...      Pass template values");
    eprintln!("  ck list                              List all stored commands");
    eprintln!("  ck --help                            Show this help");
    eprintln!("  ck --version                         Show version");
    eprintln!();
    eprintln!("Template example:");
    eprintln!("  Command:  git reset --soft HEAD~{{{{count}}}} && git commit -m \"{{{{msg}}}}\"");
    eprintln!("  Run:      ck sq_commits count=3 msg=\"squashed\"");
}

fn list_commands(commands: &HashMap<String, RegisteredCommand>) {
    // Sort by name for consistent output
    let mut sorted: Vec<&RegisteredCommand> = commands.values().collect();
    sorted.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    if sorted.is_empty() {
        eprintln!("No commands stored. Open Command Kosh and add some commands first.");
        return;
    }

    eprintln!("\x1b[36mStored commands:\x1b[0m\n");

    let max_name_len = sorted.iter().map(|c| c.name.len()).max().unwrap_or(10);

    for cmd in &sorted {
        let placeholders = extract_placeholders(&cmd.command_str);
        let truncated_cmd = if cmd.command_str.chars().count() > 60 {
            let s: String = cmd.command_str.chars().take(59).collect();
            format!("{}…", s)
        } else {
            cmd.command_str.clone()
        };

        if placeholders.is_empty() {
            eprintln!(
                "  \x1b[32m{:<width$}\x1b[0m  \x1b[90m{}\x1b[0m",
                cmd.name,
                truncated_cmd,
                width = max_name_len + 2
            );
        } else {
            let params = placeholders
                .iter()
                .map(|p| format!("\x1b[33m{}\x1b[0m", p))
                .collect::<Vec<_>>()
                .join(", ");
            eprintln!(
                "  \x1b[32m{:<width$}\x1b[0m  \x1b[90m{}\x1b[0m  [{}]",
                cmd.name,
                truncated_cmd,
                params,
                width = max_name_len + 2
            );
        }
    }
    eprintln!("\n\x1b[90mRun with: ck <command_name> [key=value ...]\x1b[0m");
}

fn find_command<'a>(
    commands: &'a HashMap<String, RegisteredCommand>,
    name: &str,
) -> Option<&'a RegisteredCommand> {
    let name_lower = name.to_lowercase();
    commands
        .values()
        .find(|cmd| cmd.name.to_lowercase() == name_lower)
}

fn run_command_by_name(name: &str, values: &HashMap<String, String>) {
    let commands = match load_commands() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("\x1b[31mError:\x1b[0m {}", e);
            std::process::exit(1);
        }
    };

    match find_command(&commands, name) {
        Some(cmd) => {
            let placeholders = extract_placeholders(&cmd.command_str);

            if !placeholders.is_empty() {
                // Check for missing values
                let missing: Vec<&String> = placeholders
                    .iter()
                    .filter(|p| !values.contains_key(*p))
                    .collect();

                if !missing.is_empty() {
                    eprintln!(
                        "\x1b[31mError:\x1b[0m Command '{}' requires template values that were not provided.\n",
                        cmd.name
                    );
                    eprintln!("Missing:");
                    for m in &missing {
                        eprintln!("  \x1b[33m{}\x1b[0m", m);
                    }
                    eprintln!();
                    eprintln!(
                        "Usage: ck {} {}",
                        cmd.name,
                        placeholders
                            .iter()
                            .map(|p| format!("\x1b[33m{}=<value>\x1b[0m", p))
                            .collect::<Vec<_>>()
                            .join(" ")
                    );
                    eprintln!();
                    eprintln!("\x1b[90mCommand template: {}\x1b[0m", cmd.command_str);
                    std::process::exit(1);
                }
            }

            // Substitute placeholders (if any) and run
            let resolved = substitute_placeholders(&cmd.command_str, values);

            // Safety check: make sure no unresolved placeholders remain
            let remaining = extract_placeholders(&resolved);
            if !remaining.is_empty() {
                eprintln!(
                    "\x1b[31mError:\x1b[0m Unresolved placeholders remain: {}",
                    remaining.join(", ")
                );
                std::process::exit(1);
            }

            eprintln!(
                "\x1b[36mck\x1b[0m \x1b[90m▸\x1b[0m Running \x1b[32m{}\x1b[0m",
                cmd.name
            );

            // Only print the expanded command if it actually changed
            if resolved != cmd.command_str {
                eprintln!(
                    "\x1b[36mck\x1b[0m \x1b[90m▸\x1b[0m \x1b[90m{}\x1b[0m",
                    resolved
                );
            }
            eprintln!(); // Extra newline for readability

            let exit_code = execute_command(&resolved);
            if exit_code != 0 {
                eprintln!(
                    "\n\x1b[31mck\x1b[0m \x1b[90m▸\x1b[0m Command exited with code {}",
                    exit_code
                );
            }
            std::process::exit(exit_code);
        }
        None => {
            eprintln!("\x1b[31mError:\x1b[0m No command named '{}' found.", name);

            // Suggest similar names
            let name_lower = name.to_lowercase();
            let suggestions: Vec<&str> = commands
                .values()
                .filter(|cmd| {
                    let cmd_lower = cmd.name.to_lowercase();
                    cmd_lower.contains(&name_lower) || name_lower.contains(&cmd_lower)
                })
                .map(|cmd| cmd.name.as_str())
                .collect();

            if !suggestions.is_empty() {
                eprintln!("\nDid you mean:");
                for s in suggestions {
                    eprintln!("  \x1b[32m{}\x1b[0m", s);
                }
            }

            eprintln!("\nRun \x1b[36mck list\x1b[0m to see all available commands.");
            std::process::exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        print_usage();
        std::process::exit(0);
    }

    let first = args[0].as_str();

    match first {
        "--help" | "-h" => {
            print_usage();
            std::process::exit(0);
        }
        "--version" | "-v" => {
            eprintln!("ck (Command Kosh) v{}", env!("CARGO_PKG_VERSION"));
            std::process::exit(0);
        }
        "list" | "ls" => {
            let commands = match load_commands() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("\x1b[31mError:\x1b[0m {}", e);
                    std::process::exit(1);
                }
            };
            list_commands(&commands);
            std::process::exit(0);
        }
        _ => {
            // Direct invocation: ck <command_name> [key=value ...]
            let (command_name, values) = parse_args(&args);
            if command_name.is_empty() {
                eprintln!("\x1b[31mError:\x1b[0m Missing command name.");
                print_usage();
                std::process::exit(1);
            }
            run_command_by_name(&command_name, &values);
        }
    }
}
