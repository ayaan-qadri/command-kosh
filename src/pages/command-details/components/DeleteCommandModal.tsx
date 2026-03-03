import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface DeleteCommandModalProps {
    commandName: string;
    onDelete: () => void;
}

export function DeleteCommandModal({ commandName, onDelete }: DeleteCommandModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-500/80 bg-red-500/5 hover:bg-red-500/12 border border-red-500/20 hover:border-red-500/40 transition-all"
            >
                <AlertTriangle className="w-3.5 h-3.5" /> Delete
            </button>

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-100">Delete command?</h3>
                            <p className="text-sm text-zinc-500">
                                <span className="text-zinc-300 font-medium">{commandName}</span> will be permanently removed and all its scheduled tasks will be cancelled.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setOpen(false)}
                                className="flex-1 py-2 rounded-lg text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onDelete}
                                className="flex-1 py-2 rounded-lg text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors font-medium"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
