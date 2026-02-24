import { invoke } from "@tauri-apps/api/core";
import { Check, TerminalSquare } from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";

const FORM_CLASSES = {
    label: "block text-sm text-zinc-400 mb-1",
    input: "w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:border-teal-500",
    checkboxWrapper: "flex items-center gap-2 cursor-pointer group",
    checkboxContainer: "relative flex items-center",
    checkboxInputBase: "peer appearance-none w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-950 transition-colors cursor-pointer",
    checkboxIcon: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-zinc-950 stroke-[3]",
    checkboxLabel: "text-sm text-zinc-300 group-hover:text-white transition-colors",
};

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

export function CommandForm({ onSuccess }: CommandFormProps) {
    const {
        register,
        handleSubmit,
        watch,
        reset,
    } = useForm<FormValues>({
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

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        try {
            let interval = 0;
            let runAt: number | null = null;
            if (data.scheduleType === "interval") {
                interval = parseInt(data.intervalSecs) || 0;
            } else if (data.scheduleType === "datetime") {
                if (data.datetime) {
                    runAt = Math.floor(new Date(data.datetime).getTime() / 1000);
                }
            }

            await invoke("register_command", {
                name: data.name,
                commandStr: data.commandStr,
                intervalSecs: interval,
                runAtSecs: runAt,
                autoStart: data.autoStart,
                notifyOnFailure: data.notifyOnFailure,
                notifyOnSuccess: data.notifyOnSuccess,
                autoRestartOnFail: data.autoRestartOnFail,
                autoRestartRetries: parseInt(data.autoRestartRetries) || 0,
                autoRunOnComplete: data.autoRunOnComplete,
            });

            reset();
            onSuccess();
        } catch (e) {
            console.error("Failed to register command:", e);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-xl">
            <h2 className="text-lg font-bold mb-4">Register New Command</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className={FORM_CLASSES.label}>Name / Identifier</label>
                    <input
                        type="text"
                        placeholder="e.g. Daily Backup"
                        className={FORM_CLASSES.input}
                        {...register("name", { required: true })}
                    />
                </div>
                <div>
                    <label className={FORM_CLASSES.label}>Command String (OS Executable)</label>
                    <textarea
                        placeholder='e.g. echo "hello" > log.txt'
                        rows={3}
                        className={`${FORM_CLASSES.input} font-mono text-sm resize-y`}
                        {...register("commandStr", { required: true })}
                    />
                </div>
                <div>
                    <div>
                        <label className={FORM_CLASSES.label}>Schedule Type</label>
                        <select
                            className={FORM_CLASSES.input}
                            {...register("scheduleType")}
                        >
                            <option value="manual">Run Once Immediately</option>
                            <option value="interval">Recurring Interval</option>
                            <option value="datetime">Specific Date and Time</option>
                        </select>
                    </div>

                    {scheduleType === "interval" && (
                        <div>
                            <label className={FORM_CLASSES.label}>Interval in Seconds</label>
                            <input
                                type="number"
                                min="1"
                                className={FORM_CLASSES.input}
                                {...register("intervalSecs", { required: scheduleType === "interval" })}
                            />
                        </div>
                    )}

                    {scheduleType === "datetime" && (
                        <div>
                            <label className={FORM_CLASSES.label}>Target Date and Time</label>
                            <input
                                type="datetime-local"
                                className={FORM_CLASSES.input}
                                {...register("datetime", { required: scheduleType === "datetime" })}
                            />
                        </div>
                    )}
                </div>
                <div>
                    <label className={FORM_CLASSES.checkboxWrapper}>
                        <div className={FORM_CLASSES.checkboxContainer}>
                            <input
                                type="checkbox"
                                className={`${FORM_CLASSES.checkboxInputBase} checked:bg-teal-500 checked:border-teal-500`}
                                {...register("autoStart")}
                            />
                            <Check className={FORM_CLASSES.checkboxIcon} />
                        </div>
                        <span className={FORM_CLASSES.checkboxLabel}>Start automatically on application launch</span>
                    </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6 pt-2">
                    <label className={FORM_CLASSES.checkboxWrapper}>
                        <div className={FORM_CLASSES.checkboxContainer}>
                            <input
                                type="checkbox"
                                className={`${FORM_CLASSES.checkboxInputBase} checked:bg-red-500 checked:border-red-500`}
                                {...register("notifyOnFailure")}
                            />
                            <Check className={FORM_CLASSES.checkboxIcon} />
                        </div>
                        <span className={FORM_CLASSES.checkboxLabel}>Notify on failure</span>
                    </label>
                    <label className={FORM_CLASSES.checkboxWrapper}>
                        <div className={FORM_CLASSES.checkboxContainer}>
                            <input
                                type="checkbox"
                                className={`${FORM_CLASSES.checkboxInputBase} checked:bg-teal-500 checked:border-teal-500`}
                                {...register("notifyOnSuccess")}
                            />
                            <Check className={FORM_CLASSES.checkboxIcon} />
                        </div>
                        <span className={FORM_CLASSES.checkboxLabel}>Notify on success</span>
                    </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6 pt-2">
                    <label className={FORM_CLASSES.checkboxWrapper}>
                        <div className={FORM_CLASSES.checkboxContainer}>
                            <input
                                type="checkbox"
                                className={`${FORM_CLASSES.checkboxInputBase} checked:bg-orange-500 checked:border-orange-500`}
                                {...register("autoRestartOnFail")}
                            />
                            <Check className={FORM_CLASSES.checkboxIcon} />
                        </div>
                        <span className={FORM_CLASSES.checkboxLabel}>Auto re-run on failed</span>
                    </label>

                    {autoRestartOnFail && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-zinc-400">Retries:</label>
                            <input
                                type="number"
                                min="1"
                                className="w-20 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-zinc-100 focus:outline-none focus:border-teal-500 text-sm"
                                {...register("autoRestartRetries")}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <label className={FORM_CLASSES.checkboxWrapper}>
                        <div className={FORM_CLASSES.checkboxContainer}>
                            <input
                                type="checkbox"
                                className={`${FORM_CLASSES.checkboxInputBase} checked:bg-blue-500 checked:border-blue-500`}
                                {...register("autoRunOnComplete")}
                            />
                            <Check className={FORM_CLASSES.checkboxIcon} />
                        </div>
                        <span className={FORM_CLASSES.checkboxLabel}>Auto re-run command when completed or stopped</span>
                    </label>
                </div>

                <div className="pt-2">
                    <button type="submit" className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/50 hover:border-teal-400 font-medium px-6 py-2 rounded-md transition-all shadow-[0_0_15px_rgba(26,188,156,0.15)] hover:shadow-[0_0_20px_rgba(26,188,156,0.25)] w-full flex justify-center items-center gap-2">
                        <TerminalSquare className="w-5 h-5" /> <span>Save and Schedule</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

