import { cn } from "@repo/ui";

export function EmbedWidgetIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    EMBED
                </span>
                <span className="text-foreground text-xs font-semibold tracking-wider uppercase">
                    Widget
                </span>
            </div>

            <div className="border-border/40 overflow-hidden rounded-xl border">
                <div className="bg-muted/50 flex items-center gap-2 rounded-t-xl px-4 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                    <span className="bg-background/50 text-muted-foreground flex-1 rounded-md px-3 py-1 text-[10px]">
                        partner-app.com
                    </span>
                </div>
                <div className="bg-background/30 rounded-b-xl p-4">
                    <div className="space-y-2">
                        <div className="bg-muted/30 h-2 w-[80%] rounded-full" aria-hidden />
                        <div className="bg-muted/30 h-2 w-[60%] rounded-full" aria-hidden />
                        <div className="bg-muted/30 h-2 w-[70%] rounded-full" aria-hidden />
                    </div>
                    <div className="bg-card border-border/60 mt-4 ml-auto w-48 rounded-xl border p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="bg-muted/50 flex h-6 w-6 items-center justify-center rounded">
                                <span className="text-muted-foreground text-[8px]">P</span>
                            </div>
                            <span className="text-foreground text-xs font-semibold">
                                PartnerBot
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-end">
                                <div className="bg-primary/10 max-w-[90%] rounded-lg rounded-tr-sm px-2 py-1">
                                    <p className="text-foreground text-[10px]">
                                        How do I reset my password?
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-start">
                                <div className="bg-muted max-w-[90%] rounded-lg rounded-tl-sm px-2 py-1">
                                    <p className="text-foreground text-[10px]">
                                        I&apos;ll help with that. Check your email for a reset link.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted/50 text-muted-foreground mt-2 rounded-lg px-3 py-1.5 text-[10px]">
                            Type a message...
                        </div>
                    </div>
                    <p className="text-muted-foreground mt-2 text-right text-[10px]">
                        Powered by AgentC2
                    </p>
                </div>
            </div>
        </div>
    );
}
