export interface RegisteredCommand {
    id: string;
    name: string;
    command_str: string;
    interval_secs: number;
    run_at_secs?: number | null;
    auto_start: boolean;
    notify_on_failure: boolean;
    notify_on_success: boolean;
}

export interface CommandExecutionState {
    is_running: boolean;
    is_active: boolean;
    logs: string[];
    next_run_at?: number | null;
}
