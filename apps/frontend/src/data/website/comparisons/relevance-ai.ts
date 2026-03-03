import type { ComparisonData } from "@/components/website/comparison/comparison-page-template"

export const relevanceAiData: ComparisonData = {
    slug: "relevance-ai",
    competitor: "Relevance AI",
    competitorUrl: "https://relevanceai.com",
    heroSubtitle:
        "No-code agent builder vs. full-stack agent operations — simplicity meets depth",
    tldr: {
        them: "No-code platform for building AI agents and multi-step tools. Relevance AI provides a visual builder for creating agents that execute tasks using LLM chains and integrations.",
        us: "Full-stack agent operations platform with code-first and UI-driven development, multi-tenant governance, voice agents, federation, and a Playbook Marketplace — built for teams that need both simplicity and production depth.",
        difference:
            "Relevance AI makes agent building accessible. AgentC2 makes agent operations complete."
    },
    dimensions: [
        {
            name: "Integration approach",
            them: "Built-in integrations with a curated set of tools. Adding custom integrations requires the Relevance API or Zapier connectors. Integration depth varies by partner.",
            us: "MCP (Model Context Protocol) for extensible, standardized tool integration. Connect to any MCP server — HubSpot, Jira, Slack, GitHub, Firecrawl, and more — with full schema discovery and type safety.",
            whyItMatters:
                "A curated integration list works until you need one that is not on it. MCP provides a universal protocol for connecting any tool, not just the ones the vendor has partnered with."
        },
        {
            name: "Channels & deployment",
            them: "Web chat embeds and API access. Voice and messaging channels require external integrations or third-party tools.",
            us: "Seven deployment channels built in: web chat, voice (ElevenLabs + OpenAI Realtime), Slack, API, embeddable widget, SMS, and email. Same agent, every channel, zero integration work.",
            whyItMatters:
                "Agents that only live in a web chat miss the channels where your users actually work. Built-in multi-channel support eliminates per-channel integration projects."
        },
        {
            name: "Federation & multi-org",
            them: "Single-organization platform. Sharing agents or tools across organizations requires API-level integration and manual trust management.",
            us: "Encrypted cross-organization federation with scoped trust policies. Share agents, tools, and data across company boundaries with full audit trails and granular permissions.",
            whyItMatters:
                "Enterprise AI ecosystems span multiple organizations. Federation enables partner networks, supplier collaboration, and multi-company agent operations."
        },
        {
            name: "Autonomy & orchestration",
            them: "Agents execute multi-step tool chains with LLM reasoning. Orchestration is primarily single-agent with sequential tool execution.",
            us: "Multi-agent Networks with declarative routing, Campaigns for parallel fan-out, human-in-the-loop approval nodes, and Mastra workflows for stateful multi-step processes.",
            whyItMatters:
                "Complex operations require coordinated agent teams — not just a single agent executing steps. Multi-agent orchestration handles the complexity that single-agent chains cannot."
        },
        {
            name: "Developer experience",
            them: "No-code-first. The visual builder is the primary development surface. Code extensibility is available but secondary. No TypeScript SDK for code-first development.",
            us: "Dual-mode: TypeScript-native code-first development for engineers plus a full admin UI for no-code agent creation and management. Both modes are first-class citizens.",
            whyItMatters:
                "No-code is powerful for simple agents. Complex agent logic — custom tools, dynamic instructions, conditional orchestration — needs a real programming language."
        },
        {
            name: "Marketplace & reuse",
            them: "Template library for common agent patterns. Templates are platform-specific and cannot be exported for use outside Relevance AI.",
            us: "Playbook Marketplace for complete, portable agent configurations — instructions, tools, guardrails, and eval criteria — as importable packages that work across environments.",
            whyItMatters:
                "Templates locked to a platform limit reuse. A portable marketplace lets teams share proven patterns across projects, teams, and organizations."
        },
        {
            name: "Pricing model",
            them: "Credit-based pricing where credits are consumed per agent action. Credits add an abstraction layer between you and actual model costs, making cost prediction harder.",
            us: "Transparent usage-based pricing. You pay for model tokens used plus platform features. No credit abstractions — you see exactly what you spend and why.",
            whyItMatters:
                "Credit-based pricing obscures true costs. When you cannot map credits to actions, budgeting and cost optimization become guesswork."
        }
    ],
    featureTable: [
        {
            feature: "Development approach",
            us: "Code-first + UI",
            them: "No-code first"
        },
        {
            feature: "Primary language",
            us: "TypeScript",
            them: "No-code / Python"
        },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: "Limited"
        },
        { feature: "Visual builder", us: true, them: true },
        { feature: "Multi-tenant governance", us: true, them: false },
        { feature: "Budget controls", us: true, them: "Credits" },
        { feature: "Approval workflows", us: true, them: false },
        {
            feature: "Voice agents",
            us: "ElevenLabs + OpenAI",
            them: false
        },
        {
            feature: "Deployment channels",
            us: "7+ built-in",
            them: "Web chat + API"
        },
        { feature: "Marketplace", us: "Playbook Marketplace", them: "Templates" },
        { feature: "Federation", us: true, them: false },
        { feature: "Self-improving agents", us: true, them: false },
        {
            feature: "MCP tool integration",
            us: "Native",
            them: false
        },
        { feature: "Self-hosted option", us: true, them: false }
    ],
    problemWeSolve:
        "Relevance AI makes it easy to build individual agents with a visual interface. But scaling from one agent to an agent operations platform — with governance, multi-channel delivery, federation, and continuous improvement — requires infrastructure that no-code builders were not designed to provide. AgentC2 bridges the gap between agent building and agent operations.",
    whoShouldChooseThem:
        "Relevance AI is a strong choice for non-technical teams that want to build AI agents quickly using a visual interface. If your use case involves a single agent handling web-based tasks with a curated set of integrations, Relevance AI's no-code approach provides a fast path to value.",
    whoShouldChooseUs:
        "AgentC2 is built for teams that need the full agent operations stack: code-first development for complex logic, multi-agent orchestration, enterprise governance, multi-channel deployment (including voice), cross-organization federation, and a marketplace. If your AI strategy goes beyond a single no-code agent, AgentC2 provides the platform to scale.",
    faqs: [
        {
            question:
                "Is AgentC2 harder to use than Relevance AI for non-technical users?",
            answer: "AgentC2 provides a full admin UI for no-code agent creation and management. Non-technical users can create agents, assign tools, configure instructions, and deploy to channels — all through the UI. The difference is that AgentC2 also supports code-first development for complex scenarios."
        },
        {
            question:
                "Does Relevance AI support multi-agent systems?",
            answer: "Relevance AI supports sequential multi-step tool execution within a single agent. AgentC2 provides true multi-agent orchestration with Networks (routing between specialized agents), Campaigns (parallel fan-out), and human approval gates."
        },
        {
            question: "Can I migrate from Relevance AI to AgentC2?",
            answer: "Yes. Agent instructions, tool configurations, and workflow logic from Relevance AI can be recreated in AgentC2's admin UI or code. The main effort is mapping Relevance AI's tool steps to AgentC2's MCP tools and native tool registry."
        },
        {
            question:
                "Which platform has better AI model support?",
            answer: "Both platforms support major model providers. AgentC2's advantage is model-agnostic flexibility — you can switch models per agent without platform constraints, and use the Vercel AI SDK for standardized model access."
        },
        {
            question:
                "Does AgentC2 have a credit-based pricing model like Relevance AI?",
            answer: "No. AgentC2 uses transparent usage-based pricing. You pay for model tokens consumed plus platform features. There is no credit abstraction — you see the direct cost of every agent action."
        }
    ]
}
