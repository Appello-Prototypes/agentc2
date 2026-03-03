"use client";

export function InteractiveDemo() {
    return (
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        LIVE DEMO
                    </span>
                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                        Try it now. Talk to an AgentC2 agent.
                    </h2>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
                        This agent is powered by AgentC2. It uses MCP tools, knowledge-powered
                        search, and conversation memory.
                    </p>
                </div>

                <div className="mx-auto mt-12 max-w-3xl">
                    <div className="border-border/60 bg-muted/50 rounded-t-2xl border border-b-0 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <div className="bg-background/50 text-muted-foreground flex-1 rounded-md px-3 py-1 text-xs">
                                agentc2.ai
                            </div>
                        </div>
                    </div>
                    <div className="border-border/60 overflow-hidden rounded-b-2xl border">
                        <iframe
                            src="/embed/welcome?token=demo&internal=true"
                            className="h-[500px] w-full border-0"
                            allow="clipboard-write"
                            title="AgentC2 Welcome Agent Demo"
                        />
                    </div>
                    <p className="text-muted-foreground mt-4 text-center text-xs">
                        Powered by AgentC2 — featuring MCP tools, RAG knowledge, and conversation
                        memory.
                    </p>
                </div>
            </div>
        </section>
    );
}
