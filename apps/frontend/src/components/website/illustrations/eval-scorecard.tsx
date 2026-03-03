import { cn } from "@repo/ui";

const criteria = [
    { label: "Relevance", value: 92, fillClass: "bg-emerald-500" },
    { label: "Accuracy", value: 88, fillClass: "bg-emerald-500" },
    { label: "Helpfulness", value: 95, fillClass: "bg-emerald-500" },
    { label: "Safety", value: 100, fillClass: "bg-emerald-500" },
    { label: "Latency", value: 72, fillClass: "bg-amber-500" }
];

export function EvalScorecardIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    EVALUATION
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Agent Scorecard
                </span>
            </div>

            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl font-bold text-emerald-400">
                A
            </div>

            <div className="space-y-0">
                {criteria.map(({ label, value, fillClass }) => (
                    <div key={label} className="flex items-center gap-3 py-2">
                        <span className="text-muted-foreground w-20 text-xs">{label}</span>
                        <div className="bg-muted/50 h-2 flex-1 overflow-hidden rounded-full">
                            <div
                                className={cn("h-full rounded-full", fillClass)}
                                style={{ width: `${value}%` }}
                            />
                        </div>
                        <span className="text-foreground w-8 text-right text-xs font-medium">
                            {value}%
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-center">
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    Tier: Production Ready
                </span>
            </div>
        </div>
    );
}
