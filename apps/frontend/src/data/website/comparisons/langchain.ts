import type { ComparisonData } from "@/components/website/comparison/comparison-page-template";

export const langchainData: ComparisonData = {
    slug: "langchain",
    competitor: "LangChain",
    competitorUrl: "https://langchain.com",
    heroSubtitle: "Framework vs. Platform — why the gap between library and production matters",
    tldr: {
        them: "Python-first developer framework for building LLM applications. LangChain provides composable abstractions — chains, agents, retrievers — that developers wire together in code.",
        us: "TypeScript-native production platform with full UI, multi-tenant governance, marketplace, and multi-channel deployment. AgentC2 ships agents to production without a DevOps team.",
        difference:
            "LangChain gives you building blocks. AgentC2 is the finished building — with plumbing, wiring, and a front door."
    },
    dimensions: [
        {
            name: "Language & ecosystem",
            them: "Python-first with a TypeScript port (LangChain.js). Most community examples, integrations, and documentation target Python. TypeScript support lags behind the Python SDK.",
            us: "TypeScript-native from day one. Built on Next.js, React 19, and Bun. Every API, every tool, every workflow is first-class TypeScript with full type safety.",
            whyItMatters:
                "Your frontend is already TypeScript. Running a Python backend alongside it doubles your infrastructure, dependency management, and hiring requirements."
        },
        {
            name: "Deployment & operations",
            them: "LangChain is a library — you bring your own hosting, scaling, monitoring, and CI/CD. LangServe and LangSmith add deployment and observability, but they are separate products with separate billing.",
            us: "One-click deployment to any environment. Built-in observability, versioned agent configs, rollback, and PM2/Caddy production management. No additional products required.",
            whyItMatters:
                "Shipping an agent to a demo is easy. Shipping it to production — with uptime, rollback, and audit trails — is where most teams stall."
        },
        {
            name: "Multi-agent orchestration",
            them: "LangGraph introduces stateful graphs for multi-agent flows. Powerful but requires deep graph programming knowledge. No visual editor — everything is code.",
            us: "Networks with declarative routing, campaigns for parallel fan-out, and a visual workflow builder. Combine code-first and UI-driven orchestration depending on the task.",
            whyItMatters:
                "Multi-agent systems need both developer flexibility and operator visibility. Graph code alone cannot give an ops team the oversight they need."
        },
        {
            name: "Governance & guardrails",
            them: "Basic output parsing and retry logic. Guardrails are DIY — you write validation functions and hook them into your chain manually.",
            us: "Built-in budget hierarchies, approval workflows, role-based access, eval scorers, and audit logging. Guardrails are a platform feature, not an afterthought.",
            whyItMatters:
                "Enterprise adoption requires provable controls. If your guardrails are custom code scattered across files, compliance teams cannot verify them."
        },
        {
            name: "Voice & multi-channel",
            them: "No native voice support. No built-in channel adapters. You build Slack bots, voice agents, and API endpoints from scratch.",
            us: "Seven deployment channels out of the box: web chat, voice (ElevenLabs + OpenAI Realtime), Slack, API, embeddable widget, SMS, and email. Same agent, every channel.",
            whyItMatters:
                "Customers interact on their preferred channel. Rebuilding an agent per channel multiplies cost and fragments the user experience."
        },
        {
            name: "Marketplace & reuse",
            them: "LangChain Hub offers prompt templates. No marketplace for full agent configurations, playbooks, or tool bundles.",
            us: "Playbook Marketplace for sharing and discovering complete agent configurations — instructions, tools, guardrails, and evaluation criteria — in one importable package.",
            whyItMatters:
                "Teams should not reinvent proven agent patterns. A marketplace accelerates deployment from weeks to hours."
        },
        {
            name: "Federation",
            them: "No federation concept. Cross-organization collaboration requires custom API bridges and manual trust management.",
            us: "Encrypted cross-organization federation with scoped trust policies, shared tool access, and audit trails. Designed for multi-company agent ecosystems.",
            whyItMatters:
                "Real-world agent deployments span organizational boundaries — suppliers, partners, clients. Without federation, every boundary becomes a manual integration."
        }
    ],
    featureTable: [
        { feature: "Primary language", us: "TypeScript", them: "Python" },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: "LangGraph"
        },
        { feature: "Visual workflow builder", us: true, them: false },
        { feature: "Built-in admin UI", us: true, them: false },
        { feature: "Multi-tenant governance", us: true, them: false },
        { feature: "Budget controls", us: true, them: false },
        {
            feature: "Voice agents",
            us: "ElevenLabs + OpenAI",
            them: false
        },
        {
            feature: "Deployment channels",
            us: "7+ built-in",
            them: "DIY"
        },
        {
            feature: "Marketplace",
            us: "Playbook Marketplace",
            them: "Prompt Hub"
        },
        { feature: "Federation", us: true, them: false },
        {
            feature: "Observability",
            us: "Built-in",
            them: "LangSmith (separate)"
        },
        {
            feature: "RAG pipeline",
            us: "Built-in",
            them: "Built-in"
        },
        {
            feature: "MCP tool integration",
            us: "Native",
            them: "Community"
        },
        {
            feature: "One-click deployment",
            us: true,
            them: false
        }
    ],
    problemWeSolve:
        "Most teams that adopt LangChain discover that building the agent is 20% of the work. The other 80% — deployment, monitoring, governance, multi-channel delivery, and cross-team collaboration — requires a platform, not a library. AgentC2 closes that gap by providing the full operational layer so your team can focus on agent intelligence rather than infrastructure.",
    whoShouldChooseThem:
        "LangChain is an excellent choice for Python-centric research teams, data scientists prototyping LLM pipelines, or developers who want maximum low-level control over every abstraction. If your team already has robust DevOps, CI/CD, and monitoring infrastructure, and you prefer Python, LangChain provides powerful compositional primitives.",
    whoShouldChooseUs:
        "AgentC2 is built for teams that need to ship production agents — not just build prototypes. If you want TypeScript-native development, built-in governance, multi-channel deployment, voice capabilities, and a marketplace for reusable agent patterns, AgentC2 gets you from idea to production faster with fewer moving parts.",
    faqs: [
        {
            question: "Can I use LangChain agents inside AgentC2?",
            answer: "AgentC2 is built on the Mastra framework and uses the Vercel AI SDK for model interactions. While it does not natively import LangChain chains, any LangChain agent can be wrapped as an MCP tool or API endpoint and called from within an AgentC2 network."
        },
        {
            question: "Is AgentC2 only for TypeScript developers?",
            answer: "AgentC2 is TypeScript-native, but non-developers can build and manage agents through the admin UI without writing code. The platform supports both code-first and UI-driven workflows."
        },
        {
            question: "How does AgentC2 compare to LangSmith for observability?",
            answer: "AgentC2 includes built-in observability — run logs, eval scores, token usage, and error tracking — without a separate product or billing. LangSmith is a standalone observability product that adds cost and integration complexity."
        },
        {
            question: "Does AgentC2 support the same number of model providers?",
            answer: "AgentC2 supports OpenAI, Anthropic, and any provider compatible with the Vercel AI SDK. LangChain supports a broader set of model integrations, but AgentC2 covers the providers used by the vast majority of production deployments."
        },
        {
            question: "Can I migrate from LangChain to AgentC2 incrementally?",
            answer: "Yes. You can expose existing LangChain agents as API endpoints and call them from AgentC2 via MCP tools. Over time, you can rebuild agents natively inside AgentC2 to gain full governance, marketplace, and multi-channel benefits."
        }
    ]
};
