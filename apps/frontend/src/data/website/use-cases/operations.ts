import type { UseCaseData } from "@/components/website/use-case/use-case-page-template"

export const operationsData: UseCaseData = {
    slug: "operations",
    vertical: "Operations",
    heroTitle:
        "Operations agents that execute campaigns, not just answer questions",
    heroDescription:
        "Orchestrate cross-functional campaigns, manage schedules, and monitor operational health with AI agents that take action across your entire tool stack.",
    painPoints: [
        {
            title: "Campaign coordination chaos",
            description:
                "Launching a campaign requires syncing across marketing, sales, product, and ops — with tasks spread across Jira, Slack, email, and spreadsheets. Balls get dropped every time.",
        },
        {
            title: "Observability blind spots",
            description:
                "You have dashboards for everything, but nobody watches them all. Issues surface when customers complain, not when metrics first deviate.",
        },
        {
            title: "Manual process orchestration",
            description:
                "Repetitive workflows — onboarding, provisioning, reporting — are held together by tribal knowledge and manual checklists. When people leave, processes break.",
        },
    ],
    solution: {
        description:
            "AgentC2 deploys operations agents that coordinate multi-team campaigns, monitor system health proactively, and automate recurring workflows — all with human-in-the-loop governance for critical decisions.",
        capabilities: [
            "Cross-functional campaign orchestration across teams",
            "Proactive monitoring with anomaly detection and alerts",
            "Automated recurring workflows with exception handling",
            "Schedule management across time zones and teams",
            "Budget tracking with spend alerts and approval workflows",
            "Post-mortem generation from incident timelines",
        ],
    },
    agentExamples: [
        {
            name: "Campaign Coordinator",
            description:
                "Orchestrates product launches and marketing campaigns across teams. Creates tasks in Jira, sends reminders in Slack, tracks milestones, and generates status reports.",
            tools: ["Jira", "Slack", "Gmail", "Google Drive"],
            channels: ["Slack", "Web"],
            guardrails: ["Budget cap enforcement", "Approval for external comms"],
        },
        {
            name: "Schedule Manager",
            description:
                "Manages team schedules, meeting coordination, and resource allocation. Identifies conflicts, suggests optimal meeting times, and sends calendar invites automatically.",
            tools: ["Google Calendar", "Slack", "Gmail"],
            channels: ["Slack", "Web", "Email"],
        },
        {
            name: "Observability Agent",
            description:
                "Monitors operational metrics, detects anomalies before they become incidents, correlates signals across systems, and triggers response playbooks automatically.",
            tools: ["n8n", "Slack", "Jira"],
            channels: ["Slack", "API"],
            guardrails: ["Alert dedup", "Escalation after 2 missed acks"],
        },
    ],
    integrations: [
        "Jira",
        "Slack",
        "Gmail",
        "Google Drive",
        "Google Calendar",
        "n8n",
        "Datadog",
        "PagerDuty",
        "Notion",
        "Fathom",
    ],
    ctaTitle: "Run operations on autopilot with AI agents",
}
