import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { RegisteredCommand, CommandExecutionState } from "../../types";

import { formatTimeRemaining } from "../../utils/time";
import { CommandEditForm } from "./components/CommandEditForm";

export function CommandDetailsPage() {
    // Get command id from route params using the Route's context later
    // but the Route is defined elsewhere, so we can use useParams
    const { commandId } = useParams({ strict: false });
    const navigate = useNavigate();

    const [selectedCommand, setSelectedCommand] = useState<RegisteredCommand | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [detailsState, setDetailsState] = useState<CommandExecutionState>({
        is_running: false,
        is_active: false,
        logs: [],
    });
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState(Date.now() / 1000);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);

    const fetchCommands = () => {
        invoke<RegisteredCommand[]>("get_commands")
            .then((fetchedCommands) => {
                const cmd = fetchedCommands.find((c) => c.id === commandId);
                if (cmd) {
                    setSelectedCommand(cmd);
                } else {
                    navigate({ to: '/' });
                }
            })
            .catch((e) => {
                console.error("Failed to fetch commands:", e);
                navigate({ to: '/' });
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    useEffect(() => {
        let isMounted = true;

        fetchCommands();

        const fetchState = () => {
            if (!commandId) return;
            invoke<CommandExecutionState>("get_command_state", {
                id: commandId,
            }).then((state) => {
                // Only update polling state if logs length changed significantly or state changed 
                // to avoid conflicting with the event listener which is more real-time
                if (isMounted) {
                    setDetailsState(prev => {
                        // If we have newer logs from event listener, don't overwrite with old polling data
                        if (prev.logs.length > state.logs.length) {
                            return { ...state, logs: prev.logs };
                        }
                        return state;
                    });
                }
            }).catch((e) => {
                console.error("Failed to fetch command state:", e);
            });
        };
        fetchState();

        let unlistens: (() => void)[] = [];
        let isCancelled = false;

        const setupListeners = () => {
            Promise.all([
                listen<[string, string]>("command-output", (event) => {
                    if (event.payload[0] === commandId) {
                        setDetailsState((prev) => {
                            const newLog = event.payload[1];
                            if (prev.logs.length > 0 && prev.logs[prev.logs.length - 1] === newLog) {
                                return prev;
                            }
                            return {
                                ...prev,
                                logs: [...prev.logs, newLog].slice(-1000),
                            };
                        });
                    }
                }),
                listen<string>("command-started", (event) => {
                    if (event.payload === commandId)
                        setDetailsState((prev) => ({ ...prev, is_running: true }));
                }),
                listen<string>("command-finished", (event) => {
                    if (event.payload === commandId)
                        setDetailsState((prev) => ({ ...prev, is_running: false }));
                }),
            ]).then((newUnlistens) => {
                if (isCancelled) {
                    newUnlistens.forEach(u => u());
                } else {
                    unlistens = newUnlistens;
                }
            }).catch((e) => {
                console.error("Failed to setup listeners:", e);
            });
        };
        setupListeners();

        const interval = setInterval(fetchState, 2000);
        const secInterval = setInterval(() => setNow(Date.now() / 1000), 1000);

        return () => {
            isMounted = false;
            isCancelled = true;
            clearInterval(interval);
            clearInterval(secInterval);
            unlistens.forEach(u => u());
        };
    }, [commandId]);

    useEffect(() => {
        if (detailsState.logs.length > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [detailsState.logs]);

    const handleClearLogs = () => {
        invoke("clear_logs", { id: commandId })
            .then(() => setDetailsState((prev) => ({ ...prev, logs: [] })))
            .catch((e) => console.error("Failed to clear logs:", e));
    };

    const handleStop = () => {
        invoke("stop_command", { id: commandId })
            .then(() => setDetailsState((prev) => ({ ...prev, is_running: false, is_active: false })))
            .catch((e) => console.error("Failed to stop command:", e));
    };

    const handleStart = () => {
        invoke("start_command", { id: commandId })
            .then(() => setDetailsState((prev) => ({ ...prev, is_running: true, is_active: true })))
            .catch((e) => console.error("Failed to start command:", e));
    };

    const handleDelete = () => {
        invoke("delete_command", { id: commandId })
            .then(() => navigate({ to: "/" }))
            .catch((e) => console.error("Failed to delete command:", e));
    };

    const startEdit = () => {
        if (!selectedCommand) return;
        setIsEditing(true);
    };

    if (isLoading || !selectedCommand) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-zinc-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 w-full">
                <div className="flex items-center gap-4 truncate">
                    <button
                        onClick={() => navigate({ to: "/" })}
                        className="text-zinc-400 hover:text-white transition bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md text-sm font-medium shrink-0 flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="truncate">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent truncate">
                            {selectedCommand.name}
                        </h1>
                        <p className="text-xs text-zinc-400 mt-1 font-mono truncate">
                            {selectedCommand.command_str}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                    {detailsState.next_run_at && !detailsState.is_running && detailsState.is_active && (
                        <div className="text-sm font-mono text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Next run in: {formatTimeRemaining(detailsState.next_run_at - now)}
                        </div>
                    )}
                    <div
                        className={`px-2 py-1 rounded text-xs font-bold ${detailsState.is_running
                            ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : detailsState.is_active
                                ? "bg-blue-500/20 text-blue-400 font-bold"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                    >
                        {detailsState.is_running
                            ? "RUNNING"
                            : detailsState.is_active
                                ? "SCHEDULED"
                                : "STOPPED"}
                    </div>

                    <button
                        onClick={handleClearLogs}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-md text-sm transition font-medium flex items-center gap-1.5"
                        title="Clear logs"
                    >
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                    <button
                        onClick={startEdit}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-md text-sm transition font-medium"
                    >
                        Edit
                    </button>
                    <button
                        onClick={handleDelete}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 px-3 py-1.5 rounded-md text-sm transition font-medium"
                    >
                        Delete
                    </button>
                    <button
                        onClick={handleStart}
                        disabled={detailsState.is_active}
                        className={`px-3 py-1.5 rounded-md text-sm transition font-medium ${detailsState.is_active
                            ? "bg-emerald-500/5 text-emerald-400/30 border border-emerald-500/20 cursor-not-allowed"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-pointer"
                            }`}
                    >
                        Start
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={!detailsState.is_active}
                        className={`px-3 py-1.5 rounded-md text-sm transition font-medium ${!detailsState.is_active
                            ? "bg-red-500/5 text-red-400/30 border border-red-500/20 cursor-not-allowed"
                            : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 cursor-pointer"
                            }`}
                    >
                        Stop
                    </button>
                </div>
            </header>
            <main className="flex-1 p-6 flex flex-col h-[calc(100vh-80px)] overflow-hidden">
                {isEditing ? (
                    <CommandEditForm
                        command={selectedCommand}
                        onCancel={() => setIsEditing(false)}
                        onSuccess={() => {
                            fetchCommands();
                            setIsEditing(false);
                        }}
                    />
                ) : (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg flex-1 overflow-y-auto p-4 font-mono text-sm shadow-inner relative">
                        {detailsState.logs.length === 0 ? (
                            <div className="text-zinc-500 flex h-full items-center justify-center italic">
                                No output received yet.
                            </div>
                        ) : (
                            <div className="space-y-1 text-zinc-300 whitespace-pre-wrap">
                                {detailsState.logs.map((log, idx) => (
                                    <div key={idx} className="hover:bg-zinc-800/50 px-1 rounded">
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
