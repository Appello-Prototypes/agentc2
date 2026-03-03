import { cn } from "@repo/ui";

const tasks = [
    {
        label: "Audit stale deals",
        status: "Completed",
        badgeClass: "bg-emerald-500/10 text-emerald-400"
    },
    {
        label: "Generate follow-ups",
        status: "Completed",
        badgeClass: "bg-emerald-500/10 text-emerald-400"
    },
    {
        label: "Draft outreach emails",
        status: "In Progress",
        badgeClass: "bg-sky-500/10 text-sky-400"
    },
    {
        label: "Compile weekly report",
        status: "Pending",
        badgeClass: "bg-amber-500/10 text-amber-400"
    }
];

export function CampaignIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    CAMPAIGN
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Q1 Pipeline Review
                </span>
                <span className="ml-auto rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                    In Progress
                </span>
            </div>

            <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground text-xs">Intent</span>
                <span className="text-foreground max-w-[70%] text-right text-xs font-medium">
                    Review and update all Q1 pipeline deals
                </span>
            </div>

            <div className="mt-2 space-y-2">
                {tasks.map((task) => (
                    <div key={task.label} className="flex items-center justify-between py-2">
                        <span className="text-foreground text-xs">{task.label}</span>
                        <span
                            className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                task.badgeClass
                            )}
                        >
                            {task.status}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-3">
                <div className="bg-muted/50 h-2 overflow-hidden rounded-full">
                    <div className="bg-primary h-full w-[60%] rounded-full" aria-hidden />
                </div>
            </div>

            <div className="bg-muted/30 mt-3 rounded-lg p-2.5">
                <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                    After Action Review
                </p>
                <p className="text-foreground text-[10px]">Sustain: Automated deal scoring</p>
                <p className="text-foreground mt-0.5 text-[10px]">Improve: Email personalization</p>
            </div>
        </div>
    );
}
