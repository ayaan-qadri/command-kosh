import { useState } from "react";
import { Power } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function QuitModal() {
    const [open, setOpen] = useState(false);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    const handleTrigger = async () => {
        if (localStorage.getItem("hideQuitConfirm") === "true") {
            await invoke("quit_app");
        } else {
            setOpen(true);
        }
    };

    const handleQuit = async () => {
        if (dontAskAgain) {
            localStorage.setItem("hideQuitConfirm", "true");
        }
        await invoke("quit_app");
    };

    return (
        <>
            {/* Trigger button */}
            <div className="group relative">
                <button
                    onClick={handleTrigger}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-red-400 bg-zinc-800/50 hover:bg-red-500/10 border border-zinc-700/50 hover:border-red-500/30 transition-all"
                    title="Quit App"
                >
                    <Power className="w-3.5 h-3.5" />
                </button>

                {/* Tooltip */}
                <div className="absolute top-full mt-2 right-0 w-64 bg-zinc-900 border border-zinc-700/80 text-zinc-300 text-xs rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 p-3 leading-relaxed">
                    <div className="absolute -top-1.5 right-3 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700/80 transform rotate-45" />
                    <strong className="block text-zinc-100 mb-1 text-xs">Why quit the app?</strong>
                    Closing the window only hides it to the system tray so commands keep running. Use this to fully terminate the app and stop all scheduled jobs.
                </div>
            </div>

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                                <span className="bg-red-500/20 p-1.5 rounded-full flex-shrink-0">
                                    <Power className="w-5 h-5 text-red-500" />
                                </span>
                                Quit App?
                            </h2>
                            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                                Are you sure you want to quit? This will <strong className="text-zinc-200 font-medium">terminate all running jobs</strong> immediately.
                            </p>

                            <label className="flex items-center gap-2 mt-5 text-sm text-zinc-300 cursor-pointer w-fit group selection:bg-transparent">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-red-500/50 focus:ring-offset-zinc-900 w-4 h-4 transition-colors cursor-pointer accent-red-500"
                                    checked={dontAskAgain}
                                    onChange={(e) => setDontAskAgain(e.target.checked)}
                                />
                                <span className="group-hover:text-zinc-100 transition-colors">Don't ask me again</span>
                            </label>
                        </div>

                        <div className="flex bg-zinc-950/50 p-4 border-t border-zinc-800/80 justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/80 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQuit}
                                className="px-5 py-2 text-sm font-medium text-white bg-red-500/90 hover:bg-red-500 rounded-lg transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2"
                            >
                                <Power className="w-4 h-4" />
                                Quit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
