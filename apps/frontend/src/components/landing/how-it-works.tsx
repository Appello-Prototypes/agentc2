const steps = [
    {
        number: "01",
        title: "Build",
        description:
            "Create agents with natural language instructions. Connect tools from 10+ integrations, configure memory, and set up structured outputs — all from a single dashboard.",
        icon: (
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="4" y="4" width="24" height="24" rx="4" />
                <path d="M12 10l-4 6 4 6" />
                <path d="M20 10l4 6-4 6" />
                <path d="M17 8l-2 16" />
            </svg>
        )
    },
    {
        number: "02",
        title: "Deploy",
        description:
            "Publish agents to Slack, WhatsApp, email, voice, or embed in your product via API. Set up cron schedules, webhook triggers, and automated workflows.",
        icon: (
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M16 4v16" />
                <path d="M10 14l6 6 6-6" />
                <path d="M6 24h20" />
                <path d="M6 28h20" />
            </svg>
        )
    },
    {
        number: "03",
        title: "Learn",
        description:
            "Agents improve automatically through continuous learning. Performance signals trigger A/B experiments, and winning variants are promoted — with human approval for high-risk changes.",
        icon: (
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="16" cy="16" r="12" />
                <path d="M16 10v6l4 4" />
                <path d="M22 6l2-2" />
                <path d="M10 6L8 4" />
            </svg>
        )
    }
];

export function HowItWorks() {
    return (
        <section className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        How It Works
                    </span>
                </div>
                <h2 className="text-foreground mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Three steps to production
                </h2>
                <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                    Go from idea to deployed agent in minutes, not months.
                </p>

                <div className="grid gap-8 md:grid-cols-3 md:gap-6">
                    {steps.map((step, i) => (
                        <div key={step.number} className="relative">
                            {/* Connector line (desktop only) */}
                            {i < steps.length - 1 && (
                                <div className="border-border/60 absolute top-12 left-[calc(50%+64px)] hidden h-px w-[calc(100%-128px)] border-t border-dashed md:block" />
                            )}

                            <div className="bg-background border-border/60 flex flex-col items-center rounded-2xl border p-8 text-center shadow-sm">
                                <div className="text-primary mb-4">{step.icon}</div>

                                <span className="text-primary/60 mb-2 text-xs font-semibold tracking-widest">
                                    STEP {step.number}
                                </span>

                                <h3 className="text-foreground mb-3 text-xl font-bold">
                                    {step.title}
                                </h3>

                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
