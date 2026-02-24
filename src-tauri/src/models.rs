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
    #[serde(default)]
    pub actively_stopped: bool,
    #[serde(default = "default_true")]
    pub auto_start: bool,
    #[serde(default)]
    pub notify_on_failure: bool,
    #[serde(default)]
    pub notify_on_success: bool,
    #[serde(default)]
    pub auto_restart_on_fail: bool,
    #[serde(default)]
    pub auto_restart_retries: u32,
    #[serde(default)]
    pub auto_run_on_complete: bool,
}

pub fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CommandExecutionState {
    pub is_running: bool,
    pub is_active: bool,
    pub logs: Vec<String>,
    pub next_run_at: Option<u64>,
}

pub struct AppState {
    pub commands: Arc<Mutex<HashMap<String, RegisteredCommand>>>,
    pub execution_states: Arc<Mutex<HashMap<String, CommandExecutionState>>>,
    pub task_handles: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
}
