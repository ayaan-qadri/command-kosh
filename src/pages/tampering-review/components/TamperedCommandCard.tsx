import { Check } from "lucide-react";
import { TamperedCommandInfo } from "../../../types";
import { CopyableCommand } from "../../../custom-components/CopyableCommand";

export interface TamperedCommandCardProps {
  cmd: TamperedCommandInfo;
  isAccepted: boolean;
  onToggle: (id: string) => void;
}

export function TamperedCommandCard({
  cmd,
  isAccepted,
  onToggle,
}: TamperedCommandCardProps) {
  return (
    <div
      onClick={() => onToggle(cmd.id)}
      className={`group relative bg-zinc-900/50 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:bg-zinc-900/70 hover:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ${
        isAccepted
          ? "border-zinc-800/60 hover:border-zinc-700/80"
          : "border-red-500/25 hover:border-red-500/40"
      }`}
    >
      {/* Top accent line */}
      {isAccepted ? (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      ) : (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
      )}

      <div className="flex items-stretch">
        {/* Main content */}
        <div className="flex-1 min-w-0 px-5 py-4 flex flex-col">
          {/* Name row */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-[17px] text-zinc-100 truncate leading-tight">
              {cmd.name}
            </h3>
          </div>

          {/* Command string */}
          <div className="mb-2.5">
            <CopyableCommand
              command={cmd.command_str}
              className="text-[13px] text-teal-300/80 bg-zinc-800/70 border border-zinc-700/40 px-2.5 py-1 rounded-md font-mono"
            />
          </div>

          {/* ID */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-zinc-600 font-mono">{cmd.id}</span>
          </div>
        </div>

        {/* Right: checkbox */}
        <div className="flex items-center px-5 shrink-0">
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
              isAccepted
                ? "bg-emerald-500 border-emerald-400 text-white"
                : "bg-zinc-800 border-zinc-600 text-transparent group-hover:border-zinc-500"
            }`}
          >
            <Check
              className={`w-3.5 h-3.5 transition-all duration-200 ${
                isAccepted ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
              strokeWidth={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
