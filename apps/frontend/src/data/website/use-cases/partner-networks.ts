import type { UseCaseData } from "@/components/website/use-case/use-case-page-template";

export const partnerNetworksData: UseCaseData = {
    slug: "partner-networks",
    vertical: "Partner Networks",
    heroTitle: "AI agents that collaborate across organizational boundaries — securely",
    heroDescription:
        "Enable multi-organization agent networks where each party maintains control over their data, tools, and policies — while agents work together toward shared goals.",
    painPoints: [
        {
            title: "Data sharing paralysis",
            description:
                "Partners need to collaborate on shared projects, but legal and compliance teams block data sharing. Work stalls while teams negotiate access agreements manually."
        },
        {
            title: "Toolchain incompatibility",
            description:
                "Every organization uses different tools — different CRMs, different project management systems, different communication platforms. Integration costs make collaboration prohibitive."
        },
        {
            title: "Trust and governance gaps",
            description:
                "There is no standard way to let a partner's AI agent access your systems with the right level of permission. It is all-or-nothing, which means it is usually nothing."
        }
    ],
    solution: {
        description:
            "AgentC2's federation layer enables secure multi-organization agent collaboration. Each party deploys their own agents with their own policies, and the federation protocol handles trust negotiation, data exposure controls, and audit trails.",
        capabilities: [
            "Federated agent discovery across organizational boundaries",
            "Per-field data exposure controls (full, masked, redacted)",
            "Cryptographic request signing and verification",
            "PII scanning on all cross-boundary data transfers",
            "Rate limiting and circuit breakers per partner",
            "Complete audit trail of every cross-org interaction"
        ]
    },
    agentExamples: [
        {
            name: "Supply Chain Coordinator",
            description:
                "Coordinates across manufacturer, distributor, and retailer agents. Shares inventory levels, demand forecasts, and delivery schedules without exposing pricing or cost data.",
            tools: ["n8n", "Google Drive", "Slack"],
            channels: ["API", "Slack"],
            guardrails: ["No cost data exposure", "Rate limit: 100 req/min"]
        },
        {
            name: "Consulting Engagement Agent",
            description:
                "Enables consulting firms to deploy agents that access client systems with scoped permissions. Client retains full control over what data the consultant's agent can see and do.",
            tools: ["Jira", "Google Drive", "Slack"],
            channels: ["Web", "Slack"],
            guardrails: ["Client-side approval for writes", "Session time limits"]
        },
        {
            name: "Agency Campaign Agent",
            description:
                "Marketing agencies deploy campaign agents that access client ad platforms, CRMs, and analytics — with the client controlling budget caps, audience data exposure, and approval workflows.",
            tools: ["HubSpot", "Google Drive", "Slack"],
            channels: ["Web", "Slack", "Email"],
            guardrails: ["Budget cap per campaign", "PII masking on audience data"]
        }
    ],
    integrations: [
        "HubSpot",
        "Jira",
        "Slack",
        "Google Drive",
        "n8n",
        "Firecrawl",
        "GitHub",
        "Dropbox",
        "Gmail",
        "Fathom"
    ],
    ctaTitle: "Unlock cross-organization AI collaboration"
};
