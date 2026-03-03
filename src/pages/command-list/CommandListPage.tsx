import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Plus, X, Power } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { RegisteredCommand, CommandExecutionState } from "../../types";
import { CommandForm } from "./components/CommandForm";
import { CommandList } from "./components/CommandList";
import { AutostartBanner } from "./components/AutostartBanner";
import { QuitModal } from "./components/QuitModal";

export function CommandListPage() {
    const [commands, setCommands] = useState<RegisteredCommand[]>([]);
    const [commandStates, setCommandStates] = useState<Record<string, CommandExecutionState>>({});
    const [showForm, setShowForm] = useState(false);
    const [showAutostartBanner, setShowAutostartBanner] = useState(false);
    const [showQuitModal, setShowQuitModal] = useState(false);
    const [dontAskQuit, setDontAskQuit] = useState(false);
    const navigate = useNavigate();

    const fetchStates = () => {
        invoke<Record<string, CommandExecutionState>>("get_all_command_states")
            .then(states => setCommandStates(states))
            .catch(e => console.error("Failed to fetch states:", e));
    };

    useEffect(() => {
        fetchCommands();
        fetchStates();
        const interval = setInterval(fetchStates, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchCommands = () => {
        invoke<RegisteredCommand[]>("get_commands")
            .then(async (fetchedCommands) => {
                setCommands(fetchedCommands);

                try {
                    if (!import.meta.env.DEV) {
                        const currentlyEnabled = await isEnabled();
                        const shouldEnable = fetchedCommands.some(c => c.auto_start !== false);

                        if (shouldEnable && !currentlyEnabled) {
                            enable()
                                .then(() => {
                                    console.log("Auto-start enabled successfully for Command Kosh.");
                                })
                                .catch((enableErr: any) => {
                                    console.error("Failed to auto-enable autostart:", enableErr);
                                    if (localStorage.getItem("hideAutostartBanner") !== "true") {
                                        setShowAutostartBanner(true);
                                    }
                                });
                        } else if (!shouldEnable && currentlyEnabled) {
                            await disable();
                        }
                    }
                } catch (err: any) {
                    console.error("Failed to check OS autostart status:", err);
                }
            })
            .catch(e => {
                console.error("Failed to fetch commands:", e);
            });
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 w-full">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Command Kosh</h1>
                    <p className="text-xs text-zinc-400 mt-1">Registry & Scheduler</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="group relative">
                        <button
                            onClick={async () => {
                                if (localStorage.getItem("hideQuitConfirm") === "true") {
                                    await invoke("quit_app");
                                } else {
                                    setShowQuitModal(true);
                                }
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 hover:border-red-400 font-medium px-4 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] text-sm flex items-center gap-2"
                        >
                            <Power className="w-4 h-4" />
                            <span>Quit App</span>
                        </button>

                        {/* Tooltip */}
                        <div className="absolute top-full mt-2 right-0 w-64 bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 p-3 leading-relaxed">
                            <div className="absolute -top-1.5 right-6 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700 transform rotate-45"></div>
                            <strong className="block text-zinc-100 mb-1">Why quit the app?</strong>
                            Closing the window only hides the app to the system tray so your commands can keep running in the background. Use this button to completely terminate the application and absolutely stop all scheduled jobs right now.
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/50 hover:border-teal-400 font-medium px-4 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(26,188,156,0.15)] hover:shadow-[0_0_20px_rgba(26,188,156,0.25)] text-sm flex items-center gap-2"
                    >
                        {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        <span>{showForm ? "Cancel" : "New Command"}</span>
                    </button>
                </div>
            </header>

            {showAutostartBanner && (
                <AutostartBanner onClose={() => setShowAutostartBanner(false)} />
            )}

            {showQuitModal && (
                <QuitModal
                    onClose={() => setShowQuitModal(false)}
                    dontAskQuit={dontAskQuit}
                    setDontAskQuit={setDontAskQuit}
                />
            )}

            <main className="flex-1 p-6 z-0 relative">
                <div className="max-w-4xl mx-auto space-y-6">
                    {showForm && (
                        <CommandForm
                            onSuccess={() => {
                                setShowForm(false);
                                fetchCommands();
                            }}
                        />
                    )}

                    <div className="space-y-4">
                        <h2 className="text-lg font-medium text-zinc-200">Registered Commands</h2>
                        <CommandList
                            commands={commands}
                            states={commandStates}
                            showForm={showForm}
                            onSelect={(cmd) => {
                                navigate({ to: `/command-details/${cmd.id}` });
                            }}
                            onStart={async (id, e) => {
                                e.stopPropagation();
                                await invoke("start_command", { id });
                                fetchStates();
                            }}
                            onStop={async (id, e) => {
                                e.stopPropagation();
                                await invoke("stop_command", { id });
                                fetchStates();
                            }}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
