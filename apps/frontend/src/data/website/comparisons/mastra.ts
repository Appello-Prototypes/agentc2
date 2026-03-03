import type { ComparisonData } from "@/components/website/comparison/comparison-page-template"

export const mastraData: ComparisonData = {
    slug: "mastra",
    competitor: "Mastra",
    competitorUrl: "https://mastra.ai",
    heroSubtitle:
        "Open-source framework vs. production platform — built on Mastra, beyond Mastra",
    tldr: {
        them: "An excellent open-source TypeScript framework for building AI agents, workflows, and RAG pipelines. Mastra provides the core primitives — agent, tool, workflow, memory — that developers compose in code.",
        us: "A production platform built on top of Mastra that adds everything the framework does not: multi-tenant governance, an admin UI, a marketplace, voice agents, multi-channel deployment, federation, and operational tooling.",
        difference:
            "Mastra is the engine. AgentC2 is the vehicle — fully assembled, road-tested, and ready to drive."
    },
    dimensions: [
        {
            name: "Nature of the product",
            them: "Open-source framework. Mastra provides composable TypeScript primitives — Agent, Tool, Workflow, Memory, RAG — that developers wire together in application code. It is a library, not a platform.",
            us: "Production platform built on Mastra. AgentC2 extends every Mastra primitive with database persistence, UI management, governance layers, and operational tooling. The framework becomes a platform.",
            whyItMatters:
                "Frameworks give you power. Platforms give you velocity. Teams that need to ship production agents — not just build them — benefit from the platform layer."
        },
        {
            name: "Multi-tenancy",
            them: "Single-tenant by design. Mastra instances serve one application. Multi-tenant isolation — per-customer agents, per-team budgets, scoped tool access — must be built from scratch.",
            us: "Multi-tenant from the ground up. Organizations, teams, and users each have scoped access to agents, tools, and resources. Budget hierarchies cascade from org to team to agent.",
            whyItMatters:
                "SaaS products, agencies, and enterprises need tenant isolation. Building multi-tenancy on a single-tenant framework is months of engineering that does not improve agent intelligence."
        },
        {
            name: "Admin UI & management",
            them: "No UI. All agent configuration is code-only. Changing an agent's instructions, tools, or model requires a code change and redeployment.",
            us: "Full admin dashboard for creating, configuring, testing, and monitoring agents. Change instructions, swap models, assign tools, and review runs — all without touching code.",
            whyItMatters:
                "Not every agent change should require a developer. Product managers, ops teams, and support leads need to adjust agents without filing a PR."
        },
        {
            name: "Governance & guardrails",
            them: "No built-in governance. Guardrails, approval workflows, budget controls, and audit logging are application concerns — Mastra provides the building blocks, not the controls.",
            us: "Platform-level governance: budget hierarchies, human-in-the-loop approval workflows, role-based access control, eval scorers with quality gates, and comprehensive audit logging.",
            whyItMatters:
                "Enterprise adoption is blocked without provable controls. Platform-level governance means compliance teams can verify controls without reading application code."
        },
        {
            name: "Marketplace & reuse",
            them: "No marketplace. Sharing agent configurations requires copying code between repositories.",
            us: "Playbook Marketplace for importing and exporting complete agent configurations — instructions, tools, guardrails, and eval criteria — as reusable, versioned packages.",
            whyItMatters:
                "Frameworks scale through code reuse (npm packages). Platforms scale through configuration reuse (marketplaces). Agent patterns should be as easy to share as UI components."
        },
        {
            name: "Federation",
            them: "No federation concept. Cross-organization agent collaboration requires custom API integration and manual trust management.",
            us: "Encrypted cross-organization federation with scoped trust policies. Agents from different orgs can collaborate, share tools, and exchange data with full audit trails.",
            whyItMatters:
                "The future of AI agents is collaborative — across teams, companies, and industries. Federation makes this possible at the platform level."
        },
        {
            name: "Channels & deployment",
            them: "No built-in channel adapters. Exposing an agent to Slack, web chat, voice, or SMS requires application-level integration code.",
            us: "Seven deployment channels built in: web chat, voice, Slack, API, embeddable widget, SMS, and email. Deploy an agent to any channel without writing integration code.",
            whyItMatters:
                "Channel integration is repetitive plumbing. A platform that handles it lets developers focus on agent logic, not webhook handlers."
        },
        {
            name: "Voice agents",
            them: "Mastra provides voice provider abstractions (@mastra/voice-elevenlabs, @mastra/voice-openai). Wiring them into a production voice agent pipeline is application work.",
            us: "Production voice agents with ElevenLabs and OpenAI Realtime, including webhook tool integration, conversation memory, and channel-agnostic deployment — all managed through the platform.",
            whyItMatters:
                "Voice provider abstractions are a starting point. A production voice agent needs webhook management, conversation state, tool access, and monitoring — platform features, not library calls."
        },
        {
            name: "Tools & MCP",
            them: "Mastra's @mastra/mcp package provides an MCP client for connecting to tool servers. Tool registration and discovery is code-based.",
            us: "MCP client (inherited from Mastra) plus a platform tool registry, UI-based tool assignment, per-agent tool scoping, and tool usage analytics. MCP becomes a managed, governed resource.",
            whyItMatters:
                "In production, you need to know which agents use which tools, how often, and with what results. A tool registry provides visibility that code-level tool imports cannot."
        },
        {
            name: "Learning & improvement",
            them: "No built-in learning pipeline. Agent improvement requires manual instruction editing and redeployment.",
            us: "Automated learning pipeline: extract signals from agent runs, generate improvement proposals, run A/B experiments, and apply approved changes — all with human-in-the-loop oversight.",
            whyItMatters:
                "Agents that do not learn plateau quickly. A platform-level learning loop keeps agents improving without manual prompt engineering across dozens of configurations."
        }
    ],
    featureTable: [
        { feature: "Product type", us: "Platform", them: "Framework" },
        { feature: "Built on Mastra", us: true, them: "N/A (is Mastra)" },
        { feature: "Admin UI", us: true, them: false },
        { feature: "Database-driven configs", us: true, them: false },
        { feature: "Multi-tenancy", us: true, them: false },
        { feature: "Budget controls", us: true, them: false },
        { feature: "Approval workflows", us: true, them: false },
        { feature: "Marketplace", us: "Playbook Marketplace", them: false },
        { feature: "Federation", us: true, them: false },
        {
            feature: "Voice agents",
            us: "Production-ready",
            them: "Provider abstractions"
        },
        {
            feature: "Deployment channels",
            us: "7+ built-in",
            them: "DIY"
        },
        { feature: "Self-improving agents", us: true, them: false },
        { feature: "Open source", us: "Core framework", them: true },
        {
            feature: "MCP integration",
            us: "Managed + governed",
            them: "Client library"
        }
    ],
    problemWeSolve:
        "Mastra is an outstanding open-source framework — and it is the foundation AgentC2 is built on. But frameworks require teams to build everything above the primitives: multi-tenancy, admin UIs, governance, channel adapters, marketplaces, and operational tooling. AgentC2 provides that platform layer so teams can focus on agent intelligence rather than infrastructure. We contribute back to Mastra and grow with it.",
    whoShouldChooseThem:
        "Mastra is the right choice for developers who want maximum control over every layer of their agent application. If you have a strong engineering team, do not need multi-tenancy or a marketplace, and prefer to build your own operational layer on top of a clean framework — Mastra provides excellent TypeScript primitives with great developer ergonomics.",
    whoShouldChooseUs:
        "AgentC2 is built for teams that want to ship production agents without building the platform themselves. If you need multi-tenant governance, an admin UI, multi-channel deployment, voice agents, a marketplace, federation, and continuous learning — all ready out of the box — AgentC2 delivers the complete platform built on the Mastra framework you already trust.",
    faqs: [
        {
            question: "Is AgentC2 a fork of Mastra?",
            answer: "No. AgentC2 is built on top of Mastra as a dependency — not a fork. We use @mastra/core, @mastra/mcp, @mastra/memory, @mastra/rag, and other Mastra packages as our foundation and extend them with platform features. As Mastra improves, AgentC2 inherits those improvements."
        },
        {
            question: "Does AgentC2 contribute back to Mastra?",
            answer: "We are committed to the Mastra ecosystem. Improvements we make to core primitives are contributed upstream. AgentC2 extends Mastra — it does not compete with it."
        },
        {
            question:
                "Can I start with Mastra and migrate to AgentC2 later?",
            answer: "Yes, and this is a natural path. Start with Mastra for prototyping and development. When you need multi-tenancy, governance, channels, and operational tooling, AgentC2 provides the platform layer — and your Mastra agent code transfers with minimal changes."
        },
        {
            question:
                "Do I still need to know Mastra to use AgentC2?",
            answer: "No. AgentC2's admin UI lets you create and manage agents without knowing Mastra internals. For custom tool development and advanced workflows, familiarity with Mastra's TypeScript primitives is helpful but not required."
        },
        {
            question:
                "Is Mastra free and AgentC2 paid?",
            answer: "Mastra is open-source and free. AgentC2 offers a free tier for getting started, with paid plans for production features like advanced governance, federation, and marketplace access. You always have the option to build on Mastra directly if you prefer the framework approach."
        }
    ]
}
