import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal, Trash2 } from "lucide-react";
import { CommandExecutionState } from "../../../types";

interface CommandLogsProps {
    commandId: string;
}

export function CommandLogs({ commandId }: CommandLogsProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        let unlisten: (() => void) | null = null;
        let isCancelled = false;

        invoke<CommandExecutionState>("get_command_state", { id: commandId })
            .then((state) => {
                if (isMounted) {
                    setLogs(state.logs.slice(-1000));
                }
            })
            .catch(console.error);

        listen<[string, string]>("command-output", (event) => {
            if (event.payload[0] === commandId) {
                setLogs((prev) => {
                    const newLog = event.payload[1];
                    return [...prev, newLog].slice(-1000);
                });
            }
        }).then((u) => {
            if (isCancelled) u();
            else unlisten = u;
        }).catch(console.error);

        return () => {
            isMounted = false;
            isCancelled = true;
            if (unlisten) unlisten();
        };
    }, [commandId]);

    useEffect(() => {
        if (logs.length > 0) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleClearLogs = () => {
        invoke("clear_logs", { id: commandId })
            .then(() => setLogs([]))
            .catch(console.error);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Log viewer header */}
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Output Log</span>
                    {logs.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/50">
                            {logs.length} lines
                        </span>
                    )}
                </div>
                {logs.length > 0 && (
                    <button
                        onClick={handleClearLogs}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-800/50 border border-zinc-700/40 px-2.5 py-1 rounded-md transition-all"
                    >
                        <Trash2 className="w-3 h-3" /> Clear
                    </button>
                )}
            </div>

            {/* Log body */}
            <div className="flex-1 bg-zinc-950 border border-zinc-800/70 rounded-xl overflow-y-auto overflow-x-hidden p-4 font-mono text-sm min-h-0 relative">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
                        <Terminal className="w-8 h-8 opacity-30" />
                        <span className="text-sm italic">No output yet. Start the command to see logs here.</span>
                    </div>
                ) : (
                    <div className="space-y-0.5 text-zinc-300 whitespace-pre-wrap break-all">
                        {logs.map((log, idx) => (
                            <div key={idx} className="hover:bg-zinc-800/40 px-1 py-0.5 rounded">
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
}
