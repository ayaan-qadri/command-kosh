use std::collections::HashMap;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegisteredCommand {
    pub id: String,
    pub name: String,
    pub command_str: String,
    pub interval_secs: u64,
    #[serde(default)]
    pub run_at_secs: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CommandExecutionState {
    pub is_running: bool,
    pub is_active: bool,
    pub logs: Vec<String>,
}

pub struct AppState {
    pub commands: Arc<Mutex<HashMap<String, RegisteredCommand>>>,
    pub execution_states: Arc<Mutex<HashMap<String, CommandExecutionState>>>,
    pub task_handles: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
}
