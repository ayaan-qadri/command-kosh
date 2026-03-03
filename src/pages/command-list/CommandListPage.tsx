import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Plus, X } from "lucide-react";
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
            <header className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md sticky top-0 z-10 w-full">
                {/* Branding */}
                <div className="flex items-center gap-3">

                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent leading-tight">Command Kosh</h1>
                        <p className="text-xs text-zinc-500 leading-tight">Registry & Scheduler</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <QuitModal />

                    {/* New Command */}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150 border ${showForm
                            ? "text-zinc-400 bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200"
                            : "text-teal-400 bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/15 hover:border-teal-500/50"
                            }`}
                    >
                        {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{showForm ? "Cancel" : "New Command"}</span>
                    </button>
                </div>
            </header>

            {showAutostartBanner && (
                <AutostartBanner onClose={() => setShowAutostartBanner(false)} />
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

                    {!showForm && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <h2 className="text-base font-semibold text-zinc-300 uppercase tracking-wider">Registered Commands</h2>
                                {commands.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        {commands.length}
                                    </span>
                                )}
                            </div>
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
                    )}
                </div>
            </main>
        </div>
    );
}
