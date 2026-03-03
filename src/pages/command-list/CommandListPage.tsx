import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CommandForm } from "./components/CommandForm";
import { CommandList } from "./components/CommandList";
import { AutostartBanner } from "./components/AutostartBanner";
import { QuitModal } from "./components/QuitModal";

export function CommandListPage() {
    const [showForm, setShowForm] = useState(false);
    const [showAutostartBanner, setShowAutostartBanner] = useState(false);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            <header className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md sticky top-0 z-10 w-full">
                {/* Branding */}
                <div className="flex items-center gap-3">

                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent leading-tight">Command Kosh</h1>
                        <p className="text-xs text-zinc-500 leading-tight">Registry & Scheduler</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <QuitModal />

                    {/* New Command */}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150 border ${showForm
                            ? "text-zinc-400 bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-200"
                            : "text-teal-400 bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/15 hover:border-teal-500/50"
                            }`}
                    >
                        {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{showForm ? "Cancel" : "New Command"}</span>
                    </button>
                </div>
            </header>

            {showAutostartBanner && (
                <AutostartBanner onClose={() => setShowAutostartBanner(false)} />
            )}


            <main className="flex-1 p-6 z-0 relative">
                <div className="max-w-4xl mx-auto space-y-6">
                    {showForm && (
                        <CommandForm
                            onSuccess={() => setShowForm(false)}
                        />
                    )}

                    {!showForm && (

                        <CommandList
                            setShowAutostartBanner={setShowAutostartBanner}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
