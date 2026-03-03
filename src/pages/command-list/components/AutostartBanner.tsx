import { AlertTriangle } from "lucide-react";
import { enable } from "@tauri-apps/plugin-autostart";
import { sendNotification } from "@tauri-apps/plugin-notification";

interface AutostartBannerProps {
    onClose: () => void;
}

export function AutostartBanner({ onClose }: AutostartBannerProps) {
    return (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm animate-in slide-in-from-top-4 z-0 relative">
            <div className="flex items-center gap-3 text-amber-200/90 text-center md:text-left mx-auto md:mx-0">
                <span className="bg-amber-500/20 p-1.5 rounded-full flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-400" /></span>
                <div>
                    <p className="font-semibold text-amber-300">Auto-Start is disabled</p>
                    <p className="text-amber-200/70 text-sm">Some commands require the app to start automatically, but this app is not configured to.</p>
                </div>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-zinc-200 hover:text-zinc-400 hover:bg-zinc-800 rounded transition-colors">
                    Close
                </button>
                <button onClick={() => {
                    localStorage.setItem("hideAutostartBanner", "true");
                    onClose();
                }} className="px-3 py-1.5 text-zinc-200 hover:text-zinc-400 hover:bg-zinc-800 rounded transition-colors whitespace-nowrap">
                    Don't show again
                </button>
                <button onClick={() => {
                    enable()
                        .then(() => {
                            onClose();
                            sendNotification({ title: "Setup Success", body: "Auto-start has been enabled for Command Kosh." });
                        })
                        .catch((e: any) => {
                            console.error("Failed to enable autostart", e);
                            sendNotification({ title: "Setup Failed", body: "Could not enable auto-start." });
                        });
                }} className="px-5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-medium rounded transition-all whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    Enable Auto Start
                </button>
            </div>
        </div>
    );
}
