use crate::models::{AppState, CommandExecutionState, RegisteredCommand, TamperedCommandInfo};
use crate::scheduler::spawn_command_task;
use crate::store::save_commands;
use std::sync::Arc;
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct CommandArgs {
    pub name: String,
    pub command_str: String,
    pub interval_secs: u64,
    pub run_at_secs: Option<u64>,
    pub auto_start: bool,
    pub notify_on_failure: bool,
    pub notify_on_success: bool,
    pub auto_restart_on_fail: bool,
    pub auto_restart_retries: u32,
    pub auto_run_on_complete: bool,
}

#[tauri::command]
pub async fn register_command(
    args: CommandArgs,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let new_cmd = RegisteredCommand {
        id: id.clone(),
        name: args.name,
        command_str: args.command_str.clone(),
        interval_secs: args.interval_secs,
        run_at_secs: args.run_at_secs,
        actively_stopped: !args.auto_start,
        auto_start: args.auto_start,
        notify_on_failure: args.notify_on_failure,
        notify_on_success: args.notify_on_success,
        auto_restart_on_fail: args.auto_restart_on_fail,
        auto_restart_retries: args.auto_restart_retries,
        auto_run_on_complete: args.auto_run_on_complete,
    };

    {
        let mut cmds = state.commands.lock().await;

        let name_lower = new_cmd.name.to_lowercase();
        let reserved_names = [
            "list",
            "ls",
            "help",
            "--help",
            "-help",
            "-h",
            "version",
            "--version",
            "-version",
            "-v",
        ];
        if reserved_names.contains(&name_lower.as_str()) {
            return Err(format!(
                "'{}' is a reserved CLI keyword. Please choose a different command name.",
                new_cmd.name
            ));
        }

        // Enforce unique command names (case-insensitive)
        for existing in cmds.values() {
            if existing.name.to_lowercase() == name_lower {
                return Err(format!(
                    "A command named '{}' already exists. Command names must be unique.",
                    existing.name
                ));
            }
        }

        cmds.insert(id.clone(), new_cmd.clone());
        let mut states = state.execution_states.lock().await;
        states.insert(id.clone(), CommandExecutionState::default());
        save_commands(&app_handle, &cmds).await;
    }

    let commands_ref = Arc::clone(&state.commands);
    let states_ref = Arc::clone(&state.execution_states);
    let handles_ref = Arc::clone(&state.task_handles);

    if args.auto_start {
        spawn_command_task(
            app_handle,
            id.clone(),
            args.interval_secs,
            commands_ref,
            states_ref,
            handles_ref,
        );
    }

    Ok(id)
}

#[tauri::command]
pub async fn get_commands(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RegisteredCommand>, String> {
    let cmds = state.commands.lock().await;
    Ok(cmds.values().cloned().collect())
}

#[tauri::command]
pub async fn get_command_state(
    id: String,
    state: tauri::State<'_, AppState>,
) -> Result<CommandExecutionState, String> {
    let states = state.execution_states.lock().await;
    if let Some(st) = states.get(&id) {
        Ok(st.clone())
    } else {
        Ok(CommandExecutionState::default())
    }
}

#[tauri::command]
pub async fn get_all_command_states(
    state: tauri::State<'_, AppState>,
) -> Result<std::collections::HashMap<String, CommandExecutionState>, String> {
    let states = state.execution_states.lock().await;
    Ok(states.clone())
}

#[tauri::command]
pub async fn delete_command(
    id: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Isolated scope: abort task handle
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }

    // Lock order: commands → execution_states
    let pid_to_kill;
    {
        let mut cmds = state.commands.lock().await;
        cmds.remove(&id);
        save_commands(&app_handle, &cmds).await;

        let mut states = state.execution_states.lock().await;
        pid_to_kill = states.get(&id).and_then(|st| st.child_pid);
        states.remove(&id);
    }

    if let Some(pid) = pid_to_kill {
        crate::scheduler::kill_process_tree(pid);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_command(
    id: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Isolated scope: abort task handle
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }

    // Lock order: commands → execution_states
    let pid_to_kill;
    {
        let mut cmds = state.commands.lock().await;
        if let Some(cmd) = cmds.get_mut(&id) {
            cmd.actively_stopped = true;
        }
        save_commands(&app_handle, &cmds).await;

        let mut states = state.execution_states.lock().await;
        pid_to_kill = if let Some(st) = states.get_mut(&id) {
            let pid = st.child_pid;
            st.is_running = false;
            st.is_active = false;
            st.next_run_at = None;
            st.child_pid = None;
            pid
        } else {
            None
        };
    }

    if let Some(pid) = pid_to_kill {
        crate::scheduler::kill_process_tree(pid);
    }

    Ok(())
}

#[tauri::command]
pub async fn start_command(
    id: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Isolated scope: abort task handle
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }

    // Lock order: commands
    let cmd = {
        let mut cmds = state.commands.lock().await;
        if let Some(cmd) = cmds.get_mut(&id) {
            cmd.actively_stopped = false;
        }
        save_commands(&app_handle, &cmds).await;

        cmds.get(&id).cloned()
    };

    if let Some(c) = cmd {
        spawn_command_task(
            app_handle,
            id,
            c.interval_secs,
            Arc::clone(&state.commands),
            Arc::clone(&state.execution_states),
            Arc::clone(&state.task_handles),
        );
    }
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct EditCommandArgs {
    pub id: String,
    pub name: String,
    pub command_str: String,
    pub interval_secs: u64,
    pub run_at_secs: Option<u64>,
    pub auto_start: bool,
    pub notify_on_failure: bool,
    pub notify_on_success: bool,
    pub auto_restart_on_fail: bool,
    pub auto_restart_retries: u32,
    pub auto_run_on_complete: bool,
}

#[tauri::command]
pub async fn edit_command(
    args: EditCommandArgs,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Lock order: commands → execution_states
    let pid_to_kill;
    {
        let mut cmds = state.commands.lock().await;

        let name_lower = args.name.to_lowercase();
        let reserved_names = [
            "list",
            "ls",
            "help",
            "--help",
            "-help",
            "-h",
            "version",
            "--version",
            "-version",
            "-v",
        ];
        if reserved_names.contains(&name_lower.as_str()) {
            return Err(format!(
                "'{}' is a reserved CLI keyword. Please choose a different command name.",
                args.name
            ));
        }

        // Enforce unique command names (case-insensitive), excluding the command being edited
        for (existing_id, existing) in cmds.iter() {
            if existing_id != &args.id && existing.name.to_lowercase() == name_lower {
                return Err(format!(
                    "A command named '{}' already exists. Command names must be unique.",
                    existing.name
                ));
            }
        }

        if let Some(cmd) = cmds.get_mut(&args.id) {
            cmd.name = args.name;
            cmd.command_str = args.command_str;
            cmd.interval_secs = args.interval_secs;
            cmd.run_at_secs = args.run_at_secs;
            cmd.auto_start = args.auto_start;
            cmd.actively_stopped = !args.auto_start;
            cmd.notify_on_failure = args.notify_on_failure;
            cmd.notify_on_success = args.notify_on_success;
            cmd.auto_restart_on_fail = args.auto_restart_on_fail;
            cmd.auto_restart_retries = args.auto_restart_retries;
            cmd.auto_run_on_complete = args.auto_run_on_complete;
        }
        save_commands(&app_handle, &cmds).await;

        let states = state.execution_states.lock().await;
        pid_to_kill = states.get(&args.id).and_then(|st| st.child_pid);
    }

    if let Some(pid) = pid_to_kill {
        crate::scheduler::kill_process_tree(pid);
    }

    // Isolated scope: abort task handle
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&args.id) {
            handle.abort();
        }
    }

    if args.auto_start {
        spawn_command_task(
            app_handle,
            args.id,
            args.interval_secs,
            Arc::clone(&state.commands),
            Arc::clone(&state.execution_states),
            Arc::clone(&state.task_handles),
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn quit_app(
    state: tauri::State<'_, AppState>,
    _app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let pids: Vec<u32> = {
        let states = state.execution_states.lock().await;
        states.values().filter_map(|s| s.child_pid).collect()
    };
    for pid in pids {
        crate::scheduler::kill_process_tree(pid);
    }

    {
        let mut handles = state.task_handles.lock().await;
        for (_, handle) in handles.drain() {
            handle.abort();
        }
    }
    // Give some time for children to be killed (kill_on_drop to execute)
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    std::process::exit(0);
}

#[tauri::command]
pub async fn clear_logs(id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut states = state.execution_states.lock().await;
    if let Some(st) = states.get_mut(&id) {
        st.logs.clear();
    }
    Ok(())
}

/// Pull-based query for the current tampering state. The frontend calls this on mount
/// to avoid missing the push event if it fires before listeners are registered.
#[tauri::command]
pub async fn get_tampering_state(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<TamperedCommandInfo>, String> {
    let tampered = state.tampered_commands.lock().await;
    Ok(tampered.clone())
}

/// Resolve tampering by accepting only the commands the user explicitly chose to keep.
/// Commands not in accepted_ids are removed. The file is re-signed and accepted commands
/// are started if they have auto_start enabled.
#[tauri::command]
pub async fn resolve_tampering(
    accepted_ids: Vec<String>,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Isolated scope: collect tampered IDs upfront to avoid nested locking
    let tampered_ids: Vec<String> = {
        let tampered = state.tampered_commands.lock().await;
        if tampered.is_empty() {
            return Err("No tampering to resolve".to_string());
        }
        tampered.iter().map(|t| t.id.clone()).collect()
    };

    // Lock order: commands → execution_states
    let commands_to_start: Vec<(String, u64)>;
    {
        let mut cmds = state.commands.lock().await;
        let mut states = state.execution_states.lock().await;

        // Remove tampered commands that were NOT accepted
        for tid in &tampered_ids {
            if !accepted_ids.contains(tid) {
                cmds.remove(tid);
                states.remove(tid);
            }
        }

        // Re-sign the commands file
        save_commands(&app_handle, &cmds).await;

        // Collect only accepted auto-start commands (not the entire map)
        commands_to_start = cmds
            .iter()
            .filter(|(id, cmd)| {
                accepted_ids.contains(id) && cmd.auto_start && !cmd.actively_stopped
            })
            .map(|(id, cmd)| (id.clone(), cmd.interval_secs))
            .collect();
    }

    // Isolated scope: clear tampered commands (signals tampering is resolved)
    {
        let mut tampered = state.tampered_commands.lock().await;
        tampered.clear();
    }

    // Now spawn tasks for accepted auto-start commands only
    for (id, interval_secs) in commands_to_start {
        spawn_command_task(
            app_handle.clone(),
            id,
            interval_secs,
            Arc::clone(&state.commands),
            Arc::clone(&state.execution_states),
            Arc::clone(&state.task_handles),
        );
    }

    Ok(())
}
