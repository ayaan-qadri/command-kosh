import { useState, useRef } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableCommandProps {
    command: string;
    className?: string;
}

export function CopyableCommand({ command, className = "" }: CopyableCommandProps) {
    const [copied, setCopied] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const codeRef = useRef<HTMLElement>(null);

    const showTooltip = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (codeRef.current) {
            const rect = codeRef.current.getBoundingClientRect();
            setTooltipPos({ top: rect.top - 8, left: rect.left });
        }
    };

    const hideTooltip = () => {
        hideTimer.current = setTimeout(() => setTooltipPos(null), 120);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };

    return (
        <div className="relative inline-flex max-w-full min-w-0">
            <code
                ref={codeRef}
                className={`truncate cursor-pointer ${className}`}
                onClick={handleCopy}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                title=""
            >
                {command}
            </code>

            {/* Fixed tooltip — escapes any overflow:hidden parent */}
            {tooltipPos && (
                <div
                    className="fixed z-[9999] pointer-events-auto"
                    style={{
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        transform: "translateY(-100%)",
                    }}
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                >
                    <div
                        className="flex items-start gap-2 bg-zinc-800 border border-zinc-700/80 rounded-lg shadow-2xl p-2.5 w-80 cursor-pointer group/tip mb-1.5"
                        onClick={handleCopy}
                    >
                        <code className="text-[11px] text-teal-300/90 font-mono leading-relaxed flex-1 break-words whitespace-pre-wrap">
                            {command}
                        </code>
                        <div className="shrink-0 mt-0.5">
                            {copied
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover/tip:text-zinc-300 transition-colors" />
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}