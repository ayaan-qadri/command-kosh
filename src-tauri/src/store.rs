use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use crate::models::RegisteredCommand;

pub fn get_commands_file_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&path);
    path.push("commands.json");
    path
}

pub fn save_commands(app_handle: &tauri::AppHandle, cmds: &HashMap<String, RegisteredCommand>) {
    let path = get_commands_file_path(app_handle);
    if let Ok(json) = serde_json::to_string_pretty(cmds) {
        let _ = fs::write(path, json);
    }
}
