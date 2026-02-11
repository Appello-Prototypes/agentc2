"use client";

import { useState } from "react";

const faqs = [
    {
        question: "What is AgentC2?",
        answer: "AgentC2 is a production-grade AI agent platform that lets you build, deploy, and orchestrate intelligent agents. Unlike simple chat interfaces, AgentC2 agents connect to your existing tools (CRM, project management, email, etc.), maintain persistent memory, and work across multiple channels including Slack, WhatsApp, voice, and email."
    },
    {
        question: "How is AgentC2 different from ChatGPT or Claude?",
        answer: "ChatGPT and Claude are single-model chat products. AgentC2 is an orchestration platform. You can create multiple specialized agents, each with different LLM backends (OpenAI, Anthropic, or others), connect them to 10+ integrations via MCP, build visual workflows with human-in-the-loop approval, deploy multi-agent networks, and let your agents improve automatically through continuous learning with A/B testing."
    },
    {
        question: "What integrations are supported?",
        answer: "AgentC2 supports 10+ MCP integrations out of the box: HubSpot CRM, Jira, Slack, GitHub, Google Drive, Playwright, Firecrawl, JustCall, Fathom, and n8n. We also offer native OAuth integrations for Gmail, Microsoft Outlook (mail + calendar), and Dropbox. All credentials are encrypted with AES-256-GCM at rest."
    },
    {
        question: "Can I use my own LLM provider?",
        answer: "Yes. AgentC2 supports multiple LLM providers including OpenAI (GPT-4o), Anthropic (Claude Sonnet 4), and Google models. Each agent can use a different provider and model. You can switch providers at any time without changing your agent's instructions or tools."
    },
    {
        question: "How does continuous learning work?",
        answer: "AgentC2 monitors agent performance and automatically detects signals from failed runs, low quality scores, and tool failures. When enough signals accumulate, a learning session generates improvement proposals. These proposals are tested via A/B experiments with shadow traffic. Winning variants can be auto-promoted for low-risk changes, or require human approval for high-risk changes. The entire process is observable through the learning dashboard."
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
                    {faqs.map((faq, i) => (
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
