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
            "justcall"
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
        section: "mcp",
        defaultPrimaryKeyword: "MCP developer access",
        defaultSecondaryKeywords: ["AgentC2 MCP server", "AI agent MCP tools"],
        defaultPageType: "tutorial",
        pages: [
            "overview",
            "getting-started",
            "cursor-setup",
            "claude-setup",
            "tool-reference",
            "common-patterns"
        ]
    },
    {
        section: "workspace",
        defaultPrimaryKeyword: "AgentC2 workspace",
        defaultSecondaryKeywords: ["AI agent workspace", "agent chat interface"],
        defaultPageType: "how-to",
        pages: ["overview", "chatting", "managing-agents", "integrations", "runs", "teams"]
    },
    {
        section: "platform",
        defaultPrimaryKeyword: "enterprise AI agent platform",
        defaultSecondaryKeywords: ["multi-tenant AI platform", "AI agent observability"],
        defaultPageType: "concept",
        pages: ["multi-tenancy", "observability", "federation", "triggers-and-schedules"]
    },
    {
        section: "api-reference",
        defaultPrimaryKeyword: "AI agent API reference",
        defaultSecondaryKeywords: ["agent API", "workflow API"],
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
            "AgentC2 is a platform where a frontend experience, orchestration runtime, and database-backed configuration work together. The architecture separates the public marketing/docs frontend from the agent runtime application.",
        dataModel:
            "The core data model is database-driven, not code-only. Agent definitions, versions, tools, and operational metrics are persisted so behavior can be audited, compared, and rolled back safely.",
        apiSurface:
            "Public and authenticated APIs are separated by route intent. Docs should call out which endpoints are operational control surfaces versus public consumption surfaces, and how this impacts onboarding and deployment.",
        operations:
            "Operations start with simple local runs and expand into versioned releases, evaluation, cost monitoring, and policy controls. The expected workflow is iterative: configure, test, observe, improve."
    },
    agents: {
        architecture:
            "Agents are the primary execution primitive. Each agent bundles instructions, model routing, memory behavior, tool access, and governance settings. Runtime execution is tracked as runs, turns, traces, and tool invocations.",
        dataModel:
            "Agent, AgentVersion, AgentTool, AgentRun, AgentTrace, and cost/quality metric tables form the durable record of behavior. This enables forensic debugging and deterministic rollback after a regression.",
        apiSurface:
            "The `/api/agents/*` namespace covers CRUD, invocation, chat, versioning, costs, learning, simulation, and guardrails. A good docs page should map user intent to exact endpoint families and expected payload shapes.",
        operations:
            "Production operation requires version discipline, budget controls, and guardrail policy layering. You should treat every agent update as a release candidate with validation and post-release monitoring."
    },
    skills: {
        architecture:
            "Skills package reusable capability bundles so behavior can be shared across agents without duplicating long instruction blocks. This supports modularity and allows teams to evolve capability in controlled increments.",
        dataModel:
            "Skill, SkillVersion, AgentSkill, SkillDocument, and SkillTool relations enable composability. Skills are not static snippets; they are versioned entities with explicit attachment points and history.",
        apiSurface:
            "The `/api/skills/*` routes provide discovery, versioning, recommendation, and activation surfaces. Docs should explain when to build a new skill versus extending an existing one.",
        operations:
            "Operationally, skills improve governance because teams can centralize policy-sensitive behavior in one place and propagate updates through controlled version references."
    },
    workflows: {
        architecture:
            "Workflows define deterministic multi-step execution across tools and agents. They provide explicit control flow for branching, retries, approvals, and variable passing between steps.",
        dataModel:
            "Workflow, WorkflowVersion, WorkflowRun, and WorkflowRunStep persist both design-time definitions and execution-time telemetry. This makes step-level diagnosis and optimization practical.",
        apiSurface:
            "The `/api/workflows/*` routes expose generation, validation, execution, and run history. Docs should connect each control-flow concept to the runtime semantics teams will observe.",
        operations:
            "In production, workflows should include failure handling, clear step contracts, and observability checks. Human approval steps are mandatory where actions are irreversible or externally visible."
    },
    networks: {
        architecture:
            "Networks orchestrate multiple agents and primitives via topology-aware routing. They are designed for specialization: each participant handles a narrower decision domain while the network coordinates delegation.",
        dataModel:
            "Network, NetworkVersion, NetworkPrimitive, and NetworkRun models capture both graph structure and runtime outcomes, including pathing decisions and execution traces.",
        apiSurface:
            "The `/api/networks/*` endpoints support lifecycle management, generation, execution, versions, traces, and metrics. Docs should help users pick network boundaries and fallback strategy.",
        operations:
            "A stable network requires route confidence checks, fallback behavior, and visibility into handoff quality. Observability should be reviewed after every topology change."
    },
    integrations: {
        architecture:
            "Integrations combine MCP-based tool surfaces and native OAuth providers. AgentC2 treats connectivity as a first-class platform concern with credential security, provider isolation, and tool health visibility.",
        dataModel:
            "IntegrationProvider, IntegrationConnection, and related audit/event tables persist connectivity state, token metadata, and lifecycle changes. This supports compliance reporting and troubleshooting.",
        apiSurface:
            "Integration APIs live under `/api/integrations/*` plus MCP execution routes. Docs should specify setup flow, required scopes, failure modes, and how to validate connectivity.",
        operations:
            "Operations include credential rotation, scope minimization, token refresh behavior, and safe fallback when a provider is degraded. Teams should routinely test critical integrations."
    },
    channels: {
        architecture:
            "Channels allow the same agent logic to operate across Slack, WhatsApp, Telegram, voice, and web embed contexts. The channel layer normalizes inbound events into agent execution workflows.",
        dataModel:
            "ChannelSession, ChannelCredentials, VoiceCallLog, and trace models keep channel-specific state and runtime observations so issues can be debugged per channel context.",
        apiSurface:
            "Channel endpoints and webhook routes define how external systems deliver events and receive responses. Docs should include provider setup, webhook validation, and retry behaviors.",
        operations:
            "Channel operations require identity mapping, message threading continuity, and strong webhook verification. Observability should track latency and failure rate per channel."
    },
    knowledge: {
        architecture:
            "Knowledge features provide RAG pipelines for ingestion, chunking, embedding, and retrieval. The architecture separates document lifecycle from query-time retrieval and generation.",
        dataModel:
            "Document, DocumentVersion, and RagDocument records keep provenance and versioned content state, making updates and re-embedding safe and trackable.",
        apiSurface:
            "Knowledge APIs span ingestion, query, document management, and retrieval-oriented operations. Docs should explain how retrieval quality is evaluated and tuned.",
        operations:
            "Operations include ingestion validation, chunk strategy tuning, and relevance evaluation over real workloads. Knowledge drift should be addressed with routine refresh cycles."
    },
    campaigns: {
        architecture:
            "Campaigns model mission-style orchestration where goals are decomposed into tasks across agents and workflows. This is suited to multi-stage business processes that need measurable progress and review loops.",
        dataModel:
            "Campaign, CampaignTemplate, Mission, and MissionTask models provide planning and execution state. These structures support handoffs, deadlines, and completion reporting.",
        apiSurface:
            "Campaign APIs provide lifecycle management, export, and execution controls. Docs should focus on how campaigns connect to skills, workflows, and quality gates.",
        operations:
            "Operationally, campaigns require clear ownership, defined success criteria, and structured after-action reviews so lessons turn into system improvements."
    },
    workspace: {
        architecture:
            "The workspace is the primary user-facing interface for AgentC2. It provides a browser-based environment where non-technical users can chat with agents, manage configurations, connect integrations, review run history, and collaborate with team members.",
        dataModel:
            "Workspace interactions are backed by organizations, memberships, agent configurations, integration connections, and run records. Users interact with these through the UI without needing to understand the underlying data structures.",
        apiSurface:
            "Workspace pages are served at /workspace after authentication. Users navigate between Chat, Agents, Integrations, Knowledge, Runs, and Team sections using the sidebar. All actions are performed through the graphical interface.",
        operations:
            "Day-to-day operations include chatting with agents, reviewing run outputs, adjusting agent instructions, connecting new integrations, inviting team members, and monitoring costs. The workspace is designed for iterative improvement — observe results, adjust settings, and test again."
    },
    mcp: {
        architecture:
            "The MCP developer access layer exposes the full AgentC2 platform as a set of MCP tools accessible from Cursor, Claude, and any MCP-compatible client. It uses Streamable HTTP transport with OAuth 2.1 authentication, scoped per organization.",
        dataModel:
            "MCP API keys are organization-scoped credentials stored in the database. Each key maps to an organization slug and grants tool-level access to all platform primitives within that org boundary.",
        apiSurface:
            "The MCP server endpoint at /agent/api/mcp/server/{orgSlug} serves 202 tools covering agents, workflows, networks, knowledge, skills, integrations, and org management. Clients discover tools via the tools/list protocol method.",
        operations:
            "Operations include API key lifecycle management, client configuration across multiple IDE and AI assistant environments, and monitoring tool usage patterns to ensure security and cost controls are respected."
    },
    platform: {
        architecture:
            "Platform capabilities cover multi-tenancy, observability, federation, and triggering controls. These are the trust and governance foundations behind every agent behavior.",
        dataModel:
            "Organization, Workspace, Membership, GuardrailPolicy, AuditLog, metric aggregates, and federation models establish ownership boundaries and operational accountability.",
        apiSurface:
            "Platform APIs include organization management, policy controls, activity feeds, and infrastructure-level operations. Docs should map administrative actions to operational consequences.",
        operations:
            "Production operations include tenant isolation checks, policy audits, release controls, and incident response workflows. Platform docs should be explicit about decision rights and escalation paths."
    },
    "api-reference": {
        architecture:
            "The API surface is broad and intentionally resource-oriented. Reference docs should emphasize route organization by domain and include practical request/response expectations.",
        dataModel:
            "Most API contracts map directly to database-backed entities or orchestration runtime events. Understanding model relationships improves API usage and debugging.",
        apiSurface:
            "Reference sections should cover authentication assumptions, HTTP methods, path parameters, payload structure, error handling, and idempotency considerations.",
        operations:
            "API operations should include rate-awareness, retry guidance, and monitoring of non-2xx responses. Teams should define client-side guardrails before scaling usage."
    },
    guides: {
        architecture:
            "Guides translate platform primitives into end-to-end implementations. They should show how to combine agents, tools, workflows, and governance controls into repeatable operating patterns.",
        dataModel:
            "Guide outcomes should map to concrete entities created in the system, such as agents, skills, workflows, versions, and run records.",
        apiSurface:
            "Where relevant, guides should include direct API equivalents for every UI action so teams can automate setup and deployment workflows.",
        operations:
            "Each guide should finish with production hardening: guardrails, evaluation, monitoring, rollback strategy, and ownership expectations."
    }
};

const PAGE_FOCUS_OVERRIDES: Record<string, string> = {
    "agents/model-providers":
        "This page should explicitly compare provider trade-offs for latency, quality, tool-use reliability, and cost, then map those decisions to versioned release strategy.",
    "agents/guardrails":
        "This page should include examples of input/output policy layering, prompt-injection handling, and incident response expectations for unsafe outputs.",
    "integrations/model-context-protocol":
        "This page should explain MCP architecture, host-client-server boundaries, and how AgentC2 wraps MCP with org-level credential and policy controls.",
    "workflows/human-in-the-loop":
        "This page should provide approval-step patterns for sensitive actions and describe escalation and timeout behavior.",
    "guides/migrate-from-langchain":
        "This guide should map LangChain and LangGraph concepts to AgentC2 concepts with migration sequencing and risk controls."
};

const PAGE_SLUG_GUIDANCE: Record<string, string> = {
    introduction:
        "Use this page to define why AgentC2 exists, who it is for, and what production-grade means in practical terms such as reliability, governance, and measurable outcomes.",
    quickstart:
        "Walk the reader through the shortest path to value: create agent, attach tools, run a test conversation, and capture the first observable run record.",
    architecture:
        "Explain service boundaries, shared packages, data flow, and why the architecture supports controlled iteration better than ad-hoc script orchestration.",
    "key-concepts":
        "Clarify the boundaries between agents, skills, workflows, and networks so teams avoid overloading one primitive with responsibilities meant for another.",
    "first-agent":
        "Provide a procedural first build with concrete decisions for model selection, tools, memory policy, and release hygiene.",
    overview:
        "Frame the capability with scope, decision boundaries, and when teams should or should not use this primitive in production.",
    "creating-agents":
        "Show creation as a lifecycle: requirements, configuration, validation, staged release, and post-release monitoring rather than one-time setup.",
    configuration:
        "Cover configuration risk trade-offs explicitly, including model settings, tool permissions, and the impact of defaults on quality and spend.",
    "model-providers":
        "Compare providers by decision criteria teams actually use in production: latency budget, tool reliability, prompt adherence, and cost envelopes.",
    memory: "Document memory strategy as policy, not just feature toggles. Include retention, recall boundaries, and privacy implications for long-lived threads.",
    tools: "Treat tool access as controlled capability exposure. Include permission boundaries, failure handling, and expected verification of tool outputs.",
    "version-control":
        "Emphasize release discipline: version intent, change notes, validation evidence, and rollback readiness.",
    "budgets-and-costs":
        "Tie budget policy to business value and risk tolerance. Include spend anomaly response and controlled degradation strategies.",
    guardrails:
        "Focus on layered controls (org plus agent), unsafe-input handling, unsafe-output handling, and auditable policy enforcement.",
    evaluations:
        "Define scorecards that represent real quality expectations and explain how to avoid optimizing for metrics that do not correlate with user outcomes.",
    learning:
        "Show the closed loop from observed failures to proposals, experiments, and guarded promotion.",
    simulations:
        "Describe simulation design for edge cases, failure-prone prompts, and policy-sensitive behaviors before production exposure.",
    "output-actions":
        "Clarify when downstream actions should trigger automatically versus requiring approval and human confirmation.",
    "public-embedding":
        "Cover exposure boundaries for public embeds, token handling, abuse controls, and brand-safe defaults.",
    "api-reference":
        "Reference pages should prioritize endpoint purpose, payload assumptions, authentication requirements, and common failure signatures.",
    "creating-skills":
        "Explain how to decompose reusable capability and avoid hidden coupling between agent-specific prompts and skill-level abstractions.",
    "progressive-disclosure":
        "Document context-driven activation so skills are surfaced when relevant without overwhelming runtime context windows.",
    "auto-generated-skills":
        "Explain how integration provisioning can generate capability artifacts and what governance checks are required before using them in production.",
    "creating-workflows":
        "Define workflow design as contract design between steps, including input shape, output guarantees, and failure behavior.",
    "step-types":
        "Map each step type to execution semantics so teams understand where determinism ends and model variability begins.",
    "control-flow":
        "Document branching, looping, and parallelism decisions with explicit notes on retry behavior and dead-end prevention.",
    "human-in-the-loop":
        "Detail approval routing, timeout policy, escalation owners, and non-response behavior.",
    "ai-assisted-design":
        "Set expectations for generated designs: useful acceleration, but still requiring human review and production hardening.",
    topology:
        "Use topology guidance to define routing confidence boundaries, specialization nodes, and fallback paths.",
    "creating-networks":
        "Show incremental network rollout patterns to reduce blast radius when introducing new delegation paths.",
    "model-context-protocol":
        "Explain MCP host-client-server responsibilities and how protocol-level capability exposure interacts with org-level governance.",
    hubspot:
        "Document CRM-specific risk controls such as write permissions, field-level validation, and duplicate-update prevention.",
    jira: "Include issue lifecycle assumptions, transition permissions, and audit expectations for automatically generated updates.",
    slack: "Explain threaded context behavior, channel identity controls, and operational safeguards for externally visible responses.",
    github: "Cover repo-level scoping, branch protection awareness, and review checkpoints for automation that changes code state.",
    gmail: "Call out mailbox scope, send safeguards, and escalation patterns to avoid unintended outbound communication.",
    "google-drive":
        "Define file retrieval boundaries, document freshness checks, and source provenance expectations for knowledge workflows.",
    "google-calendar":
        "Document read-versus-write scope decisions, conflict handling, and meeting automation boundaries.",
    "microsoft-outlook":
        "Explain mail and calendar dual-surface behavior, token refresh expectations, and scope minimization.",
    "microsoft-teams":
        "Describe channel and chat permissions, posting behavior, and identity mapping for enterprise collaboration contexts.",
    dropbox:
        "Document path-level access assumptions, file mutation controls, and content lifecycle expectations.",
    elevenlabs:
        "Cover voice quality trade-offs, latency expectations, and safe tool invocation in voice interactions.",
    firecrawl:
        "Explain crawl boundaries, content freshness, and extraction validation before downstream decisioning.",
    fathom: "Define transcript reliability assumptions and review workflow for actions generated from meeting content.",
    justcall:
        "Document communication compliance boundaries and opt-in safeguards for call and messaging automation.",
    whatsapp:
        "Clarify message delivery constraints, template requirements, and conversation state continuity.",
    telegram:
        "Document bot identity behavior, command parsing expectations, and fallback messaging strategy.",
    voice: "Cover call lifecycle, interruption handling, and human handoff policies for high-risk conversations.",
    embed: "Explain embed token controls, branding configuration, rate limiting, and public abuse prevention.",
    "document-ingestion":
        "Define ingestion as a controlled pipeline: source validation, chunking strategy, embedding policy, and provenance capture.",
    "vector-search":
        "Document retrieval relevance tuning and how to validate recall and precision against representative prompts.",
    "hybrid-search":
        "Explain when to mix lexical and semantic search and how to evaluate blended retrieval quality.",
    "creating-campaigns":
        "Show campaign creation as mission decomposition with explicit owners, deadlines, and measurable outputs.",
    templates:
        "Document template governance so reusable missions do not drift from policy and quality expectations.",
    "after-action-reviews":
        "Describe AAR structure, signal extraction, and how findings feed back into agent and workflow improvements.",
    "multi-tenancy":
        "Clarify tenant isolation boundaries, cross-workspace assumptions, and admin control surfaces.",
    observability:
        "Define the observability model from run traces to aggregate metrics and decision-ready operational dashboards.",
    federation:
        "Explain cross-org trust boundaries, policy enforcement, and auditability requirements for federated interactions.",
    "triggers-and-schedules":
        "Document event contracts, schedule reliability expectations, and duplicate-trigger handling.",
    agents: "Reference should include route groups, required fields, common error modes, and safe invocation patterns.",
    workflows:
        "Reference should include step payload conventions and run lifecycle endpoints for debugging workflow execution.",
    networks:
        "Reference should include topology, run, trace, and version endpoints with guidance on expected response structures.",
    skills: "Reference should include create/update/version endpoints and attachment semantics for safe reuse across agents.",
    integrations:
        "Reference should include provider setup, connection health, and tool execution routes with auth requirements.",
    knowledge:
        "Reference should include ingestion/query endpoints and operational recommendations for retrieval validation.",
    campaigns:
        "Reference should include mission lifecycle endpoints and export/reporting routes used by operations teams.",
    platform:
        "Reference should include org/workspace/admin control endpoints and activity/audit surfaces.",
    "build-a-customer-support-agent":
        "Guide should walk through triage, routing, escalation, and response quality checks for support workloads.",
    "build-a-research-agent":
        "Guide should include retrieval setup, source validation, and synthesis quality checks for research workflows.",
    "build-a-sales-agent":
        "Guide should combine CRM and messaging integrations with approval gates for externally visible updates.",
    "multi-agent-orchestration":
        "Guide should show specialization, delegation, and verifier patterns with measurable success criteria.",
    "add-voice-to-your-agent":
        "Guide should cover voice provider setup, latency tuning, and safe fallback to text channels.",
    "continuous-learning-setup":
        "Guide should configure signals, proposal review, and controlled promotion policy.",
    "production-guardrails":
        "Guide should provide policy layering templates and incident-response-ready guardrail checks.",
    "migrate-from-langchain":
        "Guide should map concepts and provide phased migration strategy with rollback safeguards.",
    chatting:
        "Explain how to use the chat interface to talk to agents, understand tool activity, manage conversation history, and provide feedback to improve agent quality.",
    "managing-agents":
        "Walk users through creating, configuring, and testing agents using the workspace UI, including model selection, instruction writing, tool attachment, versioning, and guardrails.",
    runs: "Show users how to find, read, and use run history to understand agent behavior, verify outputs, monitor costs, and improve agent performance over time.",
    teams: "Explain organization structure, workspace separation, role-based permissions, and how to invite, manage, and remove team members.",
    "getting-started":
        "Walk the reader through API key generation, credential setup, and first tool verification in under 5 minutes.",
    "cursor-setup":
        "Provide step-by-step Node.js proxy setup, mcp.json configuration, and troubleshooting for common Cursor MCP issues.",
    "claude-setup":
        "Cover Claude CoWork, Claude Desktop, and Claude Code setup using remote Streamable HTTP with OAuth authentication.",
    "tool-reference":
        "Provide a categorized listing of all 202 MCP tools with names and descriptions, organized by domain.",
    "common-patterns":
        "Show conversational recipes that chain multiple MCP tools to accomplish real development and operations tasks."
};

const SECTION_PAGE_GUIDANCE: Record<string, string> = {
    "integrations/overview":
        "Integration overview should include capability taxonomy (MCP, OAuth-native, channel-native) so teams choose the right integration strategy before implementation.",
    "channels/overview":
        "Channel overview should explain how channel context affects prompting, response format, and escalation requirements.",
    "knowledge/overview":
        "Knowledge overview should emphasize retrieval quality as a first-class production concern, not a one-time ingestion task.",
    "platform/overview":
        "If a section has an overview page, it should frame governance and operating model implications before diving into mechanics.",
    "api-reference/agents":
        "Include clear notes on route families and which endpoints are safe for automation versus operator-only controls.",
    "api-reference/workflows":
        "Reference should include validation and execution endpoint interplay to prevent malformed workflow deployments.",
    "api-reference/networks":
        "Reference should include topology mutation caveats and expected trace payload usage.",
    "api-reference/skills":
        "Reference should describe attachment semantics and version pinning behavior.",
    "api-reference/integrations":
        "Reference should include connection status, token lifecycle fields, and common auth failure responses.",
    "api-reference/knowledge":
        "Reference should include ingestion idempotency and retrieval tuning fields.",
    "api-reference/campaigns":
        "Reference should include mission status transitions and reporting endpoints.",
    "api-reference/platform":
        "Reference should include organization-level safety checks before applying tenant-wide changes."
};

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
