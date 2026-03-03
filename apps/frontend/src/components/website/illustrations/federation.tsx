import { cn } from "@repo/ui";

function LockIcon({ className }: { className?: string }) {
    return (
        <svg
            className={cn("h-5 w-5", className)}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
        </svg>
    );
}

export function FederationIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    FEDERATION
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Cross-Org Channel
                </span>
            </div>

            <div className="flex items-stretch gap-2 md:gap-4">
                <div className="bg-muted/50 min-w-0 flex-1 rounded-xl p-3">
                    <p className="text-foreground mb-2 text-xs font-semibold">Acme Corp</p>
                    <ul className="space-y-1">
                        <li className="text-muted-foreground text-[10px]">Research Agent</li>
                        <li className="text-muted-foreground text-[10px]">Sales Agent</li>
                    </ul>
                </div>

                <div className="flex shrink-0 flex-col items-center justify-center">
                    <div className="flex items-center gap-1">
                        <div className="border-border h-px w-3 border-t border-dashed md:w-6" />
                        <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
                            <LockIcon />
                        </div>
                        <div className="border-border h-px w-3 border-t border-dashed md:w-6" />
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-[10px]">AES-GCM Encrypted</p>
                </div>

                <div className="bg-muted/50 min-w-0 flex-1 rounded-xl p-3">
                    <p className="text-foreground mb-2 text-xs font-semibold">Partner Inc</p>
                    <ul className="space-y-1">
                        <li className="text-muted-foreground text-[10px]">Delivery Agent</li>
                        <li className="text-muted-foreground text-[10px]">Support Agent</li>
                    </ul>
                </div>
            </div>

            <div className="border-border/40 mt-3 flex flex-wrap gap-2 border-t pt-3">
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    PII Scanner: Active
                </span>
                <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                    Rate Limit: 100/hr
                </span>
                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    Data Class: Confidential
                </span>
            </div>
        </div>
    );
}
