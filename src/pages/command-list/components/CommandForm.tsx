import { invoke } from "@tauri-apps/api/core";
import { TerminalSquare, Clock, Calendar, MousePointerClick, Zap } from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";

const input = "w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-teal-500/60 focus:bg-zinc-950 transition-colors placeholder:text-zinc-600";
const label = "block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide";

interface CommandFormProps {
    onSuccess: () => void;
}

type ScheduleType = "manual" | "interval" | "datetime";

interface FormValues {
    name: string;
    commandStr: string;
    scheduleType: ScheduleType;
    intervalSecs: string;
    datetime: string;
    autoStart: boolean;
    notifyOnFailure: boolean;
    notifyOnSuccess: boolean;
    autoRestartOnFail: boolean;
    autoRestartRetries: string;
    autoRunOnComplete: boolean;
}

function Toggle({ id, checked, onChange, color = "teal" }: { id: string; checked: boolean; onChange: () => void; color?: string }) {
    const colors: Record<string, string> = {
        teal: "peer-checked:bg-teal-500",
        red: "peer-checked:bg-red-500",
        orange: "peer-checked:bg-orange-500",
        blue: "peer-checked:bg-blue-500",
    };
    return (
        <label htmlFor={id} className="relative inline-flex items-center cursor-pointer shrink-0">
            <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
            <div className={`w-9 h-5 bg-zinc-700 rounded-full peer ${colors[color]} transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4`} />
        </label>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
            <div className="bg-zinc-800/30 px-4 py-2.5 border-b border-zinc-800/80">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{title}</span>
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

function ToggleRow({ id, checked, onChange, color, title, description }: { id: string; checked: boolean; onChange: () => void; color?: string; title: string; description: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm text-zinc-200">{title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
            </div>
            <Toggle id={id} checked={checked} onChange={onChange} color={color} />
        </div>
    );
}

export function CommandForm({ onSuccess }: CommandFormProps) {
    const { register, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
        defaultValues: {
            name: "",
            commandStr: "",
            scheduleType: "interval",
            intervalSecs: "60",
            datetime: "",
            autoStart: false,
            notifyOnFailure: false,
            notifyOnSuccess: false,
            autoRestartOnFail: false,
            autoRestartRetries: "3",
            autoRunOnComplete: false,
        },
    });

    const scheduleType = watch("scheduleType");
    const autoRestartOnFail = watch("autoRestartOnFail");
    const autoStart = watch("autoStart");
    const notifyOnFailure = watch("notifyOnFailure");
    const notifyOnSuccess = watch("notifyOnSuccess");
    const autoRunOnComplete = watch("autoRunOnComplete");

    const onSubmit: SubmitHandler<FormValues> = (data) => {
        let interval = 0;
        let runAt: number | null = null;
        if (data.scheduleType === "interval") {
            interval = parseInt(data.intervalSecs) || 0;
        } else if (data.scheduleType === "datetime") {
            if (data.datetime) runAt = Math.floor(new Date(data.datetime).getTime() / 1000);
        }
        invoke("register_command", {
            args: {
                name: data.name,
                command_str: data.commandStr,
                interval_secs: interval,
                run_at_secs: runAt,
                auto_start: data.autoStart,
                notify_on_failure: data.notifyOnFailure,
                notify_on_success: data.notifyOnSuccess,
                auto_restart_on_fail: data.autoRestartOnFail,
                auto_restart_retries: parseInt(data.autoRestartRetries) || 0,
                auto_run_on_complete: data.autoRunOnComplete,
            }
        }).then(() => { reset(); onSuccess(); })
            .catch((e) => console.error("Failed to register command:", e));
    };

    const scheduleOptions = [
        { value: "manual", label: "Run Once", icon: <MousePointerClick className="w-4 h-4" />, desc: "Execute immediately, one time" },
        { value: "interval", label: "Recurring", icon: <Clock className="w-4 h-4" />, desc: "Repeat on an interval" },
        { value: "datetime", label: "Scheduled", icon: <Calendar className="w-4 h-4" />, desc: "Run at a specific time" },
    ];

    return (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <TerminalSquare className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-zinc-100">New Command</h2>
                    <p className="text-xs text-zinc-500">Register a command to be scheduled and run in the background</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
                {/* Identity */}
                <Section title="Identity">
                    <div>
                        <label className={label}>Name</label>
                        <input type="text" placeholder="e.g. Daily Backup" className={input} {...register("name", { required: true })} />
                    </div>
                    <div>
                        <label className={label}>Command</label>
                        <textarea
                            placeholder={'e.g. echo "hello" > log.txt'}
                            rows={3}
                            className={`${input} font-mono resize-y`}
                            {...register("commandStr", { required: true })}
                        />
                    </div>
                </Section>

                {/* Schedule */}
                <Section title="Schedule">
                    <div className="grid grid-cols-3 gap-2">
                        {scheduleOptions.map((opt) => (
                            <label
                                key={opt.value}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${scheduleType === opt.value
                                    ? "border-teal-500/40 bg-teal-500/8 text-teal-300"
                                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                                    }`}
                            >
                                <input type="radio" value={opt.value} className="sr-only" {...register("scheduleType")} />
                                {opt.icon}
                                <span className="text-xs font-medium">{opt.label}</span>
                                <span className="text-[10px] text-center opacity-70">{opt.desc}</span>
                            </label>
                        ))}
                    </div>

                    {scheduleType === "interval" && (
                        <div>
                            <label className={label}>Interval (seconds)</label>
                            <input type="number" min="1" className={input} {...register("intervalSecs", { required: scheduleType === "interval" })} />
                        </div>
                    )}
                    {scheduleType === "datetime" && (
                        <div>
                            <label className={label}>Target Date & Time</label>
                            <input type="datetime-local" className={input} {...register("datetime", { required: scheduleType === "datetime" })} />
                        </div>
                    )}
                </Section>

                {/* Behaviour */}
                <Section title="Behaviour">
                    <ToggleRow id="autoStart" checked={autoStart} onChange={() => setValue("autoStart", !autoStart)} color="teal"
                        title="Auto-start on launch" description="Start this command when the app starts" />
                    <div className="h-px bg-zinc-800/60" />
                    <ToggleRow id="notifyOnFailure" checked={notifyOnFailure} onChange={() => setValue("notifyOnFailure", !notifyOnFailure)} color="red"
                        title="Notify on failure" description="Show a system notification if the command fails" />
                    <ToggleRow id="notifyOnSuccess" checked={notifyOnSuccess} onChange={() => setValue("notifyOnSuccess", !notifyOnSuccess)} color="teal"
                        title="Notify on success" description="Show a system notification on successful completion" />
                    <div className="h-px bg-zinc-800/60" />
                    <ToggleRow id="autoRestartOnFail" checked={autoRestartOnFail} onChange={() => setValue("autoRestartOnFail", !autoRestartOnFail)} color="orange"
                        title="Auto retry on failure" description="Automatically re-run the command if it fails" />
                    {autoRestartOnFail && (
                        <div className="ml-0 flex items-center gap-3 pl-0">
                            <label className="text-xs text-zinc-400 shrink-0">Max retries</label>
                            <input type="number" min="1" className="w-24 bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-teal-500/60 transition-colors" {...register("autoRestartRetries")} />
                        </div>
                    )}
                    <div className="h-px bg-zinc-800/60" />
                    <ToggleRow id="autoRunOnComplete" checked={autoRunOnComplete} onChange={() => setValue("autoRunOnComplete", !autoRunOnComplete)} color="blue"
                        title="Loop on completion" description="Re-run immediately after each successful completion" />
                </Section>

                {/* Submit */}
                <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-teal-500/10 hover:bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 font-medium px-6 py-2.5 rounded-lg transition-all duration-150 text-sm"
                >
                    <Zap className="w-4 h-4" />
                    Save & Schedule
                </button>
            </form>
        </div>
    );
}
