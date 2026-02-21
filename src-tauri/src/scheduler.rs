use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::AsyncBufReadExt;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tauri::Emitter;
use crate::models::{CommandExecutionState, RegisteredCommand};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn spawn_command_task(
    app_handle: tauri::AppHandle,
    cmd_id: String,
    interval_secs: u64,
    commands_ref: Arc<Mutex<HashMap<String, RegisteredCommand>>>,
    states_ref: Arc<Mutex<HashMap<String, CommandExecutionState>>>,
    handles_ref: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
) {
    let handles_clone = Arc::clone(&handles_ref);
    let id_clone = cmd_id.clone();
    let handle = tauri::async_runtime::spawn(async move {
        {
            let mut st = states_ref.lock().await;
            if let Some(s) = st.get_mut(&cmd_id) {
                s.is_active = true;
            }
        }
        let mut first_run = true;
        loop {
            let cmd_to_run = {
                let cmds = commands_ref.lock().await;
                cmds.get(&cmd_id).cloned()
            };

            if let Some(cmd) = cmd_to_run {
                if first_run {
                    first_run = false;
                    if let Some(target) = cmd.run_at_secs {
                        if let Ok(sys_time) = SystemTime::now().duration_since(UNIX_EPOCH) {
                            let now = sys_time.as_secs();
                            if target > now {
                                sleep(Duration::from_secs(target - now)).await;
                            }
                        }
                    }
                }

                println!("Running command: {}", cmd.name);

                {
                    let mut st = states_ref.lock().await;
                    if let Some(s) = st.get_mut(&cmd_id) {
                        s.is_running = true;
                        if s.logs.len() > 1000 {
                            s.logs = s.logs.split_off(s.logs.len() - 1000);
                        }
                    }
                }
                app_handle.emit("command-started", &cmd_id).ok();

                let mut command_builder = if cfg!(target_os = "windows") {
                    let mut builder = tokio::process::Command::new("cmd");
                    builder.args(["/C", &cmd.command_str]);
                    #[cfg(target_os = "windows")]
                    builder.creation_flags(CREATE_NO_WINDOW);
                    builder
                } else {
                    let mut builder = tokio::process::Command::new("sh");
                    builder.args(["-c", &cmd.command_str]);
                    builder
                };

                command_builder.stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null()).kill_on_drop(true);

                if let Ok(mut child) = command_builder.spawn() {
                    if let Some(stdout) = child.stdout.take() {
                        let mut reader = tokio::io::BufReader::new(stdout).lines();
                        let s_ref = Arc::clone(&states_ref);
                        let c_id = cmd_id.clone();
                        let app = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            while let Ok(Some(line)) = reader.next_line().await {
                                {
                                    if let Some(st) = s_ref.lock().await.get_mut(&c_id) {
                                        st.logs.push(line.clone());
                                    }
                                }
                                app.emit("command-output", (&c_id, line)).ok();
                            }
                        });
                    }

                    if let Some(stderr) = child.stderr.take() {
                        let mut reader = tokio::io::BufReader::new(stderr).lines();
                        let s_ref = Arc::clone(&states_ref);
                        let c_id = cmd_id.clone();
                        let app = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            while let Ok(Some(line)) = reader.next_line().await {
                                {
                                    if let Some(st) = s_ref.lock().await.get_mut(&c_id) {
                                        st.logs.push(line.clone());
                                    }
                                }
                                app.emit("command-output", (&c_id, line)).ok();
                            }
                        });
                    }

                    let _ = child.wait().await;
                }

                {
                    if let Some(st) = states_ref.lock().await.get_mut(&cmd_id) {
                        st.is_running = false;
                    }
                }
                app_handle.emit("command-finished", &cmd_id).ok();
            } else {
                break;
            }

            if interval_secs > 0 {
                sleep(Duration::from_secs(interval_secs)).await;
            } else {
                break; // One-time execution
            }
        }
        {
            let mut st = states_ref.lock().await;
            if let Some(s) = st.get_mut(&cmd_id) {
                s.is_active = false;
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        handles_clone.lock().await.insert(id_clone, handle);
    });
}
