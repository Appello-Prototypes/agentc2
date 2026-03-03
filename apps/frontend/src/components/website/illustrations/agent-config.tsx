import { cn } from "@repo/ui";

export function AgentConfigIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    AGENT CONFIG
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Research Agent
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground text-xs">Model</span>
                    <span className="text-foreground flex items-center gap-1 text-xs font-medium">
                        GPT-4o
                        <svg
                            className="text-muted-foreground h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </span>
                </div>
                <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground text-xs">Temperature</span>
                    <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                            <div className="bg-primary h-full w-[70%] rounded-full" aria-hidden />
                        </div>
                        <span className="text-foreground text-xs font-medium">0.7</span>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    Tools (6)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {["HubSpot", "Gmail", "Firecrawl", "RAG Query", "Web Fetch", "Calculator"].map(
                        (tool) => (
                            <span
                                key={tool}
                                className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400"
                            >
                                {tool}
                            </span>
                        )
                    )}
                </div>
            </div>

            <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    Guardrails
                </p>
                <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground text-xs">PII Blocking</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground text-xs">Prompt Injection</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-muted-foreground text-xs">Cost Limit</span>
                        <span className="text-foreground text-xs font-medium">$2.00/run</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
