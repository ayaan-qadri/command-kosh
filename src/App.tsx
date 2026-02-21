import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useState, useEffect } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import "./App.css";

import { RegisteredCommand, CommandExecutionState } from "./types";
import { CommandForm } from "./components/CommandForm";
import { CommandList } from "./components/CommandList";
import { CommandDetails } from "./components/CommandDetails";

function App() {
  const [commands, setCommands] = useState<RegisteredCommand[]>([]);
  const [commandStates, setCommandStates] = useState<Record<string, CommandExecutionState>>({});
  const [showForm, setShowForm] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<RegisteredCommand | null>(null);
  const [showAutostartBanner, setShowAutostartBanner] = useState(false);

  const fetchStates = async () => {
    try {
      const states = await invoke<Record<string, CommandExecutionState>>("get_all_command_states");
      setCommandStates(states);
    } catch (e) {
      console.error("Failed to fetch states:", e);
    }
  };

  useEffect(() => {
    fetchCommands();
    fetchStates();
    const interval = setInterval(fetchStates, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchCommands = async () => {
    try {
      const fetchedCommands = await invoke<RegisteredCommand[]>("get_commands");
      setCommands(fetchedCommands);

      try {
        if (!import.meta.env.DEV) {
          const currentlyEnabled = await isEnabled();
          const shouldEnable = fetchedCommands.some(c => c.auto_start !== false);

          if (shouldEnable && !currentlyEnabled) {
            try {
              await enable();
              console.log("Auto-start enabled successfully for Command Kosh.");
            } catch (enableErr: any) {
              console.error("Failed to auto-enable autostart:", enableErr);
              if (localStorage.getItem("hideAutostartBanner") !== "true") {
                setShowAutostartBanner(true);
              }
            }
          } else if (!shouldEnable && currentlyEnabled) {
            await disable();
          }
        }
      } catch (err: any) {
        console.error("Failed to check OS autostart status:", err);
      }
    } catch (e) {
      console.error("Failed to fetch commands:", e);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("delete_command", { id });
      if (selectedCommand?.id === id) {
        setSelectedCommand(null);
      }
      fetchCommands();
      fetchStates();
    } catch (e) {
      console.error("Failed to delete command:", e);
    }
  };

  if (selectedCommand) {
    return (
      <CommandDetails
        selectedCommand={selectedCommand}
        onBack={() => setSelectedCommand(null)}
        fetchCommands={fetchCommands}
        onCommandUpdated={(updated) => setSelectedCommand(updated)}
        onDelete={() => handleDelete(selectedCommand.id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Command Kosh</h1>
          <p className="text-xs text-zinc-400 mt-1">Registry & Scheduler</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/50 hover:border-teal-400 font-medium px-4 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(26,188,156,0.15)] hover:shadow-[0_0_20px_rgba(26,188,156,0.25)] text-sm flex items-center gap-2"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? "Cancel" : "New Command"}</span>
        </button>
      </header>

      {showAutostartBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm animate-in slide-in-from-top-4 z-0 relative">
          <div className="flex items-center gap-3 text-amber-200/90 text-center md:text-left mx-auto md:mx-0">
            <span className="bg-amber-500/20 p-1.5 rounded-full flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-400" /></span>
            <div>
              <p className="font-semibold text-amber-300">Auto-Start is disabled</p>
              <p className="text-amber-200/70 text-xs">Some commands require the app to start automatically, but this app is not configured to.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2">
            <button onClick={() => setShowAutostartBanner(false)} className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors">
              Close
            </button>
            <button onClick={() => {
              localStorage.setItem("hideAutostartBanner", "true");
              setShowAutostartBanner(false);
            }} className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors whitespace-nowrap">
              Don't show again
            </button>
            <button onClick={async () => {
              try {
                await enable();
                setShowAutostartBanner(false);
                sendNotification({ title: "Setup Success", body: "Auto-start has been enabled for Command Kosh." });
              } catch (e: any) {
                console.error("Failed to enable autostart", e);
                sendNotification({ title: "Setup Failed", body: "Could not enable auto-start." });
              }
            }} className="px-5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-medium rounded transition-all whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              Enable Auto Start
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {showForm && (
            <CommandForm
              onSuccess={() => {
                setShowForm(false);
                fetchCommands();
              }}
            />
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-medium text-zinc-200">Registered Commands</h2>
            <CommandList
              commands={commands}
              states={commandStates}
              showForm={showForm}
              onSelect={setSelectedCommand}
              onStart={async (id, e) => {
                e.stopPropagation();
                await invoke("start_command", { id });
                fetchStates();
              }}
              onStop={async (id, e) => {
                e.stopPropagation();
                await invoke("stop_command", { id });
                fetchStates();
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
