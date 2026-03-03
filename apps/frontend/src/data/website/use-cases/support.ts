import type { UseCaseData } from "@/components/website/use-case/use-case-page-template"

export const supportData: UseCaseData = {
    slug: "support",
    vertical: "Customer Support",
    heroTitle:
        "Support agents on every channel, with knowledge that never goes stale",
    heroDescription:
        "Deploy AI support agents across web chat, Slack, WhatsApp, and voice that resolve tickets autonomously using your actual documentation, not hallucinated answers.",
    painPoints: [
        {
            title: "Knowledge base lag",
            description:
                "Documentation is always out of date. Support reps and chatbots give outdated answers because the knowledge base lags product releases by weeks.",
        },
        {
            title: "Channel fragmentation",
            description:
                "Customers contact you via email, chat, Slack, and phone — but each channel has a different bot with different capabilities and inconsistent answers.",
        },
        {
            title: "Escalation black holes",
            description:
                "When AI can't resolve an issue, the handoff to a human is clumsy. Context is lost, customers repeat themselves, and SLAs are breached.",
        },
    ],
    solution: {
        description:
            "AgentC2 provides a unified support agent stack that ingests your docs via RAG, deploys to every channel simultaneously, and escalates with full context — governed by response-quality guardrails.",
        capabilities: [
            "RAG-powered answers from your docs, Notion, and Confluence",
            "Unified agent deployed across web, Slack, email, and voice",
            "Smart escalation with full conversation context preserved",
            "Auto-categorization and priority scoring for incoming tickets",
            "Continuous learning from resolved tickets to improve accuracy",
            "CSAT and response-quality scoring on every interaction",
        ],
    },
    agentExamples: [
        {
            name: "Frontline Support",
            description:
                "Handles first-touch support across all channels. Uses RAG to search documentation, resolves common issues autonomously, and collects context for escalation.",
            tools: ["RAG", "Jira", "Slack"],
            channels: ["Web", "Slack", "WhatsApp", "Voice"],
            guardrails: [
                "No PII in logs",
                "Confidence threshold > 0.8",
            ],
        },
        {
            name: "Escalation Agent",
            description:
                "Receives escalated tickets with full context, routes to the right team based on issue taxonomy, and follows up until resolution is confirmed.",
            tools: ["Jira", "Slack", "Gmail"],
            channels: ["Slack", "Email"],
            guardrails: ["SLA enforcement", "Manager notify on breach"],
        },
        {
            name: "Knowledge Curator",
            description:
                "Monitors resolved tickets, identifies documentation gaps, drafts knowledge base updates, and submits them for human review before publishing.",
            tools: ["RAG", "Google Drive", "Firecrawl"],
            channels: ["Web", "API"],
            guardrails: ["Human approval before publish"],
        },
    ],
    integrations: [
        "Jira",
        "Slack",
        "Zendesk",
        "Intercom",
        "Gmail",
        "Google Drive",
        "Notion",
        "Confluence",
        "Firecrawl",
        "Fathom",
    ],
    ctaTitle: "Resolve tickets faster on every channel",
}
