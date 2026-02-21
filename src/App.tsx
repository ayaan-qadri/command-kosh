import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Command Kosh</h1>
          <p className="text-xs text-zinc-400 mt-1">Registry & Scheduler</p>
        </div>
        <button className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-medium px-4 py-2 rounded-md transition-colors shadow-lg shadow-teal-500/20 text-sm flex items-center gap-2">
          <span>+</span> New Command
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Empty State for now */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center mt-12 flex flex-col items-center shadow-xl">
            <div className="w-16 h-16 bg-zinc-800/80 rounded-full flex items-center justify-center mb-4 border border-zinc-700/50 shadow-inner">
              <span className="text-2xl text-teal-400">⚡</span>
            </div>
            <h2 className="text-lg font-medium text-zinc-200 mb-2">No commands registered yet</h2>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto mb-6">Create your first command to start running or scheduling tasks in the background.</p>
            <button className="text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors border border-teal-500/30 px-4 py-2 rounded-md hover:bg-teal-500/10">
              Read the documentation
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
