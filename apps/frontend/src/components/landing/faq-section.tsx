"use client";

import { useState } from "react";

export const landingFaqs = [
    {
        question: "What is AgentC2?",
        answer: "AgentC2 is an enterprise AI agent platform that lets businesses build, deploy, and orchestrate intelligent agents at scale. Unlike consumer chatbots, AgentC2 agents connect to your business systems (CRM, project management, email, knowledge bases), run autonomously on schedules and triggers, and come with full observability, traceability, and governance controls."
    },
    {
        question: "How is AgentC2 different from ChatGPT or Claude?",
        answer: "ChatGPT and Claude are consumer chat products. AgentC2 is enterprise agent infrastructure \u2014 a different category entirely. You deploy multiple specialized agents across your organization, each connected to your real business tools via MCP. Agents run in the background on schedules, execute multi-step workflows with human approval gates, and improve automatically through continuous learning. Plus you get full cost tracking, audit logs, version control, and role-based access \u2014 everything a business needs to deploy AI responsibly."
    },
    {
        question: "What business tools does AgentC2 connect to?",
        answer: "AgentC2 supports 10+ enterprise integrations out of the box: HubSpot CRM, Jira, Slack, GitHub, Google Drive, Playwright, Firecrawl, JustCall, Fathom, and n8n. We also offer native OAuth for Gmail, Microsoft Outlook (mail + calendar), and Dropbox. All credentials are encrypted with AES-256-GCM at rest, and you can add custom MCP integrations for proprietary systems on Enterprise plans."
    },
    {
        question: "How quickly can we deploy our first agent?",
        answer: "Most teams have their first agent running in under 30 minutes. Describe what your agent should do in plain English, connect your tools with one-click OAuth, and deploy. No ML expertise, no code, no infrastructure setup. The platform handles model selection, memory management, and scaling automatically."
    },
    {
        question: "Is AgentC2 secure enough for enterprise use?",
        answer: "Yes. AgentC2 was built enterprise-first with multi-tenant architecture, workspace isolation, AES-256-GCM credential encryption, guardrail policies for content filtering and PII detection, per-agent budget controls, comprehensive audit logs, and role-based access control. Enterprise and Enterprise+ plans include SSO/SAML, dedicated infrastructure, on-premise deployment options, and custom compliance (SOC 2, HIPAA)."
    },
    {
        question: "How does observability and traceability work?",
        answer: "Every agent run generates a complete execution trace \u2014 every tool call, model generation, token count, and cost is recorded. You can inspect exactly what an agent did, why it made each decision, and how much it cost. Version history tracks every configuration change with instant rollback. Audit logs provide a compliance-ready record of all platform activity. Continuous learning uses these signals to automatically improve agent performance over time."
    }
];

export function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section id="faq" className="scroll-mt-20 py-24">
            <div className="mx-auto max-w-3xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        FAQ
                    </span>
                </div>
                <h2 className="text-foreground mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Frequently asked questions
                </h2>

                <div className="divide-border/60 divide-y">
                    {landingFaqs.map((faq, i) => (
                        <div key={faq.question} className="py-5">
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="flex w-full items-start justify-between gap-4 text-left"
                            >
                                <span className="text-foreground text-base font-medium">
                                    {faq.question}
                                </span>
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className={`text-muted-foreground mt-1 shrink-0 transition-transform duration-200 ${
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
                                    <p className="text-muted-foreground pt-3 text-sm leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
