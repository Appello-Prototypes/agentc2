import type { UseCaseData } from "@/components/website/use-case/use-case-page-template";

export const engineeringData: UseCaseData = {
    slug: "engineering",
    vertical: "Engineering & DevOps",
    heroTitle: "Engineering agents that ship code, not just write it",
    heroDescription:
        "Automate ticket triage, PR reviews, incident response, and release pipelines with AI agents that understand your codebase, infrastructure, and team workflows.",
    painPoints: [
        {
            title: "Ticket triage overhead",
            description:
                "Engineers waste hours each sprint manually triaging bug reports, duplicating detection, and assigning priority. By the time a ticket is routed, the context is cold."
        },
        {
            title: "Slow code review cycles",
            description:
                "PRs sit in review queues for days. Reviewers context-switch constantly, miss subtle issues, and leave drive-by approvals that let bugs through."
        },
        {
            title: "Incident response chaos",
            description:
                "When production breaks, engineers scramble to correlate logs, identify root causes, and coordinate fixes across teams — all under pressure with no standard playbook."
        }
    ],
    solution: {
        description:
            "AgentC2 deploys engineering agents that triage tickets intelligently, review PRs for security and performance issues, and orchestrate incident response — all within your existing GitHub, Jira, and Slack workflows.",
        capabilities: [
            "Auto-triage and deduplicate Jira tickets with priority scoring",
            "PR review agents that check for security, performance, and style",
            "Dark Factory pipeline for autonomous task execution",
            "Incident correlation across logs, metrics, and recent deploys",
            "Sprint planning assistance based on velocity and capacity",
            "Full audit trail of every automated engineering action"
        ]
    },
    agentExamples: [
        {
            name: "Ticket Triage",
            description:
                "Monitors incoming Jira tickets, detects duplicates, assigns priority and component labels, routes to the right team, and summarizes context for the assignee.",
            tools: ["Jira", "GitHub", "Slack"],
            channels: ["Slack", "Web"],
            guardrails: ["No auto-close without confirmation"]
        },
        {
            name: "Dark Factory Pipeline",
            description:
                "Picks up approved tickets, generates implementation plans, writes code, runs tests, and opens PRs — all autonomously within guardrails defined by your team.",
            tools: ["GitHub", "Jira", "n8n"],
            channels: ["API", "Slack"],
            guardrails: ["Human approval before merge", "Test coverage > 80%"]
        },
        {
            name: "PR Review Agent",
            description:
                "Reviews pull requests for security vulnerabilities, performance regressions, code style violations, and architectural concerns. Posts structured feedback as inline comments.",
            tools: ["GitHub", "Firecrawl", "RAG"],
            channels: ["GitHub", "Slack"],
            guardrails: ["Advisory only — no auto-merge"]
        }
    ],
    integrations: [
        "GitHub",
        "Jira",
        "Slack",
        "n8n",
        "Datadog",
        "PagerDuty",
        "Firecrawl",
        "Google Drive",
        "Confluence",
        "GitLab"
    ],
    ctaTitle: "Ship faster with agents that handle the toil"
};
