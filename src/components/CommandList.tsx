import { RegisteredCommand } from "../types";

interface CommandListProps {
    commands: RegisteredCommand[];
    showForm: boolean;
    onSelect: (cmd: RegisteredCommand) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
}

export function CommandList({ commands, showForm, onSelect, onDelete }: CommandListProps) {
    if (commands.length === 0 && !showForm) {
        return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-zinc-800/80 rounded-full flex items-center justify-center mb-4 border border-zinc-700/50">
                    <span className="text-2xl text-teal-400">⚡</span>
                </div>
                <p className="text-sm text-zinc-400 mb-6">Create your first command below to start scheduling background tasks.</p>
            </div>
        );
    }

    return (
        <>
            {commands.map((cmd) => (
                <div
                    key={cmd.id}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex justify-between items-center hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => onSelect(cmd)}
                >
                    <div>
                        <h3 className="font-medium text-zinc-100">{cmd.name}</h3>
                        <code className="text-xs text-teal-400 bg-teal-400/10 px-2 py-1 rounded inline-block mt-2 mb-1">
                            {cmd.command_str}
                        </code>
                        <p className="text-xs text-zinc-500">
                            Schedule: {cmd.run_at_secs ? `Scheduled for ${new Date(cmd.run_at_secs * 1000).toLocaleString()}` : cmd.interval_secs > 0 ? `Every ${cmd.interval_secs} seconds` : "Manual / One-time"}
                        </p>
                    </div>
                    <button
                        onClick={(e) => onDelete(cmd.id, e)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-md transition-colors text-sm"
                    >
                        Delete
                    </button>
                </div>
            ))}
        </>
    );
}
