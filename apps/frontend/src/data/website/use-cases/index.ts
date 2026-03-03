import type { UseCaseData } from "@/components/website/use-case/use-case-page-template"
import { salesData } from "./sales"
import { supportData } from "./support"
import { engineeringData } from "./engineering"
import { constructionData } from "./construction"
import { operationsData } from "./operations"
import { partnerNetworksData } from "./partner-networks"

export const useCaseDataMap: Record<string, UseCaseData> = {
    sales: salesData,
    support: supportData,
    engineering: engineeringData,
    construction: constructionData,
    operations: operationsData,
    "partner-networks": partnerNetworksData,
}

export const useCaseSlugs = Object.keys(useCaseDataMap)

export interface UseCaseCard {
    slug: string
    vertical: string
    title: string
    description: string
    integrations: string[]
}

export const useCaseCards: UseCaseCard[] = [
    {
        slug: "sales",
        vertical: "Sales & Revenue",
        title: "Sales agents that close deals",
        description:
            "Automate pipeline management, prospect research, and outreach coordination with AI agents plugged into your CRM.",
        integrations: ["HubSpot", "Gmail", "Slack"],
    },
    {
        slug: "support",
        vertical: "Customer Support",
        title: "Support on every channel",
        description:
            "Deploy AI agents across web, Slack, WhatsApp, and voice with RAG-powered knowledge that stays current.",
        integrations: ["Jira", "Slack", "Zendesk"],
    },
    {
        slug: "engineering",
        vertical: "Engineering & DevOps",
        title: "Engineering agents that ship",
        description:
            "Automate ticket triage, PR reviews, and incident response within your existing GitHub and Jira workflows.",
        integrations: ["GitHub", "Jira", "Slack"],
    },
    {
        slug: "construction",
        vertical: "Construction & AEC",
        title: "Agents for the jobsite",
        description:
            "Query BIM models, automate takeoffs, detect clashes, and coordinate field teams with AI agents built for AEC.",
        integrations: ["Autodesk", "Procore", "Jira"],
    },
    {
        slug: "operations",
        vertical: "Operations",
        title: "Operations on autopilot",
        description:
            "Orchestrate campaigns, manage schedules, and monitor operational health with agents that take action across your stack.",
        integrations: ["Jira", "Slack", "n8n"],
    },
    {
        slug: "partner-networks",
        vertical: "Partner Networks",
        title: "Cross-org collaboration",
        description:
            "Enable multi-organization agent networks where each party maintains control over data, tools, and policies.",
        integrations: ["Federation", "Slack", "HubSpot"],
    },
]
