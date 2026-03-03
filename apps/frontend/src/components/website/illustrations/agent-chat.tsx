import { cn } from "@repo/ui";

export function AgentChatIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    AGENT CHAT
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Grace
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex justify-end">
                    <div className="bg-primary/10 max-w-[85%] rounded-2xl rounded-tr-sm p-3">
                        <p className="text-foreground text-xs">
                            Can you find the latest deal in HubSpot?
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">2:34 PM</p>
                    </div>
                </div>
                <div className="flex justify-start">
                    <div className="bg-muted max-w-[85%] rounded-2xl rounded-tl-sm p-3">
                        <p className="text-foreground text-xs">
                            I&apos;ll look that up for you. Checking HubSpot deals now.
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">2:34 PM</p>
                    </div>
                </div>
                <div className="flex justify-end">
                    <div className="bg-primary/10 max-w-[85%] rounded-2xl rounded-tr-sm p-3">
                        <p className="text-foreground text-xs">
                            Thanks! Also search our knowledge base for pricing docs.
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">2:35 PM</p>
                    </div>
                </div>
                <div className="flex justify-start">
                    <div className="bg-muted max-w-[85%] rounded-2xl rounded-tl-sm p-3">
                        <p className="text-foreground text-xs">
                            Found Acme Corp deal ($45K). Searching RAG for pricing...
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">2:35 PM</p>
                    </div>
                </div>
            </div>

            <div className="bg-muted/50 mt-3 rounded-xl p-3">
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
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
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        <span className="text-foreground text-xs font-medium">
                            hubspot_get_deals
                        </span>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Completed
                    </span>
                </div>
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
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
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <span className="text-foreground text-xs font-medium">rag_query</span>
                    </div>
                    <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                        Running
                    </span>
                </div>
            </div>
        </div>
    );
}
