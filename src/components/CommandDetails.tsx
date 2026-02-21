import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RegisteredCommand, CommandExecutionState } from "../types";

interface CommandDetailsProps {
    selectedCommand: RegisteredCommand;
    onBack: () => void;
    onCommandUpdated: (cmd: RegisteredCommand) => void;
    fetchCommands: () => void;
}

export function CommandDetails({
    selectedCommand,
    onBack,
    onCommandUpdated,
    fetchCommands,
}: CommandDetailsProps) {
    const [detailsState, setDetailsState] = useState<CommandExecutionState>({
        is_running: false,
        is_active: false,
        logs: [],
    });
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editCommandStr, setEditCommandStr] = useState("");
    const [editIntervalSecs, setEditIntervalSecs] = useState("");

    useEffect(() => {
        let isMounted = true;
        const fetchState = async () => {
            try {
                const state = await invoke<CommandExecutionState>("get_command_state", {
                    id: selectedCommand.id,
                });
                if (isMounted) setDetailsState(state);
            } catch (e) {
                console.error("Failed to fetch command state:", e);
            }
        };
        fetchState();

        let unlistenOutput: (() => void) | undefined;
        let unlistenStarted: (() => void) | undefined;
        let unlistenFinished: (() => void) | undefined;

        const setupListeners = async () => {
            try {
                const unlistens = await Promise.all([
                    listen<[string, string]>("command-output", (event) => {
                        if (event.payload[0] === selectedCommand.id) {
                            setDetailsState((prev) => ({
                                ...prev,
                                logs: [...prev.logs, event.payload[1]].slice(-1000),
                            }));
                        }
                    }),
                    listen<string>("command-started", (event) => {
                        if (event.payload === selectedCommand.id)
                            setDetailsState((prev) => ({ ...prev, is_running: true }));
                    }),
                    listen<string>("command-finished", (event) => {
                        if (event.payload === selectedCommand.id)
                            setDetailsState((prev) => ({ ...prev, is_running: false }));
                    }),
                ]);
                unlistenOutput = unlistens[0];
                unlistenStarted = unlistens[1];
                unlistenFinished = unlistens[2];
            } catch (e) {
                console.error("Failed to setup listeners:", e);
            }
        };
        setupListeners();

        const interval = setInterval(fetchState, 2000);

        return () => {
            isMounted = false;
            clearInterval(interval);
            if (unlistenOutput) unlistenOutput();
            if (unlistenStarted) unlistenStarted();
            if (unlistenFinished) unlistenFinished();
        };
    }, [selectedCommand.id]);

    useEffect(() => {
        if (detailsState.logs.length > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [detailsState.logs]);

    const handleStop = async () => {
        try {
            await invoke("stop_command", { id: selectedCommand.id });
            setDetailsState((prev) => ({ ...prev, is_running: false, is_active: false }));
        } catch (e) {
            console.error("Failed to stop command:", e);
        }
    };

    const handleStart = async () => {
        try {
            await invoke("start_command", { id: selectedCommand.id });
            setDetailsState((prev) => ({ ...prev, is_running: true, is_active: true }));
        } catch (e) {
            console.error("Failed to start command:", e);
        }
    };

    const startEdit = () => {
        setIsEditing(true);
        setEditName(selectedCommand.name);
        setEditCommandStr(selectedCommand.command_str);
        setEditIntervalSecs(selectedCommand.interval_secs.toString());
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const interval = parseInt(editIntervalSecs) || 0;
            await invoke("edit_command", {
                id: selectedCommand.id,
                name: editName,
                commandStr: editCommandStr,
                intervalSecs: interval,
            });
            fetchCommands();
            onCommandUpdated({
                ...selectedCommand,
                name: editName,
                command_str: editCommandStr,
                interval_secs: interval,
            });
            setIsEditing(false);
        } catch (e) {
            console.error("Failed to edit command:", e);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 w-full">
                <div className="flex items-center gap-4 truncate">
                    <button
                        onClick={onBack}
                        className="text-zinc-400 hover:text-white transition bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md text-sm font-medium shrink-0"
                    >
                        ← Back
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
                        onClick={startEdit}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-md text-sm transition font-medium"
                    >
                        Edit
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
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-xl max-w-2xl mx-auto w-full">
                        <h2 className="text-lg font-bold mb-4">Edit Command</h2>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">
                                    Name / Identifier
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">
                                    Command String (OS Executable)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editCommandStr}
                                    onChange={(e) => setEditCommandStr(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500 font-mono text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">
                                    Interval in Seconds (0 to run only once)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={editIntervalSecs}
                                    onChange={(e) => setEditIntervalSecs(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-6 py-2 rounded-md transition-colors flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-medium px-6 py-2 rounded-md transition-colors flex-1"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
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
