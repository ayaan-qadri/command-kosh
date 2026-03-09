mod commands;
pub mod integrity;
pub mod models;
mod scheduler;
mod store;

use std::collections::HashMap;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::Mutex;

use commands::*;
use integrity::VerifyResult;
use models::{AppState, ChangeType, CommandExecutionState, TamperedCommandInfo};
use scheduler::spawn_command_task;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
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
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
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
                })
                .build(app)?;

            // --- Integrity verification & command loading ---
            let verify_result =
                tauri::async_runtime::block_on(integrity::verify_and_load(app.handle()));

            let (commands, tampered_list, should_auto_start) = match verify_result {
                VerifyResult::Valid(cmds) => {
                    // Signature valid — safe to auto-start
                    (cmds, Vec::new(), true)
                }
                VerifyResult::Tampered(tampered_cmds) => {
                    // Signature invalid — compute diff against trusted baseline (empty on first detection)
                    // Since this is the tampered state, we have no prior baseline in memory yet,
                    // so all commands in the tampered file are considered suspicious.
                    let tampered_info: Vec<TamperedCommandInfo> = tampered_cmds
                        .values()
                        .map(|cmd| TamperedCommandInfo {
                            id: cmd.id.clone(),
                            name: cmd.name.clone(),
                            command_str: cmd.command_str.clone(),
                            change_type: ChangeType::Added, // All are suspicious since we have no verified baseline
                        })
                        .collect();
                    (tampered_cmds, tampered_info, false)
                }
                VerifyResult::Empty => {
                    // Fresh install or key was regenerated — start clean
                    (HashMap::new(), Vec::new(), true)
                }
            };

            let tampering_detected = !tampered_list.is_empty();

            // Build initial execution states
            let mut states_map = HashMap::new();
            for (id, _) in commands.iter() {
                states_map.insert(id.clone(), CommandExecutionState::default());
            }

            let commands_ref = Arc::new(Mutex::new(commands.clone()));
            let states_ref = Arc::new(Mutex::new(states_map));
            let handles_ref = Arc::new(Mutex::new(HashMap::new()));

            // Only auto-start commands if integrity verification passed
            if should_auto_start {
                for (id, cmd) in commands.iter() {
                    if cmd.auto_start && !cmd.actively_stopped {
                        spawn_command_task(
                            app.handle().clone(),
                            id.clone(),
                            cmd.interval_secs,
                            Arc::clone(&commands_ref),
                            Arc::clone(&states_ref),
                            Arc::clone(&handles_ref),
                        );
                    }
                }
            }

            let app_state = AppState {
                commands: commands_ref,
                execution_states: states_ref,
                task_handles: handles_ref,
                tampered_commands: Arc::new(Mutex::new(tampered_list)),
            };
            app.manage(app_state);

            // --- Show window logic ---
            let args: Vec<String> = std::env::args().collect();
            let is_hidden = args.iter().any(|arg| arg == "--hidden");

            if tampering_detected {
                // Force-open the window on tampering, regardless of --hidden flag
                show_window(app.handle());
                // Emit event after a short delay so the frontend has time to mount listeners
                let app_clone = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    app_clone.emit("tampering-detected", ()).ok();
                });
            } else if !is_hidden {
                show_window(app.handle());
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }

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
            quit_app,
            clear_logs,
            get_tampering_state,
            resolve_tampering
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
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
        let builder = tauri::WebviewWindowBuilder::new(
            app,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Command Kosh")
        .inner_size(800.0, 600.0)
        .center();

        // Set the window icon from the app's default icon
        let builder = match app.default_window_icon() {
            Some(icon) => builder.icon(icon.clone()).unwrap_or_else(|_| {
                // If icon setting fails, create a fresh builder without icon
                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Command Kosh")
                .inner_size(800.0, 600.0)
                .center()
            }),
            None => builder,
        };

        let _ = builder.build();
    }
}
