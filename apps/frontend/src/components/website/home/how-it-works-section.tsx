const steps = [
    {
        title: "Connect",
        description:
            "Link your tools. Gmail, Slack, HubSpot, Jira — OAuth or API key. Encrypted and isolated per organization."
    },
    {
        title: "Deploy",
        description:
            "Create agents from scratch or install from the Playbook Marketplace. Attach skills, knowledge, and workflows."
    },
    {
        title: "Govern & Scale",
        description:
            "Set guardrails, budgets, and permissions. Monitor runs. Let the learning loop improve your agents continuously."
    }
];

function ArrowConnector() {
    return (
        <svg
            className="text-border h-6 w-12 shrink-0"
            viewBox="0 0 48 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 4"
        >
            <path d="M0 12 L44 12" />
            <path d="M40 8 L44 12 L40 16" />
        </svg>
    );
}

export function HowItWorksSection() {
    const items: Array<
        { type: "card"; step: (typeof steps)[0]; index: number } | { type: "arrow" }
    > = [];
    steps.forEach((step, i) => {
        items.push({ type: "card", step, index: i });
        if (i < steps.length - 1) items.push({ type: "arrow" });
    });

    return (
        <section id="how-it-works" className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary mb-2 block text-xs font-semibold tracking-wider uppercase">
                        GET STARTED
                    </span>
                    <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                        Production-ready in minutes
                    </h2>
                </div>
                <div className="relative mt-16 grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                    {items.map((item, i) =>
                        item.type === "card" ? (
                            <div
                                key={i}
                                className="border-border/60 bg-card rounded-2xl border p-6 text-center"
                            >
                                <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
                                    {item.index + 1}
                                </div>
                                <h3 className="text-foreground mb-3 text-lg font-semibold">
                                    {item.step.title}
                                </h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {item.step.description}
                                </p>
                            </div>
                        ) : (
                            <div
                                key={i}
                                className="hidden items-center justify-center py-6 md:flex"
                            >
                                <ArrowConnector />
                            </div>
                        )
                    )}
                </div>
            </div>
        </section>
    );
}
