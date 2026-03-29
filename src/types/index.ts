export interface RegisteredCommand {
  id: string;
  name: string;
  command_str: string;
  interval_secs: number;
  run_at_secs?: number | null;
  auto_start: boolean;
  notify_on_failure: boolean;
  notify_on_success: boolean;
  auto_restart_on_fail: boolean;
  auto_restart_retries: number;
  auto_run_on_complete: boolean;
}

export interface CommandExecutionState {
  is_running: boolean;
  is_active: boolean;
  logs: string[];
  next_run_at?: number | null;
}

export interface TamperedCommandInfo {
  id: string;
  name: string;
  command_str: string;
  change_type: "Added" | "Modified";
}
