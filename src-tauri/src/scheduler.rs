use crate::models::{CommandExecutionState, RegisteredCommand};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tauri_plugin_notification::NotificationExt;
use tokio::io::AsyncBufReadExt;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

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
        let mut fail_retry_count = 0;
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
                                {
                                    let mut st = states_ref.lock().await;
                                    if let Some(s) = st.get_mut(&cmd_id) {
                                        s.next_run_at = Some(target);
                                    }
                                }
                                sleep(Duration::from_secs(target - now)).await;
                            }
                        }
                    }
                }
                {
                    let mut st = states_ref.lock().await;
                    if let Some(s) = st.get_mut(&cmd_id) {
                        s.next_run_at = None;
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
                    builder.arg("/C");
                    #[cfg(target_os = "windows")]
                    builder.raw_arg(&cmd.command_str);
                    #[cfg(target_os = "windows")]
                    builder.creation_flags(CREATE_NO_WINDOW);
                    builder
                } else {
                    let mut builder = tokio::process::Command::new("sh");
                    builder.args(["-c", &cmd.command_str]);
                    builder
                };

                command_builder
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .stdin(Stdio::null())
                    .kill_on_drop(true);

                let mut retry_immediately = false;

                if let Ok(mut child) = command_builder.spawn() {
                    let pid = child.id();
                    {
                        let mut st = states_ref.lock().await;
                        if let Some(s) = st.get_mut(&cmd_id) {
                            s.child_pid = pid;
                        }
                    }

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

                    let status = child.wait().await;
                    match status {
                        Ok(exit_status) => {
                            let success = exit_status.success();
                            if success {
                                fail_retry_count = 0;
                                if cmd.notify_on_success {
                                    let _ = app_handle
                                        .notification()
                                        .builder()
                                        .title("Command Success")
                                        .body(format!(
                                            "Command '{}' executed successfully.",
                                            cmd.name
                                        ))
                                        .show();
                                }
                                if cmd.auto_run_on_complete {
                                    retry_immediately = true;
                                }
                            } else {
                                if cmd.notify_on_failure {
                                    let _ = app_handle
                                        .notification()
                                        .builder()
                                        .title("Command Failed")
                                        .body(format!(
                                            "Command '{}' failed with exit code: {}",
                                            cmd.name, exit_status
                                        ))
                                        .show();
                                }
                                if cmd.auto_restart_on_fail
                                    && fail_retry_count < cmd.auto_restart_retries
                                {
                                    fail_retry_count += 1;
                                    retry_immediately = true;
                                } else if cmd.auto_run_on_complete {
                                    // if it's set to run on complete, it overrides retry limits
                                    fail_retry_count = 0;
                                    retry_immediately = true;
                                }
                            }
                        }
                        Err(e) => {
                            if cmd.notify_on_failure {
                                let _ = app_handle
                                    .notification()
                                    .builder()
                                    .title("Command Error")
                                    .body(format!(
                                        "Command '{}' failed to execute: {}",
                                        cmd.name, e
                                    ))
                                    .show();
                            }
                            if cmd.auto_restart_on_fail
                                && fail_retry_count < cmd.auto_restart_retries
                            {
                                fail_retry_count += 1;
                                retry_immediately = true;
                            } else if cmd.auto_run_on_complete {
                                fail_retry_count = 0;
                                retry_immediately = true;
                            }
                        }
                    }
                }

                {
                    if let Some(st) = states_ref.lock().await.get_mut(&cmd_id) {
                        st.is_running = false;
                        st.child_pid = None;
                    }
                }
                app_handle.emit("command-finished", &cmd_id).ok();

                if retry_immediately {
                    sleep(Duration::from_millis(500)).await;
                    continue;
                }
            } else {
                break;
            }

            if interval_secs > 0 {
                let next_time = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs()
                    + interval_secs;
                {
                    let mut st = states_ref.lock().await;
                    if let Some(s) = st.get_mut(&cmd_id) {
                        s.next_run_at = Some(next_time);
                    }
                }
                sleep(Duration::from_secs(interval_secs)).await;
            } else {
                {
                    let mut st = states_ref.lock().await;
                    if let Some(s) = st.get_mut(&cmd_id) {
                        s.next_run_at = None;
                    }
                }
                break; // One-time execution
            }
        }
        {
            let mut st = states_ref.lock().await;
            if let Some(s) = st.get_mut(&cmd_id) {
                s.is_active = false;
                s.next_run_at = None;
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        handles_clone.lock().await.insert(id_clone, handle);
    });
}

pub fn kill_process_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .spawn();
    }
}
