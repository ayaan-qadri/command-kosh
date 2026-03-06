import { Clock, Play, Square, Zap, ChevronRight, Timer, CalendarClock, Loader2 } from "lucide-react";
import { RegisteredCommand, CommandExecutionState } from "../../../types";
import { CopyableCommand } from "../../../custom-components/CopyableCommand";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useNavigate } from "@tanstack/react-router";

interface CommandListProps {
    setShowAutostartBanner: (value: boolean) => void;
}

function getScheduleLabel(cmd: RegisteredCommand) {
    if (cmd.run_at_secs) {
        return {
            icon: <CalendarClock className="w-3 h-3" />,
            label: `Runs at ${new Date(cmd.run_at_secs * 1000).toLocaleString()} `,
        };
    }
    if (cmd.interval_secs > 0) {
        const secs = cmd.interval_secs;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const parts: string[] = [];
        if (h > 0) parts.push(`${h} h`);
        if (m > 0) parts.push(`${m} m`);
        if (s > 0) parts.push(`${s} s`);
        return {
            icon: <Timer className="w-3 h-3" />,
            label: `Every ${parts.join(" ")} `,
        };
    }
    return {
        icon: <Clock className="w-3 h-3" />,
        label: "Manual / One-time",
    };
}

function StatusBadge({ state }: { state: CommandExecutionState | undefined }) {
    if (state?.is_running) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RUNNING
            </span>
        );
    }
    if (state?.is_active) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-blue-500/10 text-blue-400/80 border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDuration: "2.5s" }} />
                SCHEDULED
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-zinc-800/60 text-zinc-500 border border-zinc-700/40">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            STOPPED
        </span>
    );
}

export function CommandList({ setShowAutostartBanner }: CommandListProps) {
    const [commandStates, setCommandStates] = useState<Record<string, CommandExecutionState>>({});
    const [commands, setCommands] = useState<RegisteredCommand[]>([]);
    const [isLoading, setLoading] = useState(true);
    const navigate = useNavigate();

    const syncAutostartState = async (fetchedCommands: RegisteredCommand[]) => {
        if (import.meta.env.DEV) return;

        try {
            const currentlyEnabled = await isEnabled();
            const shouldEnable = fetchedCommands.some(c => c.auto_start === true);

            if (shouldEnable && !currentlyEnabled) {
                await enable();
                console.log("Auto-start enabled successfully for Command Kosh.");
            } else if (!shouldEnable && currentlyEnabled) {
                await disable();
            }
        } catch (e: any) {
            console.error("Failed to sync OS autostart:", e);
            if (localStorage.getItem("hideAutostartBanner") !== "true") {
                setShowAutostartBanner(true);
            }
        }
    };

    const syncCommands = async () => {
        try {
            setLoading(true);
            const fetchedCommands = await invoke<RegisteredCommand[]>("get_commands");
            const states = await invoke<Record<string, CommandExecutionState>>("get_all_command_states")
            setCommandStates(states);
            setCommands(fetchedCommands);
            syncAutostartState(fetchedCommands);
        } catch (e: any) {
            console.error("Failed to fetch commands:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        let isCancelled = false;
        let unlistens: (() => void)[] = [];

        syncCommands();

        Promise.all([
            listen<string>("command-started", (event) => {
                if (isMounted) {
                    setCommandStates(prev => ({
                        ...prev,
                        [event.payload]: { ...prev[event.payload], is_running: true, is_active: true }
                    }));
                }
            }),
            listen<string>("command-finished", (event) => {
                if (isMounted) {
                    setCommandStates(prev => ({
                        ...prev,
                        [event.payload]: { ...prev[event.payload], is_running: false }
                    }));
                }
            })
        ]).then((newUnlistens) => {
            if (isCancelled) newUnlistens.forEach(u => u());
            else unlistens = newUnlistens;
        }).catch(console.error);

        return () => {
            isMounted = false;
            isCancelled = true;
            unlistens.forEach(u => u());
        };
    }, []);

    if (commands.length === 0 || isLoading) {
        return (
            <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/20 p-16 text-center flex flex-col items-center gap-4">
                {isLoading ? <>
                    <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/15">
                        <Loader2 className="w-6 h-6 text-teal-400/80 animate-spin" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-300 mb-1">Loading commands...</p>
                        <p className="text-xs text-zinc-500">Please wait while we fetch your commands.</p>
                    </div>
                </> : <><div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/15">
                    <Zap className="w-6 h-6 text-teal-400/80" />
                </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-300 mb-1">No commands yet</p>
                        <p className="text-xs text-zinc-500">Create your first command to start scheduling background tasks.</p>
                    </div></>}
            </div>
        );
    }

    const handleStop = async (cmd: RegisteredCommand, e: React.MouseEvent) => {
        e.stopPropagation();
        const id = cmd.id;
        try {
            await invoke("stop_command", { id });
            setCommandStates(prev => ({
                ...prev,
                [id]: { ...prev[id], is_running: false, is_active: false }
            }));
        } catch (e) {
            console.error("Failed to stop command:", e);
        }
    };

    const handleStart = async (cmd: RegisteredCommand, e: React.MouseEvent) => {
        e.stopPropagation();
        const id = cmd.id;
        try {
            await invoke("start_command", { id });
            setCommandStates(prev => ({
                ...prev,
                [id]: { ...prev[id], is_active: true }
            }));
        } catch (e) {
            console.error("Failed to start command:", e);
        }
    };

    return (
        <>
            <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-zinc-300 uppercase tracking-wider">Registered Commands</h2>
                {commands.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {commands.length}
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-4">
                {commands.map((cmd) => {
                    const state = commandStates[cmd.id];
                    const isActive = state?.is_active;
                    const isRunning = state?.is_running;
                    const schedule = getScheduleLabel(cmd);

                    return (
                        <div key={cmd.id} onClick={() => navigate({ to: `/command-details/${cmd.id}` })}>
                            <div
                                className="group relative bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-zinc-700/80 hover:bg-zinc-900/70 hover:shadow-[0_2px_20px_rgba(0,0,0,0.3)]"
                            >
                                {/* Thin top accent line */}
                                {isRunning && (
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
                                )}
                                {isActive && !isRunning && (
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                                )}

                                <div className="flex items-stretch">
                                    {/* Main content */}
                                    <div className="flex-1 min-w-0 px-5 py-4">
                                        {/* Name row — title only */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="font-semibold text-[17px] text-zinc-100 truncate leading-tight">
                                                {cmd.name}
                                            </h3>
                                        </div>

                                        {/* Command string — inline fit */}
                                        <div className="mb-2.5">
                                            <CopyableCommand
                                                command={cmd.command_str}
                                                className="text-[13px] text-teal-300/80 bg-zinc-800/70 border border-zinc-700/40 px-2.5 py-1 rounded-md font-mono"
                                            />
                                        </div>

                                        {/* Schedule row */}
                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                            <span className="text-zinc-600 flex items-center">{schedule.icon}</span>
                                            <span>{schedule.label}</span>
                                        </div>
                                    </div>

                                    {/* Right: badge + action + chevron */}
                                    <div
                                        className="flex items-center gap-2.5 px-4 shrink-0"
                                    >
                                        <StatusBadge state={state} />
                                        {isActive ? (
                                            <button
                                                onClick={(e) => handleStop(cmd, e)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/90 bg-red-500/8 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/35 hover:text-red-400 transition-all duration-150"
                                            >
                                                <Square className="w-3 h-3" />
                                                Stop
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => handleStart(cmd, e)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400/90 bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/35 hover:text-emerald-400 transition-all duration-150"
                                            >
                                                <Play className="w-3 h-3 fill-emerald-400/80" />
                                                Start
                                            </button>
                                        )}
                                        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors duration-150 shrink-0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>

    );
}
