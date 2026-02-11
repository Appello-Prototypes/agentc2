const capabilities = [
    {
        title: "Voice Agents",
        description:
            "Real-time voice conversations powered by ElevenLabs and OpenAI. Deploy to phone systems via Twilio or embed in your product.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
        )
    },
    {
        title: "Canvas Dashboards",
        description:
            "Agents build data-connected dashboards from natural language. Charts, tables, KPIs, and forms — all powered by live data.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        )
    },
    {
        title: "Knowledge Base (RAG)",
        description:
            "Ingest documents, search semantically, and ground every response in your data. Supports markdown, text, HTML, and JSON.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                <line x1="9" y1="7" x2="16" y2="7" />
                <line x1="9" y1="11" x2="14" y2="11" />
            </svg>
        )
    },
    {
        title: "Skills System",
        description:
            "Composable competency bundles that agents discover and activate on demand. Attach documents, tools, and examples to reusable skills.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        )
    },
    {
        title: "Observability",
        description:
            "Full execution traces for every agent run, tool call, and model generation. Cost tracking, quality scoring, and comprehensive audit logs.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        )
    },
    {
        title: "Enterprise Ready",
        description:
            "Multi-tenant architecture with organization and workspace isolation. Encrypted credentials, budget controls, guardrail policies, and role-based access.",
        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
                <circle cx="12" cy="16" r="1" />
            </svg>
        )
    }
];

export function CapabilityGrid() {
    return (
        <section id="capabilities" className="scroll-mt-20 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        Capabilities
                    </span>
                </div>
                <h2 className="text-foreground mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Built for the real world
                </h2>
                <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                    Every feature you need to take AI agents from prototype to production.
                </p>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {capabilities.map((cap) => (
                        <div
                            key={cap.title}
                            className="group border-border/60 bg-card hover:border-primary/20 hover:shadow-primary/5 rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg"
                        >
                            <div className="bg-primary/10 text-primary group-hover:bg-primary/15 mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                                {cap.icon}
                            </div>

                            <h3 className="text-foreground mb-2 text-base font-semibold">
                                {cap.title}
                            </h3>

                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {cap.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
