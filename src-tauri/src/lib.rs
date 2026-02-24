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
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
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
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // --- Show window on launch (non-autostart) ---
            // If the app was launched with --hidden (e.g., from autostart), keep it hidden.
            let args: Vec<String> = std::env::args().collect();
            let is_hidden = args.iter().any(|arg| arg == "--hidden");

            if let Some(window) = app.get_webview_window("main") {
                if !is_hidden {
                    let _ = window.show();
                    let _ = window.set_focus();
                }

                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
