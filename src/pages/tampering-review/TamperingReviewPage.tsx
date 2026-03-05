import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Loader2 } from "lucide-react";
import { TamperedCommandInfo } from "../../types";

import { TamperedHeader } from "./components/TamperedHeader";
import { TamperedCommandCard } from "./components/TamperedCommandCard";

export function TamperingReviewPage() {
    const [tamperedCommands, setTamperedCommands] = useState<TamperedCommandInfo[]>([]);
    const [decisions, setDecisions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            try {
                const state = await invoke<TamperedCommandInfo[]>("get_tampering_state");
                if (state.length === 0) {
                    navigate({ to: "/" });
                    return;
                }
                setTamperedCommands(state);
                const initial: Record<string, boolean> = {};
                state.forEach((cmd) => {
                    initial[cmd.id] = true;
                });
                setDecisions(initial);
            } catch (err) {
                console.error("Failed to fetch tampering state:", err);
                navigate({ to: "/" });
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    const toggleDecision = (id: string) => {
        setDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const acceptAll = () => {
        const updated: Record<string, boolean> = {};
        tamperedCommands.forEach((cmd) => {
            updated[cmd.id] = true;
        });
        setDecisions(updated);
    };

    const rejectAll = () => {
        const updated: Record<string, boolean> = {};
        tamperedCommands.forEach((cmd) => {
            updated[cmd.id] = false;
        });
        setDecisions(updated);
    };

    const handleConfirm = async () => {
        setResolving(true);
        try {
            const acceptedIds = Object.entries(decisions)
                .filter(([, accepted]) => accepted)
                .map(([id]) => id);

            await invoke("resolve_tampering", { acceptedIds });
            navigate({ to: "/" });
        } catch (err) {
            console.error("Failed to resolve tampering:", err);
        } finally {
            setResolving(false);
            setShowConfirmModal(false);
        }
    };

    const acceptedCount = Object.values(decisions).filter(Boolean).length;
    const rejectedCount = tamperedCommands.length - acceptedCount;

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/15">
                    <Loader2 className="w-6 h-6 text-red-400/80 animate-spin" />
                </div>
                <div>
                    <p className="text-sm font-medium text-zinc-300 mb-1 text-center">Verifying integrity...</p>
                    <p className="text-xs text-zinc-500 text-center">Checking HMAC signature</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            {/* Header - matches CommandListPage header */}
            <header className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md sticky top-0 z-10 w-full">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent leading-tight">
                            Security Review
                        </h1>
                        <p className="text-xs text-zinc-500 leading-tight">Tampering Detected</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={rejectAll}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 border text-zinc-400 bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-300"
                    >
                        Uncheck All
                    </button>
                    <button
                        onClick={acceptAll}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 border text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50"
                    >
                        Check All
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 z-0 relative">
                <div className="max-w-4xl mx-auto space-y-6">
                    <TamperedHeader totalCommands={tamperedCommands.length} />

                    {/* Command cards */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-base font-semibold text-zinc-300 uppercase tracking-wider">
                                Commands for Review
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {tamperedCommands.length}
                            </span>
                        </div>

                        <div className="flex flex-col gap-4">
                            {tamperedCommands.map((cmd) => (
                                <TamperedCommandCard
                                    key={cmd.id}
                                    cmd={cmd}
                                    isAccepted={decisions[cmd.id] ?? true}
                                    onToggle={toggleDecision}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bottom action bar */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 flex items-center justify-between">
                        <div className="text-xs text-zinc-400 flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-emerald-400 font-semibold">{acceptedCount}</span> keeping
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-red-400 font-semibold">{rejectedCount}</span> removing
                            </span>
                        </div>

                        <button
                            onClick={() => setShowConfirmModal(true)}
                            disabled={resolving}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 hover:border-teal-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Save & Continue
                        </button>
                    </div>
                </div>
            </main>

            {/* Confirmation modal - same pattern as QuitModal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                                <span className="bg-teal-500/20 p-1.5 rounded-full flex-shrink-0">
                                    <ShieldCheck className="w-5 h-5 text-teal-400" />
                                </span>
                                Confirm Changes
                            </h2>
                            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                                You're about to <strong className="text-emerald-400 font-medium">keep {acceptedCount}</strong> command{acceptedCount !== 1 ? "s" : ""}{rejectedCount > 0 && (
                                    <> and <strong className="text-red-400 font-medium">remove {rejectedCount}</strong> command{rejectedCount !== 1 ? "s" : ""}</>
                                )}. The config will be re-signed and execution will resume.
                            </p>
                        </div>

                        <div className="flex bg-zinc-950/50 p-4 border-t border-zinc-800/80 justify-end gap-3 rounded-b-xl">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/80 rounded-lg transition-colors"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={resolving}
                                className="px-5 py-2 text-sm font-medium text-white bg-teal-500/90 hover:bg-teal-500 rounded-lg transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] flex items-center gap-2 disabled:opacity-50"
                            >
                                {resolving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Signing...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Confirm
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
