import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CommandFormProps {
    onSuccess: () => void;
}

export function CommandForm({ onSuccess }: CommandFormProps) {
    const [name, setName] = useState("");
    const [commandStr, setCommandStr] = useState("");
    const [scheduleType, setScheduleType] = useState<"manual" | "interval" | "datetime">("interval");
    const [intervalSecs, setIntervalSecs] = useState("60");
    const [datetime, setDatetime] = useState("");

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
            });
            setName("");
            setCommandStr("");
            setIntervalSecs("60");
            setDatetime("");
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
                    <input
                        type="text"
                        required
                        value={commandStr}
                        onChange={(e) => setCommandStr(e.target.value)}
                        placeholder='e.g. echo "hello" > log.txt'
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500 font-mono text-sm"
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
                <div className="pt-2">
                    <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-medium px-6 py-2 rounded-md transition-colors w-full">
                        Save and Schedule
                    </button>
                </div>
            </form>
        </div>
    );
}
