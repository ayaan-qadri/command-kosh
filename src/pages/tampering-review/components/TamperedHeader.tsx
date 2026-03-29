import { ShieldAlert, AlertTriangle } from "lucide-react";

interface TamperedHeaderProps {
  totalCommands: number;
}

export function TamperedHeader({ totalCommands }: TamperedHeaderProps) {
  return (
    <div className="rounded-xl border border-red-500/15 bg-zinc-900/50 overflow-hidden">
      {/* Thin accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

      <div className="p-5 space-y-4">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-100 leading-tight">
              Integrity Check Failed
            </h1>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">
              commands.json was modified outside Command Kosh
            </p>
          </div>
        </div>

        {/* Info block */}
        <div className="flex items-start gap-3 bg-zinc-950/50 rounded-lg p-3.5 border border-zinc-800/60">
          <AlertTriangle className="w-4 h-4 text-amber-400/80 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            {totalCommands} command{totalCommands !== 1 ? "s are" : " is"}{" "}
            pending review. All execution has been paused until you approve.
            Commands are checked by default, uncheck any you want to remove.
            Please note that this screen will keep opening on startup until you
            review and confirm these changes.
          </p>
        </div>
      </div>
    </div>
  );
}
