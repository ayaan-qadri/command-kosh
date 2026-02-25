import { Power } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface QuitModalProps {
    onClose: () => void;
    dontAskQuit: boolean;
    setDontAskQuit: (value: boolean) => void;
}

export function QuitModal({ onClose, dontAskQuit, setDontAskQuit }: QuitModalProps) {
    return (
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
                            checked={dontAskQuit}
                            onChange={(e) => setDontAskQuit(e.target.checked)}
                        />
                        <span className="group-hover:text-zinc-100 transition-colors">Don't ask me again</span>
                    </label>
                </div>

                <div className="flex bg-zinc-950/50 p-4 border-t border-zinc-800/80 justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/80 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            if (dontAskQuit) {
                                localStorage.setItem("hideQuitConfirm", "true");
                            }
                            await invoke("quit_app");
                        }}
                        className="px-5 py-2 text-sm font-medium text-white bg-red-500/90 hover:bg-red-500 rounded-lg transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2"
                    >
                        <Power className="w-4 h-4" />
                        Quit
                    </button>
                </div>
            </div>
        </div>
    );
}
