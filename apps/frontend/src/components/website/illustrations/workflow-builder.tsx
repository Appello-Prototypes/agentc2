import { cn } from "@repo/ui";

const steps = [
    {
        title: "Research Customer",
        icon: (
            <svg
                className="text-muted-foreground h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
            </svg>
        ),
        status: "completed",
        statusClass: "bg-emerald-500/10 text-emerald-400"
    },
    {
        title: "Generate Report",
        icon: (
            <svg
                className="text-muted-foreground h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
            </svg>
        ),
        status: "running",
        statusClass: "bg-sky-500/10 text-sky-400"
    },
    {
        title: "Human Approval",
        icon: (
            <svg
                className="text-muted-foreground h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14v7m0 0v-7m0 7h4"
                />
            </svg>
        ),
        status: "pending",
        statusClass: "bg-amber-500/10 text-amber-400"
    }
];

export function WorkflowBuilderIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    WORKFLOW
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Customer Onboarding
                </span>
            </div>

            <div className="flex flex-col items-center">
                {steps.map((step, index) => (
                    <div key={index} className="flex w-full flex-col items-center">
                        <div className="bg-muted/50 flex w-full items-center justify-between rounded-xl p-3">
                            <div className="flex items-center gap-2">
                                {step.icon}
                                <span className="text-foreground text-xs font-medium">
                                    {step.title}
                                </span>
                            </div>
                            <span
                                className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                    step.statusClass
                                )}
                            >
                                {step.status}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <svg
                                className="text-border my-0.5 h-4 w-4"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray="4 4"
                                aria-hidden
                            >
                                <line x1="8" y1="0" x2="8" y2="16" strokeWidth={1.5} />
                            </svg>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
