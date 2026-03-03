import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Play, Square, Pencil } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { RegisteredCommand, CommandExecutionState } from "../../types";

import { formatTimeRemaining } from "../../utils/time";
import { CommandEditForm } from "./components/CommandEditForm";
import { DeleteCommandModal } from "./components/DeleteCommandModal";
import { CopyableCommand } from "../../custom-components/CopyableCommand";
import { CommandLogs } from "./components/CommandLogs";

function StatusPill({ state }: { state: CommandExecutionState }) {
    if (state.is_running) return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> RUNNING
        </span>
    );
    if (state.is_active) return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDuration: "2.5s" }} /> SCHEDULED
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-zinc-800/60 text-zinc-500 border border-zinc-700/40">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> STOPPED
        </span>
    );
}

export function CommandDetailsPage() {
    const { commandId } = useParams({ strict: false });
    const navigate = useNavigate();

    const [selectedCommand, setSelectedCommand] = useState<RegisteredCommand | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [detailsState, setDetailsState] = useState<CommandExecutionState>({ is_running: false, is_active: false, logs: [] });
    const [now, setNow] = useState(Date.now() / 1000);
    const [isEditing, setIsEditing] = useState(false);

    const fetchCommands = () => {
        invoke<RegisteredCommand[]>("get_commands")
            .then((fetchedCommands) => {
                const cmd = fetchedCommands.find((c) => c.id === commandId);
                if (cmd) setSelectedCommand(cmd);
                else navigate({ to: "/" });
            })
            .catch(() => navigate({ to: "/" }))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        let isMounted = true;
        fetchCommands();

        const fetchState = () => {
            if (!commandId) return;
            invoke<CommandExecutionState>("get_command_state", { id: commandId }).then((state) => {
                if (isMounted) {
                    setDetailsState({
                        ...state,
                        logs: []
                    });
                }
            }).catch(console.error);
        };
        fetchState();

        let unlistens: (() => void)[] = [];
        let isCancelled = false;

        Promise.all([

            listen<string>("command-started", (event) => {
                if (event.payload === commandId) setDetailsState((prev) => ({ ...prev, is_running: true }));
            }),
            listen<string>("command-finished", (event) => {
                if (event.payload === commandId) setDetailsState((prev) => ({ ...prev, is_running: false }));
            }),
        ]).then((newUnlistens) => {
            if (isCancelled) newUnlistens.forEach(u => u());
            else unlistens = newUnlistens;
        }).catch(console.error);

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



    const handleStop = () => {
        invoke("stop_command", { id: commandId })
            .then(() => setDetailsState((prev) => ({ ...prev, is_running: false, is_active: false })))
            .catch(console.error);
    };

    const handleStart = () => {
        invoke("start_command", { id: commandId })
            .then(() => setDetailsState((prev) => ({ ...prev, is_running: true, is_active: true })))
            .catch(console.error);
    };

    const handleDelete = () => {
        invoke("delete_command", { id: commandId })
            .then(() => navigate({ to: "/" }))
            .catch(console.error);
    };

    if (isLoading || !selectedCommand) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="text-zinc-600 text-sm">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            {/* Header */}
            <header className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center gap-3 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-10">
                <button
                    onClick={() => navigate({ to: "/" })}
                    className="flex items-center gap-1.5 text-zinc-100 hover:text-zinc-300 transition-colors bg-zinc-800 hover:bg-zinc-800/50 px-2.5 py-1.5 rounded-md text-sm font-medium shrink-0"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>

                {/* Left accent strip based on state */}
                <div className={`w-0.5 h-7 rounded-full shrink-0 ${detailsState.is_running ? "bg-emerald-500" : detailsState.is_active ? "bg-blue-500" : "bg-zinc-700"}`} />

                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-semibold text-zinc-100 truncate leading-tight">{selectedCommand.name}</h1>
                    <CopyableCommand
                        command={selectedCommand.command_str}
                        className="text-[11px] text-zinc-400 font-mono"
                    />
                </div>

                {/* Next run countdown */}
                {detailsState.next_run_at && !detailsState.is_running && detailsState.is_active && (
                    <div className="text-sm font-mono text-zinc-400 bg-zinc-800/60 px-2.5 py-1.5 rounded-md border border-zinc-700/60 flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {formatTimeRemaining(detailsState.next_run_at - now)}
                    </div>
                )}

                <StatusPill state={detailsState} />

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {!isEditing && <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-800/50 hover:text-zinc-400 border border-zinc-700/50 transition-all"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>}

                    {detailsState.is_active ? (
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/35 transition-all"
                        >
                            <Square className="w-3.5 h-3.5" /> Stop
                        </button>
                    ) : (
                        <button
                            onClick={handleStart}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-emerald-400 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/35 transition-all"
                        >
                            <Play className="w-3.5 h-3.5 fill-emerald-400/80" /> Start
                        </button>
                    )}

                    <DeleteCommandModal
                        commandName={selectedCommand.name}
                        onDelete={handleDelete}
                    />
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 p-5 flex flex-col h-[calc(100vh-57px)] overflow-hidden">
                {isEditing ? (
                    <CommandEditForm
                        command={selectedCommand}
                        onCancel={() => setIsEditing(false)}
                        onSuccess={() => { fetchCommands(); setIsEditing(false); }}
                    />
                ) : (
                    <CommandLogs commandId={commandId as string} />
                )}
            </main>
        </div>
    );
}
