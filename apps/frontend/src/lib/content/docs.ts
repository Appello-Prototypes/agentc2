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
        pages: ["introduction", "quickstart", "connect-integration"]
    },
    {
        section: "core-concepts",
        defaultPrimaryKeyword: "AI agent concepts",
        defaultSecondaryKeywords: [
            "AI agent orchestration",
            "multi-agent system",
            "agent integrations"
        ],
        defaultPageType: "concept",
        pages: ["agents", "integrations", "networks", "workflows", "knowledge"]
    },
    {
        section: "guides",
        defaultPrimaryKeyword: "AI agent tutorial",
        defaultSecondaryKeywords: ["deploy AI agents production", "build AI agent"],
        defaultPageType: "tutorial",
        pages: [
            "build-a-customer-support-agent",
            "build-a-sales-agent",
            "build-a-research-agent",
            "deploy-to-slack",
            "add-voice-to-your-agent",
            "connect-your-crm",
            "set-up-your-team",
            "multi-agent-orchestration",
            "production-guardrails",
            "continuous-learning-setup"
        ]
    },
    {
        section: "workspace",
        defaultPrimaryKeyword: "AgentC2 workspace",
        defaultSecondaryKeywords: ["AI agent workspace", "agent chat interface"],
        defaultPageType: "how-to",
        pages: ["overview", "chatting", "managing-agents", "integrations"]
    },
    {
        section: "api-reference",
        defaultPrimaryKeyword: "AI agent API reference",
        defaultSecondaryKeywords: ["agent API", "workflow API", "MCP developer access"],
        defaultPageType: "reference",
        pages: [
            "authentication",
            "agents",
            "workflows",
            "networks",
            "skills",
            "integrations",
            "knowledge",
            "campaigns",
            "platform",
            "mcp-overview",
            "mcp-getting-started",
            "mcp-cursor-setup",
            "mcp-claude-setup",
            "mcp-common-patterns",
            "mcp-tool-reference"
        ]
    }
];

const SECTION_CONTEXT: Record<
    string,
    {
        architecture: string;
        dataModel: string;
        apiSurface: string;
        operations: string;
    }
> = {
    "getting-started": {
        architecture:
            "AgentC2 is a platform for building, deploying, and operating AI agents. You configure agents through a workspace UI or API, connect external tools, and deploy across channels.",
        dataModel:
            "Agent definitions, versions, tools, and metrics are stored in a database so you can audit, compare, and roll back any change.",
        apiSurface:
            "The getting started section focuses on the workspace UI. API access is covered in the API Reference section.",
        operations:
            "Start by creating an agent, connecting an integration, and testing in chat. Iterate from there."
    },
    "core-concepts": {
        architecture:
            "AgentC2 is organized around core primitives: agents, integrations, networks, workflows, and knowledge. Each serves a distinct purpose in building production AI systems.",
        dataModel:
            "All primitives are database-driven and versioned, enabling audit trails, rollback, and dynamic updates without code deployments.",
        apiSurface:
            "Core concepts are managed through the workspace UI or REST API. Each primitive has its own API namespace.",
        operations:
            "Choose the right primitive for each task: agents for reasoning, workflows for deterministic processes, networks for multi-agent coordination."
    },
    guides: {
        architecture:
            "Guides walk you through building complete solutions by combining agents, tools, workflows, and integrations into working systems.",
        dataModel:
            "Each guide produces concrete entities in your workspace: agents, skills, workflows, and integration connections.",
        apiSurface: "Guides use the workspace UI. API equivalents are linked where relevant.",
        operations:
            "Follow the steps, test in chat, and iterate. Each guide includes verification steps."
    },
    workspace: {
        architecture:
            "The workspace is your browser-based command center for AgentC2. Chat with agents, manage configurations, connect integrations, review runs, and collaborate with your team.",
        dataModel:
            "Everything you do in the workspace is backed by your organization's database. Actions are tracked and auditable.",
        apiSurface:
            "All workspace actions are performed through the graphical interface. Navigate using the sidebar.",
        operations:
            "Day-to-day work includes chatting with agents, reviewing outputs, adjusting settings, and monitoring costs."
    },
    "api-reference": {
        architecture:
            "The AgentC2 API provides programmatic access to all platform capabilities. It also includes MCP developer access for connecting from Cursor, Claude, and other MCP-compatible clients.",
        dataModel:
            "API contracts map to database-backed entities. Understanding the data model improves debugging.",
        apiSurface:
            "Reference sections cover authentication, HTTP methods, path parameters, payload structure, and error handling.",
        operations:
            "Use bearer tokens for authentication. Rate limits apply. Monitor responses and define client-side safeguards."
    }
};

const PAGE_FOCUS_OVERRIDES: Record<string, string> = {};

const PAGE_SLUG_GUIDANCE: Record<string, string> = {
    introduction:
        "Explain what AgentC2 is, who it is for, and what you can build. Keep it simple and outcome-focused.",
    quickstart:
        "Walk through creating an agent via the workspace UI with screenshots. No curl commands.",
    "connect-integration": "Walk through connecting an external service via the workspace UI.",
    agents: "Explain what agents are and how to create one. Focus on the UI experience.",
    integrations: "List available integrations with what agents can do with each service.",
    networks: "Explain multi-agent coordination with visual topology examples.",
    workflows: "Explain deterministic multi-step processes with branching and approvals.",
    knowledge: "Explain how to upload documents and give agents access to search them.",
    overview: "Provide a plain-language overview of the workspace UI.",
    chatting: "Explain how to chat with agents in the workspace.",
    "managing-agents": "Walk through agent configuration, versioning, and budgets in the UI.",
    authentication: "Document API key generation, bearer tokens, and session auth.",
    "mcp-overview": "Explain MCP developer access and available tools.",
    "mcp-getting-started": "Walk through API key generation and first MCP connection.",
    "mcp-cursor-setup": "Step-by-step Cursor IDE setup with the stdio proxy.",
    "mcp-claude-setup": "Setup for Claude Desktop, Claude Code, and Claude CoWork.",
    "mcp-common-patterns": "Show recipes for common MCP tool chains.",
    "mcp-tool-reference": "Categorized listing of all MCP tools."
};

const SECTION_PAGE_GUIDANCE: Record<string, string> = {};

function buildRichBody(
    section: string,
    title: string,
    slug: string,
    pageSlug: string,
    defaultPrimaryKeyword: string
): string[] {
    const context = SECTION_CONTEXT[section];
    const focus = PAGE_FOCUS_OVERRIDES[slug];
    const pageGuidance = PAGE_SLUG_GUIDANCE[pageSlug];
    const sectionPageGuidance = SECTION_PAGE_GUIDANCE[slug];
    const pageTypeNarrative =
        section === "api-reference"
            ? "Because this is a reference-first surface, prefer precise contracts, explicit field behavior, and failure patterns over marketing language."
            : section === "guides"
              ? "Because this is a guide-first surface, prioritize procedural sequencing, verification steps, and production hardening notes."
              : "Because this is a capability page, explain both design intent and runtime behavior, then show how teams should operate it safely.";

    return [
        `${title} is part of the AgentC2 documentation system for ${defaultPrimaryKeyword.toLowerCase()}. This page is written for production teams that need operational clarity, not just conceptual guidance. The intent is to explain how this capability behaves in the real platform, where quality, safety, and governance requirements must be met at the same time.`,
        context.architecture,
        context.dataModel,
        context.apiSurface,
        pageTypeNarrative,
        context.operations,
        pageGuidance ??
            `For ${title.toLowerCase()}, include concrete examples, expected operator decisions, and validation checkpoints so teams can apply this capability without guessing.`,
        sectionPageGuidance ??
            `A strong ${title.toLowerCase()} implementation defines ownership, acceptance criteria, and observability checks before broad rollout. Teams should stage changes through versions, validate with representative traffic or simulation, and only then promote to wider exposure.`,
        focus ??
            `This page should also document common failure modes and recovery playbooks. Operational excellence comes from preparing for degraded dependencies, policy conflicts, and ambiguous model outputs before they appear in production traffic.`,
        `Use related pages in the ${titleFromSlug(section)} section to connect this capability to adjacent concerns such as security policy, evaluation, cost management, and release governance. Production success is not a single-page exercise; it comes from stitching these controls together into one operating model with measurable outcomes.`
    ];
}

const launchPrioritySlugs = new Set<string>([
    "getting-started/introduction",
    "getting-started/quickstart",
    "core-concepts/agents",
    "core-concepts/networks",
    "core-concepts/integrations",
    "guides/build-a-customer-support-agent",
    "guides/multi-agent-orchestration",
    "guides/deploy-to-slack"
]);

function titleFromSlug(slug: string): string {
    return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function ctaForSection(section: string): { label: string; href: string } {
    if (section === "getting-started") {
        return { label: "Create Your First Agent", href: "/signup" };
    }

    if (section === "core-concepts") {
        return { label: "Try It in Your Workspace", href: "/workspace" };
    }

    if (section === "guides") {
        return { label: "Open Workspace and Follow Along", href: "/workspace" };
    }

    if (section === "api-reference") {
        return { label: "View API Authentication", href: "/docs/api-reference/authentication" };
    }

    return { label: "Open Workspace", href: "/workspace" };
}

const pages: DocsPageEntry[] = SECTION_SEEDS.flatMap((seed) =>
    seed.pages.map((pageSlug, pageIndex) => {
        const slug = `${seed.section}/${pageSlug}`;
        const title = titleFromSlug(pageSlug);
        const cta = ctaForSection(seed.section);
        const sectionPages = seed.pages.map((candidate) => `${seed.section}/${candidate}`);
        const relatedSlugs = sectionPages.filter((candidate) => candidate !== slug).slice(0, 4);
        const body = buildRichBody(seed.section, title, slug, pageSlug, seed.defaultPrimaryKeyword);

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
