import type { UseCaseData } from "@/components/website/use-case/use-case-page-template";

export const constructionData: UseCaseData = {
    slug: "construction",
    vertical: "Construction & AEC",
    heroTitle: "Construction agents that read blueprints, not just spreadsheets",
    heroDescription:
        "Deploy AI agents that query BIM models, automate takeoffs, detect clashes, and coordinate field teams — bridging the gap between digital design and physical construction.",
    painPoints: [
        {
            title: "BIM data silos",
            description:
                "Critical project information is locked in Revit models, PDF drawings, and spreadsheets. Teams spend hours manually extracting quantities and cross-referencing specs."
        },
        {
            title: "Clash detection bottlenecks",
            description:
                "Coordination issues between structural, MEP, and architectural models are caught too late — during construction, not during design. Rework costs spiral."
        },
        {
            title: "Field-to-office communication gaps",
            description:
                "Field teams report issues via photos and text messages that never make it into the project management system. RFIs pile up, submittals stall, and schedules slip."
        },
        {
            title: "Estimating inaccuracy",
            description:
                "Manual takeoffs are error-prone and time-consuming. Quantity surveyors spend weeks on estimates that could be partially automated from model data."
        }
    ],
    solution: {
        description:
            "AgentC2 provides construction-specific AI agents that integrate with your BIM tools, project management platforms, and field communication channels — turning unstructured project data into actionable intelligence.",
        capabilities: [
            "Natural language queries against BIM model data",
            "Automated quantity takeoffs from model elements",
            "Cross-discipline clash detection and resolution tracking",
            "Field coordination via WhatsApp, Slack, and voice",
            "RFI drafting and submittal tracking automation",
            "Budget vs. actuals monitoring with variance alerts"
        ]
    },
    agentExamples: [
        {
            name: "BIM Query Agent",
            description:
                "Answers natural language questions about BIM models — element counts, material specifications, spatial relationships — without requiring engineers to open Revit.",
            tools: ["RAG", "Google Drive", "Firecrawl"],
            channels: ["Web", "Slack"]
        },
        {
            name: "Takeoff Agent",
            description:
                "Extracts quantities from model data and drawing PDFs, cross-references with specification documents, and produces structured takeoff reports for estimators.",
            tools: ["RAG", "Google Drive"],
            channels: ["Web", "API"],
            guardrails: ["Human verification required", "Tolerance ±5%"]
        },
        {
            name: "Clash Detection Agent",
            description:
                "Analyzes coordination models for spatial conflicts between disciplines, categorizes clashes by severity, and assigns resolution tasks to the responsible teams.",
            tools: ["Jira", "Google Drive", "Slack"],
            channels: ["Web", "Slack"],
            guardrails: ["Critical clashes escalate immediately"]
        },
        {
            name: "Field Coordination Agent",
            description:
                "Receives field reports via WhatsApp and voice, extracts structured data, creates Jira tickets for issues, and updates the project schedule with progress information.",
            tools: ["Jira", "Slack", "Google Drive"],
            channels: ["WhatsApp", "Voice", "Slack"]
        }
    ],
    integrations: [
        "Autodesk",
        "Revit",
        "Procore",
        "PlanGrid",
        "Jira",
        "Google Drive",
        "Slack",
        "WhatsApp",
        "Firecrawl",
        "Dropbox"
    ],
    ctaTitle: "Build smarter with AI agents on the jobsite"
};
