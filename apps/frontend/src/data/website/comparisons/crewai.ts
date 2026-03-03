import type { ComparisonData } from "@/components/website/comparison/comparison-page-template";

export const crewaiData: ComparisonData = {
    slug: "crewai",
    competitor: "CrewAI",
    competitorUrl: "https://crewai.com",
    heroSubtitle:
        "Role-playing agents vs. production agent operations — prototyping speed meets operational depth",
    tldr: {
        them: "Python framework for multi-agent role-playing. CrewAI lets developers define agents with roles, goals, and backstories that collaborate on tasks using sequential or hierarchical processes.",
        us: "TypeScript-native production platform with database-driven agent configs, multi-tenant governance, marketplace, voice, and seven deployment channels — built for the full lifecycle from build to operate.",
        difference:
            "CrewAI is great for prototyping multi-agent crews. AgentC2 is built for running them in production."
    },
    dimensions: [
        {
            name: "Language & runtime",
            them: "Python-only. CrewAI is deeply tied to the Python ecosystem — Pydantic models, Python decorators, and pip-based dependency management.",
            us: "TypeScript-native, running on Bun and Next.js. Full type safety, server components, and seamless integration with modern web stacks.",
            whyItMatters:
                "Most production applications serve web UIs. A TypeScript agent platform eliminates the Python-to-TypeScript bridge that adds latency, complexity, and debugging overhead."
        },
        {
            name: "Token efficiency",
            them: "Role-playing prompts embed verbose backstories into every agent call. Each agent carries its role description, goal statement, and backstory in the system prompt — burning tokens on persona maintenance.",
            us: "Lean instruction-based agents with template variables. Instructions are stored in the database and injected at runtime with only the context needed for the current task — no persona padding.",
            whyItMatters:
                "Token costs compound at scale. A 500-token backstory repeated across 10 agents in a crew adds 5,000 tokens per run — before any actual work is done."
        },
        {
            name: "Orchestration depth",
            them: "Sequential and hierarchical process types. A manager agent can delegate to crew members. Limited to these two patterns — custom orchestration requires overriding framework internals.",
            us: "Networks with declarative routing, campaigns for parallel fan-out across agent populations, human-in-the-loop approval nodes, and Mastra workflows for stateful multi-step processes.",
            whyItMatters:
                "Real-world orchestration patterns — parallel execution, conditional branching, human approval gates, fan-out/fan-in — exceed the sequential-or-hierarchical dichotomy."
        },
        {
            name: "Production readiness",
            them: "CrewAI focuses on the agent-building experience. Deployment, monitoring, rollback, and scaling are left to the developer. CrewAI Enterprise adds some ops features but is a separate product.",
            us: "Built-in deployment management, versioned configs with rollback, observability dashboard, eval scoring, and PM2 process management. One platform from development to production.",
            whyItMatters:
                "The gap between a working prototype and a production deployment is where most agent projects fail. A platform that spans both prevents that failure mode."
        },
        {
            name: "Governance & controls",
            them: "No built-in governance layer. Budget controls, approval workflows, and audit logging require custom implementation on top of the framework.",
            us: "Enterprise governance out of the box: budget hierarchies, role-based access control, human approval workflows, comprehensive audit logs, and eval-driven quality gates.",
            whyItMatters:
                "Autonomous agents need guardrails. Without platform-level governance, every team builds their own — inconsistently, incompletely, and without audit trails."
        },
        {
            name: "Channels & voice",
            them: "No built-in channel adapters or voice support. Exposing a crew to Slack, a web chat, or a phone line requires custom integration code.",
            us: "Seven deployment channels built in, plus native voice support via ElevenLabs and OpenAI Realtime. Deploy the same agent to web, voice, Slack, SMS, and more.",
            whyItMatters:
                "Users interact with agents on their preferred channel. A platform that handles channel routing lets you focus on agent intelligence, not integration plumbing."
        },
        {
            name: "Marketplace & reuse",
            them: "No marketplace. Sharing agent configurations between teams or organizations requires manual code sharing.",
            us: "Playbook Marketplace for discovering and importing complete agent configurations — instructions, tools, guardrails, and eval criteria — as reusable packages.",
            whyItMatters:
                "Organizations with multiple agent teams need a way to share proven patterns. A marketplace turns best practices into importable assets."
        }
    ],
    featureTable: [
        { feature: "Primary language", us: "TypeScript", them: "Python" },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: "Sequential / Hierarchical"
        },
        { feature: "Visual workflow builder", us: true, them: false },
        { feature: "Built-in admin UI", us: true, them: false },
        { feature: "Database-driven configs", us: true, them: false },
        { feature: "Budget controls", us: true, them: false },
        { feature: "Approval workflows", us: true, them: false },
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
        { feature: "Marketplace", us: "Playbook Marketplace", them: false },
        { feature: "Federation", us: true, them: false },
        {
            feature: "RAG pipeline",
            us: "Built-in",
            them: "Basic"
        },
        {
            feature: "Self-improving agents",
            us: true,
            them: false
        },
        {
            feature: "MCP tool integration",
            us: "Native",
            them: "Limited"
        }
    ],
    problemWeSolve:
        "CrewAI makes it easy to prototype multi-agent collaborations with role-playing patterns. But production deployments need more than roles and goals — they need governance, observability, multi-channel delivery, and continuous improvement. AgentC2 provides the full operational layer so your agents can graduate from demo to production without rebuilding the stack.",
    whoShouldChooseThem:
        "CrewAI is a strong choice for Python developers who want a fast, opinionated way to prototype multi-agent systems. If you are exploring agent collaboration patterns, building demos, or working in a Python-first data science environment, CrewAI's role-playing paradigm provides an intuitive starting point.",
    whoShouldChooseUs:
        "AgentC2 is built for teams that need to deploy, govern, and scale multi-agent systems in production. If you need TypeScript-native development, enterprise governance, multi-channel deployment, voice capabilities, a marketplace, and continuous learning — AgentC2 provides the complete platform that frameworks cannot.",
    faqs: [
        {
            question: "Can I recreate CrewAI's role-playing pattern in AgentC2?",
            answer: "Yes. AgentC2 agents support rich instruction templates that can include role descriptions, goals, and context — without the token overhead of mandatory backstory fields. You get the same collaboration patterns with leaner prompts."
        },
        {
            question: "Is CrewAI's multi-agent approach better than AgentC2's?",
            answer: "CrewAI's sequential and hierarchical processes cover common patterns well. AgentC2's Networks and Campaigns support those same patterns plus parallel execution, conditional routing, human approval gates, and cross-organization federation."
        },
        {
            question: "Does AgentC2 support CrewAI's tool-sharing between agents?",
            answer: "AgentC2 tools are registered in a central tool registry and can be assigned to any agent. Agents in a network share tool access by default, with scoping controls to restrict sensitive tools."
        },
        {
            question: "Which is easier to learn for a beginner?",
            answer: "CrewAI has a smaller API surface and a clear mental model (roles, goals, tasks). AgentC2 has more features but provides an admin UI for no-code agent creation, making it accessible to both developers and non-technical operators."
        },
        {
            question: "Can I migrate from CrewAI to AgentC2?",
            answer: "Yes. Agent instructions, tool configurations, and orchestration patterns from CrewAI can be mapped to AgentC2 agents, tool registries, and networks. The main work is translating Python agent definitions to AgentC2's TypeScript or UI-based configuration."
        }
    ]
};
