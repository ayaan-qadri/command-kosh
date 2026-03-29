pub fn ensure_cli_in_path() {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(target_dir) = exe_path.parent() {
            #[cfg(target_os = "windows")]
            add_to_windows_path(target_dir);

            #[cfg(not(target_os = "windows"))]
            add_to_unix_path(target_dir);
        }
    }
}

#[cfg(target_os = "windows")]
fn add_to_windows_path(target_dir: &std::path::Path) {
    use std::os::windows::process::CommandExt;
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(env_key) = hkcu.open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE) {
        if let Ok(current_path) = env_key.get_value::<String, _>("Path") {
            let dir_str = target_dir.to_string_lossy().to_string();

            let paths: Vec<&str> = current_path.split(';').collect();
            let found = paths.iter().any(|p| {
                p.trim_end_matches('\\')
                    .eq_ignore_ascii_case(dir_str.trim_end_matches('\\'))
            });

            if !found {
                let new_path = if current_path.ends_with(';') {
                    format!("{}{}", current_path, dir_str)
                } else if current_path.is_empty() {
                    dir_str.clone()
                } else {
                    format!("{};{}", current_path, dir_str)
                };

                let _ = env_key.set_value("Path", &new_path);

                // Invoke PowerShell to broadcast WM_SETTINGCHANGE, immediately updating Explorer's environment variables
                let _ = std::process::Command::new("powershell")
                    .args([
                        "-NoProfile",
                        "-Command",
                        "[System.Environment]::SetEnvironmentVariable('Path', [System.Environment]::GetEnvironmentVariable('Path', 'User'), 'User')"
                    ])
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .spawn();
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn add_to_unix_path(target_dir: &std::path::Path) {
    use std::fs;
    use std::os::unix::fs::symlink;

    // Inside a macOS .app or Linux AppImage/deb, the current_exe is nested.
    // Let's assume the sidecar `ck` is bundled alongside it.
    let ck_bin = target_dir.join("ck");

    if !ck_bin.exists() {
        return;
    }

    if let Some(home) = dirs::home_dir() {
        let local_bin = home.join(".local").join("bin");

        if fs::create_dir_all(&local_bin).is_ok() {
            let link_path = local_bin.join("ck");

            let needs_link = match fs::read_link(&link_path) {
                Ok(target) => target != ck_bin,
                Err(_) => true,
            };

            if needs_link {
                let _ = fs::remove_file(&link_path);
                let _ = symlink(&ck_bin, &link_path);
            }
        }
    }
}
