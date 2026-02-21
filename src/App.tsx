import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import "./App.css";

import { RegisteredCommand } from "./types";
import { CommandForm } from "./components/CommandForm";
import { CommandList } from "./components/CommandList";
import { CommandDetails } from "./components/CommandDetails";

function App() {
  const [commands, setCommands] = useState<RegisteredCommand[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<RegisteredCommand | null>(null);

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    try {
      const fetchedCommands = await invoke<RegisteredCommand[]>("get_commands");
      setCommands(fetchedCommands);
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
          className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-medium px-4 py-2 rounded-md transition-colors shadow-lg shadow-teal-500/20 text-sm flex items-center gap-2"
        >
          <span>{showForm ? "Cancel" : "+"}</span> {showForm ? "Close Form" : "New Command"}
        </button>
      </header>

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
              showForm={showForm}
              onSelect={setSelectedCommand}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
