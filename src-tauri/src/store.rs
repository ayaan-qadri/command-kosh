use crate::integrity;
use crate::models::RegisteredCommand;
use std::collections::HashMap;

pub async fn save_commands(app_handle: &tauri::AppHandle, cmds: &HashMap<String, RegisteredCommand>) {
    let _ = integrity::sign_and_save(app_handle, cmds).await;
}
