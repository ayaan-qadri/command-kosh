pub mod models;
pub mod store;
pub mod scheduler;
pub mod commands;

use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

use models::{AppState, CommandExecutionState, RegisteredCommand};
use store::get_commands_file_path;
use scheduler::spawn_command_task;
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut commands = HashMap::new();
            let path = get_commands_file_path(app.handle());
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(parsed) = serde_json::from_str::<HashMap<String, RegisteredCommand>>(&data) {
                    commands = parsed;
                }
            }

            let mut states_map = HashMap::new();
            for (id, _) in commands.iter() {
                states_map.insert(id.clone(), CommandExecutionState::default());
            }

            let commands_ref = Arc::new(Mutex::new(commands.clone()));
            let states_ref = Arc::new(Mutex::new(states_map));
            let handles_ref = Arc::new(Mutex::new(HashMap::new()));

            for (id, cmd) in commands.iter() {
                if !cmd.actively_stopped {
                    spawn_command_task(app.handle().clone(), id.clone(), cmd.interval_secs, Arc::clone(&commands_ref), Arc::clone(&states_ref), Arc::clone(&handles_ref));
                }
            }

            let app_state = AppState {
                commands: commands_ref,
                execution_states: states_ref,
                task_handles: handles_ref,
            };
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            register_command,
            get_commands,
            get_command_state,
            get_all_command_states,
            delete_command,
            stop_command,
            start_command,
            edit_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
