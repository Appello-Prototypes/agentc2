import type { UseCaseData } from "@/components/website/use-case/use-case-page-template";

export const salesData: UseCaseData = {
    slug: "sales",
    vertical: "Sales & Revenue",
    heroTitle: "Sales agents that close deals, not just generate text",
    heroDescription:
        "Automate pipeline management, prospect research, and outreach coordination with AI agents that integrate directly into your CRM, email, and communication stack.",
    painPoints: [
        {
            title: "Manual CRM hygiene",
            description:
                "Reps spend 30% of their time updating Salesforce and HubSpot instead of selling. Data decays, stages go stale, and forecasts become guesswork."
        },
        {
            title: "Shallow prospect research",
            description:
                "Generic outreach gets ignored. Reps lack the time to research every prospect's tech stack, recent funding, and competitive landscape before first contact."
        },
        {
            title: "Handoff and follow-up gaps",
            description:
                "Leads fall through the cracks between SDR qualification, AE handoff, and post-demo follow-up. No system enforces the sequence end-to-end."
        }
    ],
    solution: {
        description:
            "AgentC2 deploys autonomous sales agents that keep your pipeline clean, research every prospect deeply, and coordinate multi-touch outreach sequences — all governed by your playbooks and guardrails.",
        capabilities: [
            "Auto-enrich contacts and companies from web + CRM data",
            "Stage progression based on meeting outcomes and email signals",
            "Multi-channel outreach via email, Slack, and SMS",
            "Budget guardrails to cap AI spend per deal stage",
            "Real-time deal-risk scoring with escalation to managers",
            "Full audit trail of every agent action for compliance"
        ]
    },
    agentExamples: [
        {
            name: "Pipeline Manager",
            description:
                "Monitors deal stages in HubSpot, flags stale opportunities, auto-updates fields based on meeting outcomes, and alerts reps when deals need attention.",
            tools: ["HubSpot", "Slack", "Gmail"],
            channels: ["Slack", "Web"],
            guardrails: ["No deal deletion", "Manager approval > $50k"]
        },
        {
            name: "Research Agent",
            description:
                "Scrapes prospect websites, LinkedIn, and news to build comprehensive company profiles and personalized talking points before every call.",
            tools: ["Firecrawl", "Google Drive", "HubSpot"],
            channels: ["Web", "API"]
        },
        {
            name: "Outreach Coordinator",
            description:
                "Sequences multi-touch outreach across email and Slack, personalizes messaging from research data, and adapts cadence based on engagement signals.",
            tools: ["Gmail", "HubSpot", "Slack"],
            channels: ["Email", "Slack"],
            guardrails: ["Max 3 touches/week", "Opt-out compliance"]
        }
    ],
    integrations: [
        "HubSpot",
        "Salesforce",
        "Gmail",
        "Outlook",
        "Slack",
        "LinkedIn",
        "Firecrawl",
        "Google Drive",
        "Jira",
        "Fathom"
    ],
    ctaTitle: "Turn your sales team into a revenue machine"
};
