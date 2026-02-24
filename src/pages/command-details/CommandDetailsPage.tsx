import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, TerminalSquare, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { RegisteredCommand, CommandExecutionState } from "../../types";

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

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editCommandStr, setEditCommandStr] = useState("");
    const [editScheduleType, setEditScheduleType] = useState<"manual" | "interval" | "datetime">("interval");
    const [editIntervalSecs, setEditIntervalSecs] = useState("");
    const [editDatetime, setEditDatetime] = useState("");
    const [editAutoStart, setEditAutoStart] = useState(true);

    const fetchCommands = async () => {
        try {
            const fetchedCommands = await invoke<RegisteredCommand[]>("get_commands");
            const cmd = fetchedCommands.find((c) => c.id === commandId);
            if (cmd) {
                setSelectedCommand(cmd);
            } else {
                navigate({ to: '/' });
            }
        } catch (e) {
            console.error("Failed to fetch commands:", e);
            navigate({ to: '/' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        fetchCommands();

        const fetchState = async () => {
            if (!commandId) return;
            try {
                const state = await invoke<CommandExecutionState>("get_command_state", {
                    id: commandId,
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
                        if (event.payload[0] === commandId) {
                            setDetailsState((prev) => ({
                                ...prev,
                                logs: [...prev.logs, event.payload[1]].slice(-1000),
                            }));
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
    }, [commandId]);

    useEffect(() => {
        if (detailsState.logs.length > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [detailsState.logs]);

    const handleStop = async () => {
        try {
            await invoke("stop_command", { id: commandId });
            setDetailsState((prev) => ({ ...prev, is_running: false, is_active: false }));
        } catch (e) {
            console.error("Failed to stop command:", e);
        }
    };

    const handleStart = async () => {
        try {
            await invoke("start_command", { id: commandId });
            setDetailsState((prev) => ({ ...prev, is_running: true, is_active: true }));
        } catch (e) {
            console.error("Failed to start command:", e);
        }
    };

    const handleDelete = async () => {
        try {
            await invoke("delete_command", { id: commandId });
            navigate({ to: "/" });
        } catch (e) {
            console.error("Failed to delete command:", e);
        }
    };

    const startEdit = () => {
        if (!selectedCommand) return;
        setIsEditing(true);
        setEditName(selectedCommand.name);
        setEditCommandStr(selectedCommand.command_str);
        setEditAutoStart(selectedCommand.auto_start ?? false);

        if (selectedCommand.run_at_secs) {
            setEditScheduleType("datetime");
            const dt = new Date(selectedCommand.run_at_secs * 1000);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            setEditDatetime(dt.toISOString().slice(0, 16));
            setEditIntervalSecs("60");
        } else if (selectedCommand.interval_secs > 0) {
            setEditScheduleType("interval");
            setEditIntervalSecs(selectedCommand.interval_secs.toString());
            setEditDatetime("");
        } else {
            setEditScheduleType("manual");
            setEditIntervalSecs("60");
            setEditDatetime("");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let interval = 0;
            let runAt: number | null = null;
            if (editScheduleType === "interval") {
                interval = parseInt(editIntervalSecs) || 0;
            } else if (editScheduleType === "datetime") {
                if (editDatetime) {
                    runAt = Math.floor(new Date(editDatetime).getTime() / 1000);
                }
            }

            await invoke("edit_command", {
                id: commandId,
                name: editName,
                commandStr: editCommandStr,
                intervalSecs: interval,
                runAtSecs: runAt,
                autoStart: editAutoStart,
            });
            await fetchCommands();
            setIsEditing(false);
        } catch (e) {
            console.error("Failed to edit command:", e);
        }
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
                                <div>
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">Schedule Type</label>
                                        <select
                                            value={editScheduleType}
                                            onChange={(e) => setEditScheduleType(e.target.value as any)}
                                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500 mb-4"
                                        >
                                            <option value="manual">Run Once Immediately</option>
                                            <option value="interval">Recurring Interval</option>
                                            <option value="datetime">Specific Date and Time</option>
                                        </select>
                                    </div>

                                    {editScheduleType === "interval" && (
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-1">Interval in Seconds</label>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                value={editIntervalSecs}
                                                onChange={(e) => setEditIntervalSecs(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                                            />
                                        </div>
                                    )}

                                    {editScheduleType === "datetime" && (
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-1">Target Date and Time</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                value={editDatetime}
                                                onChange={(e) => setEditDatetime(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={editAutoStart}
                                            onChange={(e) => setEditAutoStart(e.target.checked)}
                                            className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-teal-500 checked:border-teal-500 transition-colors cursor-pointer"
                                        />
                                        <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                                    </div>
                                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Start automatically on application launch</span>
                                </label>
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
                                    className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/50 hover:border-teal-400 font-medium px-6 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(26,188,156,0.15)] hover:shadow-[0_0_20px_rgba(26,188,156,0.25)] flex-1 flex justify-center items-center gap-2"
                                >
                                    <TerminalSquare className="w-5 h-5" /> <span>Save Changes</span>
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
