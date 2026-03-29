import { useState, useEffect, useRef } from "react";
import { Download, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateStatus =
  | "idle"
  | "downloading"
  | "installing"
  | "error"
  | "relaunching";

export function UpdaterBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const checkForUpdates = async () => {
      try {
        const availableUpdate = await check();
        if (mounted.current && availableUpdate) {
          setUpdate(availableUpdate);
        }
      } catch (e) {
        console.error("Update check failed:", e);
      }
    };

    checkForUpdates();

    return () => {
      mounted.current = false;
    };
  }, []);

  if (!update) return null;

  const handleUpdate = async () => {
    if (["downloading", "installing", "relaunching"].includes(status)) {
      return;
    }

    setStatus("downloading");
    setError(null);
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setStatus("installing");
            setProgress(100);
            break;
        }
      });

      if (!mounted.current) return;

      setStatus("relaunching");
      await relaunch();
    } catch (e: any) {
      console.error("Failed to install update:", e);
      if (!mounted.current) return;
      setStatus("error");
      setError(
        e?.message || String(e) || "Unknown error occurred during update.",
      );
    }
  };

  const isUpdating = ["downloading", "installing", "relaunching"].includes(
    status,
  );

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-teal-500/30 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.15)] transition-all duration-300">
      <div className="flex items-center justify-between p-4 flex-col sm:flex-row gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Download className="h-5 w-5" />
          </div>
          <div className="w-full">
            <h3 className="font-semibold text-teal-300">Update Available</h3>
            <p
              className={`text-sm text-teal-400/80 ${isUpdating || status === "error" ? "mb-2" : ""}`}
            >
              Version {update.version} is now available. You are currently on an
              older version.
            </p>

            {(status === "downloading" || status === "installing") && (
              <div className="w-full max-w-sm mt-1">
                <div className="flex justify-between text-xs text-teal-300 mb-1">
                  <span>
                    {status === "downloading"
                      ? "Downloading..."
                      : "Installing..."}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-teal-950/50 rounded-full h-1.5 overflow-hidden border border-teal-500/20">
                  <div
                    className="bg-teal-400 h-1.5 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === "relaunching" && (
              <p className="text-sm text-teal-400 mt-2 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Update installed. Restarting application...
              </p>
            )}

            {status === "error" && (
              <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Failed: {error}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto justify-center"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              {status === "relaunching" ? "Restarting" : "Updating..."}
            </>
          ) : status === "error" ? (
            "Retry Update"
          ) : (
            "Update Now"
          )}
        </button>
      </div>
    </div>
  );
}
