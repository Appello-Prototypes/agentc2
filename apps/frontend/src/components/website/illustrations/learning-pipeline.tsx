import { cn } from "@repo/ui";

export function LearningPipelineIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    LEARNING
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Continuous Improvement
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <div className="min-w-0 rounded-lg bg-sky-500/10 p-2">
                    <p className="text-[10px] font-medium text-sky-400">Signal Extraction</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">12 signals found</p>
                </div>
                <span className="text-border shrink-0 text-[10px]">→</span>
                <div className="min-w-0 rounded-lg bg-amber-500/10 p-2">
                    <p className="text-[10px] font-medium text-amber-400">Proposal</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                        Adjust temperature to 0.5
                    </p>
                </div>
                <span className="text-border shrink-0 text-[10px]">→</span>
                <div className="bg-primary/10 min-w-0 rounded-lg p-2">
                    <p className="text-primary text-[10px] font-medium">A/B Experiment</p>
                    <div className="mt-1 flex gap-2">
                        <div className="flex-1">
                            <p className="text-muted-foreground text-[10px]">A</p>
                            <div className="bg-muted h-1 overflow-hidden rounded-full">
                                <div
                                    className="bg-primary h-full w-[78%] rounded-full"
                                    aria-hidden
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-muted-foreground text-[10px]">B</p>
                            <div className="bg-muted h-1 overflow-hidden rounded-full">
                                <div
                                    className="h-full w-[84%] rounded-full bg-emerald-500"
                                    aria-hidden
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <span className="text-border shrink-0 text-[10px]">→</span>
                <div className="min-w-0 rounded-lg bg-emerald-500/10 p-2">
                    <p className="text-[10px] font-medium text-emerald-400">Promoted</p>
                    <span className="mt-1 inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        v3.2 active
                    </span>
                </div>
            </div>

            <div className="border-border/40 mt-3 flex items-center justify-between border-t py-2 pt-3">
                <span className="text-muted-foreground text-xs">Summary</span>
                <span className="text-foreground text-xs font-medium">
                    3 improvements promoted this week
                </span>
            </div>
        </div>
    );
}
