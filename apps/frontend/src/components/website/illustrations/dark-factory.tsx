import { cn } from "@repo/ui";

const stages = [
    { label: "Ticket", state: "completed" as const },
    { label: "Plan", state: "completed" as const },
    { label: "Code", state: "completed" as const },
    { label: "Build", state: "current" as const },
    { label: "Verify", state: "pending" as const },
    { label: "CI", state: "pending" as const },
    { label: "Deploy", state: "pending" as const }
];

export function DarkFactoryIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    DARK FACTORY
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Pipeline #247
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {stages.map((stage, index) => (
                    <div key={stage.label} className="flex items-center gap-1.5">
                        <span
                            className={cn(
                                "rounded-lg px-2.5 py-1.5 text-[10px] font-medium",
                                stage.state === "completed" && "bg-emerald-500/10 text-emerald-400",
                                stage.state === "current" &&
                                    "bg-sky-500/10 text-sky-400 ring-1 ring-sky-400/30",
                                stage.state === "pending" && "bg-muted/50 text-muted-foreground"
                            )}
                        >
                            {stage.label}
                        </span>
                        {index < stages.length - 1 && (
                            <span className="text-muted-foreground text-[10px]">→</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground text-xs">Ticket</span>
                    <span className="text-foreground text-xs font-medium">
                        JIRA-1247 — Fix login timeout
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        Risk: Medium
                    </span>
                    <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                        Autonomy: Level 3
                    </span>
                </div>
                <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground text-xs">Trust Score</span>
                    <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
                            <div className="bg-primary h-full w-[87%] rounded-full" aria-hidden />
                        </div>
                        <span className="text-foreground text-xs font-medium">87%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
