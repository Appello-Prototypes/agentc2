"use client";

import { useState } from "react";
import Link from "next/link";

const TABS = [
    {
        id: "sales",
        label: "Sales & Revenue",
        paragraph:
            "CRM agents across HubSpot and Salesforce, pipeline management, and automated outreach — deployed to Slack and email.",
        bullets: [
            "HubSpot and Salesforce integration via MCP",
            "Automated deal tracking and follow-up drafting",
            "Campaign-based outreach with Mission Command",
            "Knowledge-powered objection handling"
        ],
        href: "/use-cases/sales"
    },
    {
        id: "support",
        label: "Customer Support",
        paragraph:
            "Multi-channel support agents with knowledge-powered responses, escalation workflows, and guardrails — across web, WhatsApp, Telegram, and Slack.",
        bullets: [
            "Deploy to web, WhatsApp, Telegram, Slack, and voice simultaneously",
            "RAG pipeline keeps knowledge current",
            "Guardrails block PII and enforce quality",
            "Escalation to human agents via workflows"
        ],
        href: "/use-cases/support"
    },
    {
        id: "engineering",
        label: "Engineering",
        paragraph:
            "Dark Factory coding pipeline, Jira triage, GitHub automation, and build verification with ephemeral compute.",
        bullets: [
            "Autonomous ticket-to-deploy pipeline",
            "Risk-gated autonomy (5 levels)",
            "Ephemeral DigitalOcean build environments",
            "Trust scoring before merge"
        ],
        href: "/use-cases/engineering"
    },
    {
        id: "operations",
        label: "Operations",
        paragraph:
            "Campaign execution with Mission Command, scheduling, cross-department coordination, and full observability.",
        bullets: [
            "Autonomous multi-mission campaign execution",
            "Full run, trace, and tool call observability",
            "Budget enforcement at every level",
            "Continuous learning with After Action Reviews"
        ],
        href: "/use-cases/operations"
    },
    {
        id: "construction",
        label: "Construction",
        paragraph:
            "BIM agents that parse IFC models, perform takeoffs, detect clashes, and connect to field management tools.",
        bullets: [
            "IFC model parsing and element queries",
            "Automated quantity takeoffs by category",
            "Clash detection and version diff reports",
            "Field coordination via WhatsApp and Telegram"
        ],
        href: "/use-cases/construction"
    },
    {
        id: "partner-networks",
        label: "Partner Networks",
        paragraph:
            "Federation-powered agent collaboration across organizations with encrypted channels and agent discovery.",
        bullets: [
            "Encrypted cross-org agent communication",
            "Fine-grained exposure controls",
            "PII scanning with data classification tiers",
            "Rate limits and circuit breakers"
        ],
        href: "/use-cases/partner-networks"
    }
];

function CheckIcon() {
    return (
        <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );
}

export function UseCaseTabs() {
    const [activeTab, setActiveTab] = useState(TABS[0].id);
    const activeData = TABS.find((t) => t.id === activeTab) ?? TABS[0];

    return (
        <section className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        USE CASES
                    </span>
                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                        From sales to engineering to operations
                    </h2>
                </div>

                <div className="border-border/40 mt-8 flex flex-wrap justify-center border-b pb-0">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={
                                activeTab === tab.id
                                    ? "border-primary text-primary border-b-2 px-4 py-2.5 text-sm font-medium"
                                    : "text-muted-foreground hover:text-foreground px-4 py-2.5 text-sm font-medium transition-colors"
                            }
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="mx-auto mt-8 max-w-3xl">
                    <p className="text-muted-foreground mb-4 text-base leading-relaxed">
                        {activeData.paragraph}
                    </p>
                    <ul className="space-y-2.5">
                        {activeData.bullets.map((bullet) => (
                            <li
                                key={bullet}
                                className="text-muted-foreground flex items-start gap-2 text-sm"
                            >
                                <CheckIcon />
                                <span>{bullet}</span>
                            </li>
                        ))}
                    </ul>
                    <Link
                        href={activeData.href}
                        className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
                    >
                        Learn more →
                    </Link>
                </div>
            </div>
        </section>
    );
}
