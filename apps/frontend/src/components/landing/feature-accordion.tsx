"use client";

import { useState } from "react";

const features = [
    {
        title: "Deploy specialized agents",
        description:
            "Create database-driven agents with full version control and rollback. Choose from multiple LLM providers — OpenAI, Anthropic, or bring your own. Each agent gets persistent memory, semantic recall, and structured output validation.",
        highlights: [
            "Multi-provider LLM support (GPT-4o, Claude, and more)",
            "Version control with instant rollback",
            "Persistent memory and semantic recall",
            "Structured outputs with Zod schema validation",
            "Agent evaluation and quality scoring"
        ],
        visual: "agents"
    },
    {
        title: "Orchestrate with workflows and networks",
        description:
            "Go beyond single-agent chat. Build visual workflows with branching, loops, and human-in-the-loop approval. Create multi-agent networks where an LLM router delegates tasks to specialized agents in real time.",
        highlights: [
            "Visual drag-and-drop workflow builder",
            "Multi-agent networks with LLM-based routing",
            "Human-in-the-loop approval steps",
            "Parallel execution and conditional branching",
            "Workflow suspension and resumption"
        ],
        visual: "workflows"
    },
    {
        title: "Connect to everything",
        description:
            "Agents access 10+ integrations out of the box via MCP: CRM, project management, email, files, meetings, and more. Deploy agents to Slack, WhatsApp, Telegram, voice calls, or embed via API.",
        highlights: [
            "10+ MCP integrations: HubSpot, Jira, Slack, GitHub, and more",
            "Native OAuth: Gmail, Outlook, Dropbox",
            "Multi-channel: Slack, WhatsApp, Telegram, Voice, Email",
            "Webhook triggers and cron-based scheduling",
            "Encrypted credential storage (AES-256-GCM)"
        ],
        visual: "integrations"
    }
];

export function FeatureAccordion() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section id="features" className="scroll-mt-20 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        Platform
                    </span>
                </div>
                <h2 className="text-foreground mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Everything you need to build AI agents
                </h2>
                <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
                    From single agents to orchestrated teams, AgentC2 gives you the building blocks
                    for production-grade AI systems.
                </p>

                <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
                    {/* Accordion panels */}
                    <div className="flex flex-col gap-2">
                        {features.map((feature, i) => (
                            <div
                                key={feature.title}
                                className={`border-border/60 overflow-hidden rounded-xl border transition-all duration-300 ${
                                    openIndex === i ? "bg-card shadow-md" : "hover:bg-muted/30"
                                }`}
                            >
                                <button
                                    onClick={() => setOpenIndex(i)}
                                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                                >
                                    <span
                                        className={`text-base font-semibold transition-colors ${
                                            openIndex === i
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {feature.title}
                                    </span>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`text-muted-foreground shrink-0 transition-transform duration-300 ${
                                            openIndex === i ? "rotate-180" : ""
                                        }`}
                                    >
                                        <path
                                            d="M5 8l5 5 5-5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>

                                <div
                                    className={`grid transition-all duration-300 ${
                                        openIndex === i
                                            ? "grid-rows-[1fr] opacity-100"
                                            : "grid-rows-[0fr] opacity-0"
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="px-6 pb-6">
                                            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                                                {feature.description}
                                            </p>
                                            <ul className="space-y-2">
                                                {feature.highlights.map((item) => (
                                                    <li
                                                        key={item}
                                                        className="text-foreground flex items-start gap-2 text-sm"
                                                    >
                                                        <svg
                                                            className="text-primary mt-0.5 h-4 w-4 shrink-0"
                                                            viewBox="0 0 16 16"
                                                            fill="currentColor"
                                                        >
                                                            <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.22 4.97a.75.75 0 00-1.06-1.06L7.22 7.85 5.84 6.47a.75.75 0 10-1.06 1.06l1.91 1.91a.75.75 0 001.06 0l3.47-3.47z" />
                                                        </svg>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Visual placeholder */}
                    <div className="hidden lg:block">
                        <div className="bg-muted/30 border-border/40 sticky top-24 flex aspect-4/3 items-center justify-center rounded-2xl border">
                            <FeatureVisual type={features[openIndex]!.visual} />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function FeatureVisual({ type }: { type: string }) {
    if (type === "agents") {
        return (
            <div className="flex flex-col items-center gap-4 p-8">
                <div className="flex gap-4">
                    {["Research", "Support", "Sales"].map((name) => (
                        <div
                            key={name}
                            className="bg-background border-border flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border shadow-sm"
                        >
                            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold">
                                {name[0]}
                            </div>
                            <span className="text-muted-foreground text-[10px]">{name}</span>
                        </div>
                    ))}
                </div>
                <div className="text-muted-foreground/40 text-xs">
                    v3.2 &middot; GPT-4o &middot; Memory enabled
                </div>
                <div className="flex gap-2">
                    {["Active", "v3.2", "98% quality"].map((badge) => (
                        <span
                            key={badge}
                            className="bg-primary/5 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                        >
                            {badge}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    if (type === "workflows") {
        return (
            <div className="flex flex-col items-center gap-6 p-8">
                {/* Mini workflow diagram */}
                <div className="flex items-center gap-3">
                    <WorkflowNode
                        label="Start"
                        color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    />
                    <Arrow />
                    <WorkflowNode label="Agent" color="bg-primary/10 text-primary" />
                    <Arrow />
                    <div className="flex flex-col gap-2">
                        <WorkflowNode
                            label="Approve"
                            color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        />
                        <WorkflowNode
                            label="Reject"
                            color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        />
                    </div>
                    <Arrow />
                    <WorkflowNode
                        label="Done"
                        color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    />
                </div>
                <div className="text-muted-foreground/40 text-xs">
                    Visual workflow with human-in-the-loop
                </div>
            </div>
        );
    }

    // integrations
    return (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-8">
            {[
                "HubSpot",
                "Jira",
                "Slack",
                "GitHub",
                "Gmail",
                "Voice",
                "WhatsApp",
                "Dropbox",
                "Telegram"
            ].map((name) => (
                <div
                    key={name}
                    className="bg-background border-border flex h-16 flex-col items-center justify-center gap-1 rounded-xl border shadow-sm"
                >
                    <span className="text-foreground text-xs font-medium">{name}</span>
                </div>
            ))}
        </div>
    );
}

function WorkflowNode({ label, color }: { label: string; color: string }) {
    return (
        <div
            className={`flex h-10 items-center justify-center rounded-lg px-3 text-xs font-medium ${color}`}
        >
            {label}
        </div>
    );
}

function Arrow() {
    return (
        <svg
            width="20"
            height="12"
            viewBox="0 0 20 12"
            fill="none"
            className="text-border shrink-0"
        >
            <path
                d="M0 6h16m0 0l-4-4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
