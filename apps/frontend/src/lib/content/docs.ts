export type DocsPageType = "concept" | "how-to" | "reference" | "tutorial";

export interface DocsPageEntry {
    slug: string;
    section: string;
    title: string;
    description: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: "informational" | "commercial" | "transactional";
    pageType: DocsPageType;
    ctaLabel: string;
    ctaHref: string;
    body: string[];
    relatedSlugs: string[];
    lastUpdated: string;
}

interface SectionSeed {
    section: string;
    defaultPrimaryKeyword: string;
    defaultSecondaryKeywords: string[];
    defaultPageType: DocsPageType;
    pages: string[];
}

const LAST_UPDATED = "2026-02-18";

const SECTION_SEEDS: SectionSeed[] = [
    {
        section: "getting-started",
        defaultPrimaryKeyword: "AI agent platform",
        defaultSecondaryKeywords: ["build AI agents", "deploy AI agents"],
        defaultPageType: "tutorial",
        pages: ["introduction", "quickstart", "architecture", "key-concepts", "first-agent"]
    },
    {
        section: "agents",
        defaultPrimaryKeyword: "AI agent orchestration platform",
        defaultSecondaryKeywords: ["agent orchestration framework", "AI agent builder"],
        defaultPageType: "concept",
        pages: [
            "overview",
            "creating-agents",
            "configuration",
            "model-providers",
            "memory",
            "tools",
            "version-control",
            "budgets-and-costs",
            "guardrails",
            "evaluations",
            "learning",
            "simulations",
            "output-actions",
            "public-embedding",
            "api-reference"
        ]
    },
    {
        section: "skills",
        defaultPrimaryKeyword: "AI agent skills system",
        defaultSecondaryKeywords: ["composable AI skills", "agent competency bundles"],
        defaultPageType: "concept",
        pages: [
            "overview",
            "creating-skills",
            "progressive-disclosure",
            "auto-generated-skills",
            "version-control",
            "api-reference"
        ]
    },
    {
        section: "workflows",
        defaultPrimaryKeyword: "AI workflow orchestration",
        defaultSecondaryKeywords: ["agentic workflow platform", "human in the loop AI"],
        defaultPageType: "how-to",
        pages: [
            "overview",
            "creating-workflows",
            "step-types",
            "control-flow",
            "human-in-the-loop",
            "ai-assisted-design",
            "version-control",
            "api-reference"
        ]
    },
    {
        section: "networks",
        defaultPrimaryKeyword: "multi-agent orchestration",
        defaultSecondaryKeywords: ["AI agent networks", "agent routing topology"],
        defaultPageType: "how-to",
        pages: [
            "overview",
            "topology",
            "creating-networks",
            "ai-assisted-design",
            "version-control",
            "api-reference"
        ]
    },
    {
        section: "integrations",
        defaultPrimaryKeyword: "Model Context Protocol tools",
        defaultSecondaryKeywords: ["MCP integration", "MCP server tutorial"],
        defaultPageType: "reference",
        pages: [
            "overview",
            "model-context-protocol",
            "hubspot",
            "jira",
            "slack",
            "github",
            "gmail",
            "google-drive",
            "google-calendar",
            "microsoft-outlook",
            "microsoft-teams",
            "dropbox",
            "elevenlabs",
            "firecrawl",
            "fathom",
            "justcall",
            "building-custom"
        ]
    },
    {
        section: "channels",
        defaultPrimaryKeyword: "AI agent channels",
        defaultSecondaryKeywords: ["Slack AI agent", "voice AI agent platform"],
        defaultPageType: "how-to",
        pages: ["overview", "slack", "whatsapp", "telegram", "voice", "embed"]
    },
    {
        section: "knowledge",
        defaultPrimaryKeyword: "RAG pipeline for AI agents",
        defaultSecondaryKeywords: ["vector search AI agents", "hybrid search AI"],
        defaultPageType: "reference",
        pages: ["overview", "document-ingestion", "vector-search", "hybrid-search", "api-reference"]
    },
    {
        section: "campaigns",
        defaultPrimaryKeyword: "AI mission command",
        defaultSecondaryKeywords: ["AI campaign orchestration", "after action review AI"],
        defaultPageType: "how-to",
        pages: ["overview", "creating-campaigns", "templates", "after-action-reviews"]
    },
    {
        section: "platform",
        defaultPrimaryKeyword: "enterprise AI agent platform",
        defaultSecondaryKeywords: ["multi-tenant AI platform", "AI agent observability"],
        defaultPageType: "concept",
        pages: [
            "multi-tenancy",
            "authentication",
            "security",
            "observability",
            "federation",
            "triggers-and-schedules",
            "background-jobs",
            "deployment"
        ]
    },
    {
        section: "api-reference",
        defaultPrimaryKeyword: "AI agent API reference",
        defaultSecondaryKeywords: ["agent API", "workflow API"],
        defaultPageType: "reference",
        pages: [
            "agents",
            "workflows",
            "networks",
            "skills",
            "integrations",
            "knowledge",
            "campaigns",
            "platform"
        ]
    },
    {
        section: "guides",
        defaultPrimaryKeyword: "how to build a multi-agent system",
        defaultSecondaryKeywords: ["deploy AI agents production", "AI agent tutorial"],
        defaultPageType: "tutorial",
        pages: [
            "build-a-customer-support-agent",
            "build-a-research-agent",
            "build-a-sales-agent",
            "multi-agent-orchestration",
            "add-voice-to-your-agent",
            "continuous-learning-setup",
            "production-guardrails",
            "migrate-from-langchain"
        ]
    }
];

const docsSlugToCustomBody: Record<string, string[]> = {
    "getting-started/introduction": [
        "AgentC2 is a production AI agent orchestration platform for building, deploying, and continuously improving AI agents across business tools.",
        "Unlike code-only frameworks, AgentC2 is database-driven with version control, rollback, guardrails, evaluations, and multi-tenant governance built in.",
        "This documentation walks through architecture, concepts, and hands-on implementation patterns for production deployments."
    ],
    "getting-started/quickstart": [
        "Create your first agent, attach tools, configure memory, and run your first conversation in minutes.",
        "Then add guardrails, an evaluation scorecard, and publishing controls so your first release is production-safe.",
        "Finally, enable observability and cost tracking to measure quality and spend from day one."
    ],
    "agents/overview": [
        "Agents are the core execution units in AgentC2. Each agent has instructions, model configuration, tools, memory policy, and safety controls.",
        "Every agent is versioned and can be rolled back. This enables safe iteration and auditability for enterprise workflows.",
        "Agent runs generate traces, tool-call logs, and quality data used for optimization and continuous learning."
    ],
    "agents/guardrails": [
        "Guardrails enforce safety and policy constraints on both input and output paths.",
        "AgentC2 supports organization-level and agent-level guardrails for layered governance.",
        "Use guardrails with evaluations and approval workflows to reduce risk for production automation."
    ],
    "agents/evaluations": [
        "Evaluations score run quality with configurable scorers, themes, and scorecards.",
        "Use evaluation runs to compare versions and detect regressions before broad rollout.",
        "Pair evaluations with learning experiments to promote only validated changes."
    ],
    "agents/learning": [
        "Learning sessions analyze production runs, extract signals, and generate improvement proposals.",
        "Low-risk changes can auto-promote while high-risk changes require human approval.",
        "This creates a controlled self-improving system with measurable quality impact."
    ],
    "agents/version-control": [
        "Every meaningful change to an agent can be captured in a version with metadata and rationale.",
        "Use rollback for instant recovery and side-by-side comparison to understand performance deltas.",
        "Version discipline is a key differentiator for production AI operations."
    ],
    "integrations/model-context-protocol": [
        "Model Context Protocol (MCP) standardizes how agents discover and invoke tools across external systems.",
        "AgentC2 combines MCP servers with native OAuth integrations to support enterprise toolchains.",
        "This page explains architecture, credential handling, and operational best practices."
    ],
    "integrations/slack": [
        "Deploy agents into Slack for threaded team collaboration with memory and routing support.",
        "Configure agent identities, channel behavior, and safe defaults before launch.",
        "Use observability and guardrails to monitor production message workflows."
    ],
    "integrations/hubspot": [
        "Connect HubSpot to let agents query contacts, companies, and deals inside controlled workflows.",
        "Use scoped credentials and audited actions for enterprise compliance.",
        "Pair CRM integrations with campaign orchestration and approval checkpoints."
    ],
    "workflows/overview": [
        "Workflows orchestrate multi-step logic across tools, agents, conditions, loops, and approvals.",
        "Use workflows for repeatable operations that require reliability and visibility.",
        "Version, test, and monitor workflows as first-class production assets."
    ],
    "networks/overview": [
        "Networks coordinate multiple agents and workflow primitives using route-aware orchestration.",
        "Design topologies for delegation, specialization, and dynamic decisioning at runtime.",
        "Use traces and metrics to continuously improve routing quality."
    ],
    "platform/observability": [
        "Observability in AgentC2 includes run traces, tool-call telemetry, quality scoring, and cost analytics.",
        "Each run can be inspected at turn and step level for debugging and optimization.",
        "Use this data to tune prompts, tools, and routing behavior over time."
    ],
    "platform/security": [
        "Security controls include encrypted credentials, scoped OAuth, policy guardrails, and audited operations.",
        "Multi-tenant isolation and role-aware access ensure enterprise-safe data boundaries.",
        "Use this section to align implementation with security and compliance requirements."
    ],
    "guides/multi-agent-orchestration": [
        "This guide builds a practical multi-agent orchestration flow using specialization, workflow orchestration, and approval gates.",
        "You will learn how to model responsibilities, route tasks, and validate outcomes with metrics.",
        "The result is a repeatable pattern you can adapt for production teams."
    ]
};

const launchPrioritySlugs = new Set<string>([
    "getting-started/introduction",
    "getting-started/quickstart",
    "agents/overview",
    "agents/guardrails",
    "agents/evaluations",
    "agents/learning",
    "agents/version-control",
    "integrations/model-context-protocol",
    "integrations/slack",
    "integrations/hubspot",
    "workflows/overview",
    "networks/overview",
    "platform/observability",
    "platform/security",
    "guides/multi-agent-orchestration"
]);

function titleFromSlug(slug: string): string {
    return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function ctaForSection(section: string): { label: string; href: string } {
    if (section === "guides" || section === "getting-started") {
        return { label: "Start Building in AgentC2", href: "/signup" };
    }

    if (section === "integrations" || section === "channels") {
        return { label: "Explore Integrations in AgentC2", href: "/workspace" };
    }

    return { label: "Launch AgentC2 Workspace", href: "/workspace" };
}

const pages: DocsPageEntry[] = SECTION_SEEDS.flatMap((seed) =>
    seed.pages.map((pageSlug, pageIndex) => {
        const slug = `${seed.section}/${pageSlug}`;
        const title = titleFromSlug(pageSlug);
        const cta = ctaForSection(seed.section);
        const sectionPages = seed.pages.map((candidate) => `${seed.section}/${candidate}`);
        const relatedSlugs = sectionPages.filter((candidate) => candidate !== slug).slice(0, 4);
        const body = docsSlugToCustomBody[slug] ?? [
            `${title} explains how AgentC2 approaches ${seed.defaultPrimaryKeyword.toLowerCase()} with production reliability in mind.`,
            `This page covers implementation details, practical configuration guidance, and operational checks for ${title.toLowerCase()}.`,
            `Use related pages in ${titleFromSlug(seed.section)} to extend this pattern and compose a complete production workflow.`
        ];

        const searchIntent: DocsPageEntry["searchIntent"] =
            pageIndex === 0
                ? "commercial"
                : seed.defaultPageType === "tutorial"
                  ? "transactional"
                  : "informational";

        return {
            slug,
            section: seed.section,
            title: `${title} | AgentC2 Docs`,
            description: `${title} documentation for AgentC2 covering ${seed.defaultPrimaryKeyword.toLowerCase()} and production implementation patterns.`,
            primaryKeyword: seed.defaultPrimaryKeyword,
            secondaryKeywords: seed.defaultSecondaryKeywords,
            searchIntent,
            pageType: seed.defaultPageType,
            ctaLabel: cta.label,
            ctaHref: cta.href,
            body,
            relatedSlugs,
            lastUpdated: LAST_UPDATED
        };
    })
);

export const DOCS_PAGES: DocsPageEntry[] = pages.sort((a, b) => a.slug.localeCompare(b.slug));

export const DOCS_SECTIONS = SECTION_SEEDS.map((seed) => ({
    slug: seed.section,
    title: titleFromSlug(seed.section),
    pageCount: seed.pages.length,
    firstPageSlug: `${seed.section}/${seed.pages[0]}`
}));

export const DOCS_PAGE_BY_SLUG = new Map(DOCS_PAGES.map((page) => [page.slug, page]));

export const DOCS_LAUNCH_PRIORITY = DOCS_PAGES.filter((page) => launchPrioritySlugs.has(page.slug));

export function getDocsPage(slug: string): DocsPageEntry | undefined {
    return DOCS_PAGE_BY_SLUG.get(slug);
}
