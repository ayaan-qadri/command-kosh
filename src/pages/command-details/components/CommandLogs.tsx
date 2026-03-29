import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal, Trash2, ArrowDown } from "lucide-react";
import { CommandExecutionState } from "../../../types";

interface CommandLogsProps {
  commandId: string;
}

export function CommandLogs({ commandId }: CommandLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewLogs, setHasNewLogs] = useState(false);

  // Track whether user is scrolled to the bottom of the page
  const checkIfAtBottom = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    // Consider "at bottom" if within 80px of the bottom
    const atBottom = scrollTop + windowHeight >= docHeight - 80;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewLogs(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", checkIfAtBottom);
    window.addEventListener("resize", checkIfAtBottom);
    return () => {
      window.removeEventListener("scroll", checkIfAtBottom);
      window.removeEventListener("resize", checkIfAtBottom);
    };
  }, [checkIfAtBottom]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;
    let isCancelled = false;

    invoke<CommandExecutionState>("get_command_state", { id: commandId })
      .then((state) => {
        if (isMounted) {
          setLogs(state.logs.slice(-1000));
          // Scroll to bottom on initial load
          setTimeout(() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }, 50);
        }
      })
      .catch(console.error);

    listen<[string, string]>("command-output", (event) => {
      if (event.payload[0] === commandId) {
        setLogs((prev) => [...prev, event.payload[1]].slice(-1000));
        setHasNewLogs(true);
      }
    })
      .then((u) => {
        if (isCancelled) u();
        else unlisten = u;
      })
      .catch(console.error);

    return () => {
      isMounted = false;
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, [commandId]);

  // Auto-scroll when at bottom and new logs flag is set
  useEffect(() => {
    if (hasNewLogs && isAtBottom) {
      setHasNewLogs(false);
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }, 20);
    }
  }, [hasNewLogs, isAtBottom]);

  const handleClearLogs = () => {
    invoke("clear_logs", { id: commandId })
      .then(() => {
        setLogs([]);
        setHasNewLogs(false);
      })
      .catch(console.error);
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setHasNewLogs(false);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Log viewer header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Terminal className="w-3.5 h-3.5" />
          <span>Output Log</span>
          {logs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/50">
              {logs.length} lines
            </span>
          )}
        </div>
        {logs.length > 0 && (
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-800/50 border border-zinc-700/40 px-2.5 py-1 rounded-md transition-all"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Log body — no inner scroll, flows with the page */}
      <div className="bg-zinc-950 border border-zinc-800/70 rounded-xl p-4 font-mono text-sm relative">
        {logs.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Terminal className="w-8 h-8 opacity-30" />
            <span className="text-sm italic">
              No output yet. Start the command to see logs here.
            </span>
          </div>
        ) : (
          <div className="space-y-0.5 text-zinc-300 whitespace-pre-wrap break-all">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="hover:bg-zinc-800/40 px-1 py-0.5 rounded"
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom arrow button with dot indicator */}
      {!isAtBottom && hasNewLogs && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center
                               bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white
                               border border-zinc-700/60 shadow-lg shadow-black/30 backdrop-blur-sm
                               transition-all duration-200 hover:scale-110"
        >
          <ArrowDown className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-zinc-900 animate-pulse" />
        </button>
      )}
    </div>
  );
}
