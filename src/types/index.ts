export interface RegisteredCommand {
    id: string;
    name: string;
    command_str: string;
    interval_secs: number;
}

export interface CommandExecutionState {
    is_running: boolean;
    is_active: boolean;
    logs: string[];
}
