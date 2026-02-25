pub mod models;
pub mod store;
pub mod scheduler;
pub mod commands;

use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};

use models::{AppState, CommandExecutionState, RegisteredCommand};
use store::get_commands_file_path;
use scheduler::spawn_command_task;
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .setup(|app| {
            // --- System Tray Setup ---
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Command Kosh")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        show_window(app);
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.close();
                        }
                    }
                    "quit" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some(state) = app_handle.try_state::<AppState>() {
                                let pids: Vec<u32> = {
                                    let states = state.execution_states.lock().await;
                                    states.values().filter_map(|s| s.child_pid).collect()
                                };
                                for pid in pids {
                                    crate::scheduler::kill_process_tree(pid);
                                }
                                let mut handles = state.task_handles.lock().await;
                                for (_, handle) in handles.drain() {
                                    handle.abort();
                                }
                            }
                            tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                            std::process::exit(0);
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.close();
                            } else {
                                show_window(app);
                            }
                        } else {
                            show_window(app);
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // --- Show window on launch (non-autostart) ---
            // If the app was launched with --hidden (e.g., from autostart), keep it hidden.
            let args: Vec<String> = std::env::args().collect();
            let is_hidden = args.iter().any(|arg| arg == "--hidden");

            if !is_hidden {
                show_window(app.handle());
            } else if let Some(window) = app.get_webview_window("main") {
                // If it is hidden but the builder created the main window (because of tauri.conf.json)
                let _ = window.close();
            }

            // --- Load commands from store ---
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
                if cmd.auto_start && !cmd.actively_stopped {
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
            edit_command,
            quit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                // Prevent app completely exiting when all windows are closed,
                // so it keeps running in the system tray and scheduling tasks.
                api.prevent_exit();
            }
        });
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            app,
            "main",
            tauri::WebviewUrl::App("index.html".into())
        )
        .title("Command Kosh")
        .inner_size(800.0, 600.0)
        .center()
        .build();
    }
}
