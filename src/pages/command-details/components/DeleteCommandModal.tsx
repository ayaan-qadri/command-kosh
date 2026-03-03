import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";

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
                <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>

            {/* Modal */}
            {open && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-1">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-base font-semibold text-zinc-100">Delete command?</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                <span className="text-zinc-200 font-medium">{commandName}</span> will be permanently removed and all its scheduled tasks will be cancelled.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={() => setOpen(false)}
                                className="flex-1 py-2.5 rounded-lg text-sm text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onDelete}
                                className="flex-1 py-2.5 rounded-lg text-sm text-red-100 bg-red-500/80 hover:bg-red-500 border border-red-600 transition-colors font-medium shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
