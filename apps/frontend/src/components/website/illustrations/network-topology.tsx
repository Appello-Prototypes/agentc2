import { cn } from "@repo/ui";

export function NetworkTopologyIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    NETWORK
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Sales Pipeline
                </span>
            </div>

            <div className="relative flex min-h-[140px] items-center justify-center">
                <svg
                    className="text-border absolute inset-0 h-full w-full"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden
                >
                    <defs>
                        <pattern id="dash" patternUnits="userSpaceOnUse" width="8" height="8">
                            <path
                                d="M 0 4 L 8 4"
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                        </pattern>
                    </defs>
                    {/* Lines from center to each corner */}
                    <line
                        x1="50%"
                        y1="50%"
                        x2="20%"
                        y2="20%"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                    <line
                        x1="50%"
                        y1="50%"
                        x2="80%"
                        y2="20%"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                    <line
                        x1="50%"
                        y1="50%"
                        x2="20%"
                        y2="80%"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                    <line
                        x1="50%"
                        y1="50%"
                        x2="80%"
                        y2="80%"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                </svg>

                <div className="relative grid min-h-[120px] w-full max-w-[200px] grid-cols-[1fr_auto_1fr] grid-rows-[1fr_auto_1fr] gap-2">
                    <div className="flex items-start justify-end pt-1">
                        <span className="bg-muted/50 text-foreground rounded-xl px-3 py-2 text-[10px] font-medium">
                            Research Agent
                        </span>
                    </div>
                    <div className="row-span-3 flex items-center justify-center">
                        <div className="bg-primary/10 border-primary/30 rounded-2xl border-2 p-3 text-center">
                            <span className="text-foreground text-[10px] font-semibold">
                                Orchestrator
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start justify-start pt-1">
                        <span className="bg-muted/50 text-foreground rounded-xl px-3 py-2 text-[10px] font-medium">
                            Outreach Agent
                        </span>
                    </div>
                    <div />
                    <div />
                    <div className="flex items-end justify-end pb-1">
                        <span className="bg-muted/50 text-foreground rounded-xl px-3 py-2 text-[10px] font-medium">
                            Analysis Agent
                        </span>
                    </div>
                    <div className="flex items-end justify-start pb-1">
                        <span className="bg-muted/50 text-foreground rounded-xl px-3 py-2 text-[10px] font-medium">
                            Report Agent
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
