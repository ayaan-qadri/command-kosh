import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, TerminalSquare } from "lucide-react";

interface CommandFormProps {
    onSuccess: () => void;
}

export function CommandForm({ onSuccess }: CommandFormProps) {
    const [name, setName] = useState("");
    const [commandStr, setCommandStr] = useState("");
    const [scheduleType, setScheduleType] = useState<"manual" | "interval" | "datetime">("interval");
    const [intervalSecs, setIntervalSecs] = useState("60");
    const [datetime, setDatetime] = useState("");
    const [autoStart, setAutoStart] = useState(false);
    const [notifyOnFailure, setNotifyOnFailure] = useState(false);
    const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
    const [autoRestartOnFail, setAutoRestartOnFail] = useState(false);
    const [autoRestartRetries, setAutoRestartRetries] = useState("3");
    const [autoRunOnComplete, setAutoRunOnComplete] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let interval = 0;
            let runAt: number | null = null;
            if (scheduleType === "interval") {
                interval = parseInt(intervalSecs) || 0;
            } else if (scheduleType === "datetime") {
                if (datetime) {
                    runAt = Math.floor(new Date(datetime).getTime() / 1000);
                }
            }

            await invoke("register_command", {
                name,
                commandStr,
                intervalSecs: interval,
                runAtSecs: runAt,
                autoStart,
                notifyOnFailure,
                notifyOnSuccess,
                autoRestartOnFail,
                autoRestartRetries: parseInt(autoRestartRetries) || 0,
                autoRunOnComplete,
            });
            setName("");
            setCommandStr("");
            setIntervalSecs("60");
            setDatetime("");
            setAutoStart(false);
            setNotifyOnFailure(false);
            setNotifyOnSuccess(false);
            setAutoRestartOnFail(false);
            setAutoRestartRetries("3");
            setAutoRunOnComplete(false);
            onSuccess();
        } catch (e) {
            console.error("Failed to register command:", e);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-xl">
            <h2 className="text-lg font-bold mb-4">Register New Command</h2>
            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Name / Identifier</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Daily Backup"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Command String (OS Executable)</label>
                    <textarea
                        required
                        value={commandStr}
                        onChange={(e) => setCommandStr(e.target.value)}
                        placeholder='e.g. echo "hello" > log.txt'
                        rows={3}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500 font-mono text-sm resize-y"
                    />
                </div>
                <div>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Schedule Type</label>
                        <select
                            value={scheduleType}
                            onChange={(e) => setScheduleType(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                        >
                            <option value="manual">Run Once Immediately</option>
                            <option value="interval">Recurring Interval</option>
                            <option value="datetime">Specific Date and Time</option>
                        </select>
                    </div>

                    {scheduleType === "interval" && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Interval in Seconds</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={intervalSecs}
                                onChange={(e) => setIntervalSecs(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    )}

                    {scheduleType === "datetime" && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Target Date and Time</label>
                            <input
                                type="datetime-local"
                                required
                                value={datetime}
                                onChange={(e) => setDatetime(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                            />
                        </div>
                    )}
                </div>
                <div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={autoStart}
                                onChange={(e) => setAutoStart(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-teal-500 checked:border-teal-500 transition-colors cursor-pointer"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Start automatically on application launch</span>
                    </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={notifyOnFailure}
                                onChange={(e) => setNotifyOnFailure(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-red-500 checked:border-red-500 transition-colors cursor-pointer"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Notify on failure</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={notifyOnSuccess}
                                onChange={(e) => setNotifyOnSuccess(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-teal-500 checked:border-teal-500 transition-colors cursor-pointer"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Notify on success</span>
                    </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={autoRestartOnFail}
                                onChange={(e) => setAutoRestartOnFail(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-orange-500 checked:border-orange-500 transition-colors cursor-pointer"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Auto re-run on failed</span>
                    </label>

                    {autoRestartOnFail && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-zinc-400">Retries:</label>
                            <input
                                type="number"
                                min="1"
                                value={autoRestartRetries}
                                onChange={(e) => setAutoRestartRetries(e.target.value)}
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-zinc-100 focus:outline-none focus:border-teal-500 text-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={autoRunOnComplete}
                                onChange={(e) => setAutoRunOnComplete(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 checked:bg-blue-500 checked:border-blue-500 transition-colors cursor-pointer"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]" />
                        </div>
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Auto re-run command when completed or stopped</span>
                    </label>
                </div>

                <div className="pt-2">
                    <button type="submit" className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/50 hover:border-teal-400 font-medium px-6 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(26,188,156,0.15)] hover:shadow-[0_0_20px_rgba(26,188,156,0.25)] w-full flex justify-center items-center gap-2">
                        <TerminalSquare className="w-5 h-5" /> <span>Save and Schedule</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
