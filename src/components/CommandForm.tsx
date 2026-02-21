import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CommandFormProps {
    onSuccess: () => void;
}

export function CommandForm({ onSuccess }: CommandFormProps) {
    const [name, setName] = useState("");
    const [commandStr, setCommandStr] = useState("");
    const [intervalSecs, setIntervalSecs] = useState("60");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await invoke("register_command", {
                name,
                commandStr,
                intervalSecs: parseInt(intervalSecs) || 0,
            });
            setName("");
            setCommandStr("");
            setIntervalSecs("60");
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
                    <label className="block text-sm text-zinc-400 mb-1">Interval in Seconds (0 to run only once)</label>
                    <input
                        type="number"
                        min="0"
                        required
                        value={intervalSecs}
                        onChange={(e) => setIntervalSecs(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500"
                    />
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
