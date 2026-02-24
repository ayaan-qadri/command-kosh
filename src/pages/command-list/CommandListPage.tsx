import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { Plus, X, AlertTriangle, Power } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { RegisteredCommand, CommandExecutionState } from "../../types";
import { CommandForm } from "./components/CommandForm";
import { CommandList } from "./components/CommandList";

export function CommandListPage() {
    const [commands, setCommands] = useState<RegisteredCommand[]>([]);
    const [commandStates, setCommandStates] = useState<Record<string, CommandExecutionState>>({});
    const [showForm, setShowForm] = useState(false);
    const [showAutostartBanner, setShowAutostartBanner] = useState(false);
    const [showQuitModal, setShowQuitModal] = useState(false);
    const [dontAskQuit, setDontAskQuit] = useState(false);
    const navigate = useNavigate();

    const fetchStates = async () => {
        try {
            const states = await invoke<Record<string, CommandExecutionState>>("get_all_command_states");
            setCommandStates(states);
        } catch (e) {
            console.error("Failed to fetch states:", e);
        }
    };

    useEffect(() => {
        fetchCommands();
        fetchStates();
        const interval = setInterval(fetchStates, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchCommands = async () => {
        try {
            const fetchedCommands = await invoke<RegisteredCommand[]>("get_commands");
            setCommands(fetchedCommands);

            try {
                if (!import.meta.env.DEV) {
                    const currentlyEnabled = await isEnabled();
                    const shouldEnable = fetchedCommands.some(c => c.auto_start !== false);

                    if (shouldEnable && !currentlyEnabled) {
                        try {
                            await enable();
                            console.log("Auto-start enabled successfully for Command Kosh.");
                        } catch (enableErr: any) {
                            console.error("Failed to auto-enable autostart:", enableErr);
                            if (localStorage.getItem("hideAutostartBanner") !== "true") {
                                setShowAutostartBanner(true);
                            }
                        }
                    } else if (!shouldEnable && currentlyEnabled) {
                        await disable();
                    }
                }
            } catch (err: any) {
                console.error("Failed to check OS autostart status:", err);
            }
        } catch (e) {
            console.error("Failed to fetch commands:", e);
        }
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
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm animate-in slide-in-from-top-4 z-0 relative">
                    <div className="flex items-center gap-3 text-amber-200/90 text-center md:text-left mx-auto md:mx-0">
                        <span className="bg-amber-500/20 p-1.5 rounded-full flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-400" /></span>
                        <div>
                            <p className="font-semibold text-amber-300">Auto-Start is disabled</p>
                            <p className="text-amber-200/70 text-xs">Some commands require the app to start automatically, but this app is not configured to.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center items-center gap-2">
                        <button onClick={() => setShowAutostartBanner(false)} className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
                            Close
                        </button>
                        <button onClick={() => {
                            localStorage.setItem("hideAutostartBanner", "true");
                            setShowAutostartBanner(false);
                        }} className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors whitespace-nowrap">
                            Don't show again
                        </button>
                        <button onClick={async () => {
                            try {
                                await enable();
                                setShowAutostartBanner(false);
                                sendNotification({ title: "Setup Success", body: "Auto-start has been enabled for Command Kosh." });
                            } catch (e: any) {
                                console.error("Failed to enable autostart", e);
                                sendNotification({ title: "Setup Failed", body: "Could not enable auto-start." });
                            }
                        }} className="px-5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-medium rounded transition-all whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                            Enable Auto Start
                        </button>
                    </div>
                </div>
            )}

            {showQuitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                                <span className="bg-red-500/20 p-1.5 rounded-full flex-shrink-0">
                                    <Power className="w-5 h-5 text-red-500" />
                                </span>
                                Quit App?
                            </h2>
                            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                                Are you sure you want to quit? This will <strong className="text-zinc-200 font-medium">terminate all running jobs</strong> immediately.
                            </p>

                            <label className="flex items-center gap-2 mt-5 text-sm text-zinc-300 cursor-pointer w-fit group selection:bg-transparent">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-red-500/50 focus:ring-offset-zinc-900 w-4 h-4 transition-colors cursor-pointer accent-red-500"
                                    checked={dontAskQuit}
                                    onChange={(e) => setDontAskQuit(e.target.checked)}
                                />
                                <span className="group-hover:text-zinc-100 transition-colors">Don't ask me again</span>
                            </label>
                        </div>

                        <div className="flex bg-zinc-950/50 p-4 border-t border-zinc-800/80 justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={() => setShowQuitModal(false)}
                                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/80 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (dontAskQuit) {
                                        localStorage.setItem("hideQuitConfirm", "true");
                                    }
                                    await invoke("quit_app");
                                }}
                                className="px-5 py-2 text-sm font-medium text-white bg-red-500/90 hover:bg-red-500 rounded-lg transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2"
                            >
                                <Power className="w-4 h-4" />
                                Quit
                            </button>
                        </div>
                    </div>
                </div>
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
