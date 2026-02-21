use std::sync::Arc;
use uuid::Uuid;
use crate::models::{AppState, CommandExecutionState, RegisteredCommand};
use crate::store::save_commands;
use crate::scheduler::spawn_command_task;

#[tauri::command]
pub async fn register_command(
    name: String,
    command_str: String,
    interval_secs: u64,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let new_cmd = RegisteredCommand {
        id: id.clone(),
        name,
        command_str: command_str.clone(),
        interval_secs,
    };

    {
        let mut cmds = state.commands.lock().await;
        cmds.insert(id.clone(), new_cmd.clone());
        let mut states = state.execution_states.lock().await;
        states.insert(id.clone(), CommandExecutionState::default());
        save_commands(&app_handle, &cmds);
    }

    let commands_ref = Arc::clone(&state.commands);
    let states_ref = Arc::clone(&state.execution_states);
    let handles_ref = Arc::clone(&state.task_handles);

    spawn_command_task(app_handle, id.clone(), interval_secs, commands_ref, states_ref, handles_ref);

    Ok(id)
}

#[tauri::command]
pub async fn get_commands(state: tauri::State<'_, AppState>) -> Result<Vec<RegisteredCommand>, String> {
    let cmds = state.commands.lock().await;
    Ok(cmds.values().cloned().collect())
}

#[tauri::command]
pub async fn get_command_state(id: String, state: tauri::State<'_, AppState>) -> Result<CommandExecutionState, String> {
    let states = state.execution_states.lock().await;
    if let Some(st) = states.get(&id) {
        Ok(st.clone())
    } else {
        Ok(CommandExecutionState::default())
    }
}

#[tauri::command]
pub async fn delete_command(id: String, state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }
    {
        let mut cmds = state.commands.lock().await;
        cmds.remove(&id);
        save_commands(&app_handle, &cmds);
    }
    {
        let mut states = state.execution_states.lock().await;
        states.remove(&id);
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_command(id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }
    {
        let mut states = state.execution_states.lock().await;
        if let Some(st) = states.get_mut(&id) {
            st.is_running = false;
            st.is_active = false;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn start_command(id: String, state: tauri::State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }
    let cmd = {
        let cmds = state.commands.lock().await;
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

#[tauri::command]
pub async fn edit_command(
    id: String,
    name: String,
    command_str: String,
    interval_secs: u64,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    {
        let mut cmds = state.commands.lock().await;
        if let Some(cmd) = cmds.get_mut(&id) {
            cmd.name = name;
            cmd.command_str = command_str;
            cmd.interval_secs = interval_secs;
        }
        save_commands(&app_handle, &cmds);
    }
    {
        let mut handles = state.task_handles.lock().await;
        if let Some(handle) = handles.remove(&id) {
            handle.abort();
        }
    }
    spawn_command_task(
        app_handle,
        id,
        interval_secs,
        Arc::clone(&state.commands),
        Arc::clone(&state.execution_states),
        Arc::clone(&state.task_handles),
    );
    Ok(())
}
