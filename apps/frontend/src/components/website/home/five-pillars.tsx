import { cn } from "@repo/ui";

const pillars = [
    {
        title: "Build",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
        features: [
            "Create agents with natural language instructions",
            "Attach skills, knowledge bases, and 200+ MCP tools",
            "Visual workflow and network designers",
            "Model-agnostic: OpenAI, Anthropic, Google"
        ]
    },
    {
        title: "Deploy",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4a5.8 5.8 0 0 1 1 1" />
            </svg>
        ),
        features: [
            "One-click deployment to web, Slack, WhatsApp, voice",
            "White-label embed system for partners",
            "Playbook Marketplace: install pre-built solutions",
            "Event-driven triggers and cron scheduling"
        ]
    },
    {
        title: "Govern",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
        features: [
            "Input/output guardrails (PII, injection, toxicity)",
            "Budget hierarchy: subscription → org → user → agent",
            "Tool permission guards and egress control",
            "Full audit trail with compliance infrastructure"
        ]
    },
    {
        title: "Scale",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
            </svg>
        ),
        features: [
            "Multi-tenant isolation (orgs → workspaces)",
            "Cross-organization federation",
            "Campaign/Mission Command for autonomous execution",
            "Remote compute provisioning"
        ]
    },
    {
        title: "Improve",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
            </svg>
        ),
        features: [
            "Continuous learning: signals → proposals → experiments",
            "Two-tier evaluation (heuristic + LLM)",
            "After Action Reviews with failure taxonomy",
            "Calibration checks (AI vs. human feedback)"
        ]
    }
];

export function FivePillars() {
    return (
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        CAPABILITIES
                    </span>
                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                        The complete stack for AI agent operations
                    </h2>
                </div>
                <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                    {pillars.map((pillar, index) => (
                        <div
                            key={index}
                            className={cn(
                                "border-border/60 bg-card hover:border-primary/20 hover:shadow-primary/5 rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg"
                            )}
                        >
                            <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                                {pillar.icon}
                            </div>
                            <h3 className="text-foreground mb-3 text-lg font-semibold">
                                {pillar.title}
                            </h3>
                            <ul className="space-y-2">
                                {pillar.features.map((feature, i) => (
                                    <li
                                        key={i}
                                        className="text-muted-foreground text-sm leading-relaxed"
                                    >
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
