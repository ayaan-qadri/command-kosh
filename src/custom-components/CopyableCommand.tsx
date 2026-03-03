import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Copy, Check } from "lucide-react";

interface CopyableCommandProps {
    command: string;
    className?: string;
}

interface TooltipPos {
    top: number;
    left: number;
    below: boolean;
    maxWidth: number;
    maxHeight: number;
}

export function CopyableCommand({ command, className = "" }: CopyableCommandProps) {
    const [copied, setCopied] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const codeRef = useRef<HTMLElement>(null);

    const showTooltip = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        showTimer.current = setTimeout(() => {
            if (codeRef.current) {
                // Only show tooltip if text is actually truncated
                if (codeRef.current.scrollWidth <= codeRef.current.clientWidth) return;

                const rect = codeRef.current.getBoundingClientRect();
                const margin = 12;
                const below = rect.top < 180;

                const maxWidth = Math.min(window.innerWidth - rect.left - margin, 700);
                const maxHeight = below
                    ? window.innerHeight - rect.bottom - margin - 40
                    : rect.top - margin - 40;

                setTooltipPos({
                    top: below ? rect.bottom + 6 : rect.top - 6,
                    left: rect.left,
                    below,
                    maxWidth: Math.max(maxWidth, 260),
                    maxHeight: Math.max(maxHeight, 80),
                });
            }
        }, 300);
    };

    const hideTooltip = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        hideTimer.current = setTimeout(() => setTooltipPos(null), 120);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };

    const tooltip = tooltipPos && createPortal(
        <div
            className="pointer-events-auto"
            style={{
                position: "fixed",
                top: tooltipPos.top,
                left: tooltipPos.left,
                transform: tooltipPos.below ? "none" : "translateY(-100%)",
                width: tooltipPos.maxWidth,
                zIndex: 2147483647, // max possible — above every stacking context
            }}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            <div
                className="flex flex-col bg-zinc-800 border border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden cursor-pointer group/tip"
                onClick={handleCopy}
            >
                <code
                    className="text-[11px] text-teal-300/90 font-mono break-words leading-relaxed overflow-y-auto p-2.5
                        [&::-webkit-scrollbar]:w-1
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-thumb]:bg-zinc-600
                        [&::-webkit-scrollbar-thumb]:rounded-full"
                    style={{ maxHeight: tooltipPos.maxHeight }}
                >
                    {command}
                </code>

                <div className="flex items-center justify-end gap-1.5 px-2.5 py-1.5 border-t border-zinc-700/60 bg-zinc-900/40 shrink-0">
                    {copied
                        ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Copied!</span></>
                        : <><Copy className="w-3 h-3 text-zinc-500 group-hover/tip:text-zinc-300 transition-colors" /><span className="text-[10px] text-zinc-500 group-hover/tip:text-zinc-300 transition-colors">Click to copy</span></>
                    }
                </div>
            </div>
        </div>,
        document.body
    );

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

            {tooltip}
        </div>
    );
}