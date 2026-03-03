import type { ComparisonData } from "@/components/website/comparison/comparison-page-template"

export const openaiData: ComparisonData = {
    slug: "openai",
    competitor: "OpenAI",
    competitorUrl: "https://openai.com",
    heroSubtitle:
        "Model provider vs. agent operations platform — intelligence is not enough",
    tldr: {
        them: "The leading AI model provider. OpenAI offers GPT-4o, the Assistants API, and the Responses API — world-class intelligence accessible through API endpoints.",
        us: "An agent operations platform that uses OpenAI (and other providers) as its intelligence layer — adding orchestration, governance, multi-channel deployment, and enterprise operations on top.",
        difference:
            "OpenAI provides the brain. AgentC2 provides the nervous system, skeleton, and organs."
    },
    dimensions: [
        {
            name: "Model flexibility",
            them: "Locked to OpenAI models. The Assistants API and GPTs only work with GPT-4o, GPT-4o-mini, and other OpenAI models. Switching providers requires rewriting your application.",
            us: "Model-agnostic. Use OpenAI, Anthropic, or any Vercel AI SDK-compatible provider. Switch models per agent without changing application code.",
            whyItMatters:
                "Model leadership rotates. Locking to a single provider means you cannot adopt the best model for each task — or negotiate pricing across providers."
        },
        {
            name: "Multi-agent orchestration",
            them: "The Assistants API supports single-agent conversations with tool use. Multi-agent coordination requires custom orchestration code — OpenAI provides no routing, delegation, or campaign primitives.",
            us: "Networks for declarative multi-agent routing, campaigns for parallel fan-out, and workflows for stateful multi-step processes. First-class orchestration, not an afterthought.",
            whyItMatters:
                "Complex operations — research pipelines, multi-stage approval flows, cross-functional analysis — require coordinated agent teams, not isolated assistants."
        },
        {
            name: "Governance & enterprise controls",
            them: "API usage limits and organization-level billing. No agent-level budget controls, no approval workflows, no role-based access to individual agents or tools.",
            us: "Budget hierarchies per agent, team, and organization. Human-in-the-loop approval workflows. Role-based access control. Comprehensive audit logging of every agent decision.",
            whyItMatters:
                "Enterprise deployment requires granular controls. Org-level API limits do not prevent a single rogue agent from burning through your monthly budget in an hour."
        },
        {
            name: "Channels & deployment",
            them: "API-first. GPTs provide a chat UI within ChatGPT. The Assistants API is an endpoint — deploying to Slack, voice, SMS, or a custom UI requires building the integration yourself.",
            us: "Seven deployment channels built in: web chat, voice, Slack, API, embeddable widget, SMS, and email. Deploy once, deliver everywhere.",
            whyItMatters:
                "Agents need to meet users where they are. Building and maintaining channel integrations per agent is expensive and error-prone."
        },
        {
            name: "Enterprise readiness",
            them: "SOC 2 compliant with enterprise API agreements. But the platform is model-serving, not agent-operating — you get compute, not an ops layer.",
            us: "Enterprise operations platform: multi-tenant architecture, config versioning with rollback, federated cross-org collaboration, and a Playbook Marketplace for organizational reuse.",
            whyItMatters:
                "Enterprise AI needs more than API access. It needs versioned configurations, team-based access controls, and operational tooling that IT teams can manage."
        },
        {
            name: "Learning & improvement",
            them: "Fine-tuning available for model customization. No built-in learning pipeline that analyzes agent runs and suggests instruction improvements automatically.",
            us: "Automated learning pipeline: extract signals from agent runs, generate improvement proposals, run A/B experiments, and apply approved changes with human oversight.",
            whyItMatters:
                "Fine-tuning improves the model. Learning pipelines improve the agent — its instructions, tool selection, and decision-making — without the cost and complexity of training."
        },
        {
            name: "Marketplace & reuse",
            them: "GPT Store offers user-created GPTs. These are single-agent chat configurations — no multi-agent patterns, governance presets, or tool bundles.",
            us: "Playbook Marketplace for complete agent operational configurations — instructions, tool sets, guardrails, eval criteria, and workflow patterns — as importable, production-ready packages.",
            whyItMatters:
                "The GPT Store shares chat personas. A Playbook Marketplace shares battle-tested operational patterns that accelerate enterprise deployment."
        }
    ],
    featureTable: [
        {
            feature: "Model providers",
            us: "OpenAI + Anthropic + more",
            them: "OpenAI only"
        },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: false
        },
        { feature: "Visual workflow builder", us: true, them: false },
        { feature: "Built-in admin UI", us: true, them: "ChatGPT UI" },
        { feature: "Multi-tenant governance", us: true, them: false },
        { feature: "Budget controls (per-agent)", us: true, them: false },
        { feature: "Approval workflows", us: true, them: false },
        {
            feature: "Voice agents",
            us: "ElevenLabs + OpenAI",
            them: "Realtime API (raw)"
        },
        {
            feature: "Deployment channels",
            us: "7+ built-in",
            them: "API only"
        },
        {
            feature: "Marketplace",
            us: "Playbook Marketplace",
            them: "GPT Store"
        },
        { feature: "Federation", us: true, them: false },
        { feature: "RAG pipeline", us: "Built-in", them: "Assistants API" },
        { feature: "Self-improving agents", us: true, them: false },
        {
            feature: "MCP tool integration",
            us: "Native",
            them: "Limited"
        }
    ],
    problemWeSolve:
        "OpenAI provides world-class model intelligence, but intelligence alone does not make a production agent system. Teams still need orchestration, governance, multi-channel delivery, and continuous improvement. AgentC2 uses OpenAI (and other providers) as its intelligence layer and adds the full operational stack — so you get the best models with the best operational platform.",
    whoShouldChooseThem:
        "OpenAI is the right choice if you need raw model access for custom applications, want to fine-tune models on proprietary data, or are building within the ChatGPT/GPT ecosystem. If your use case is a single assistant with simple tool use, OpenAI's Assistants API may be sufficient.",
    whoShouldChooseUs:
        "AgentC2 is built for teams deploying production agent systems that need multi-model flexibility, multi-agent orchestration, enterprise governance, multi-channel deployment, and continuous learning. AgentC2 uses OpenAI as one of its model providers — you get OpenAI's intelligence plus the operational platform to run it at scale.",
    faqs: [
        {
            question: "Does AgentC2 use OpenAI under the hood?",
            answer: "Yes. OpenAI is one of AgentC2's supported model providers. You can configure any agent to use GPT-4o, GPT-4o-mini, or other OpenAI models — alongside Anthropic Claude models. The platform is model-agnostic."
        },
        {
            question:
                "How is AgentC2 different from OpenAI's Assistants API?",
            answer: "The Assistants API provides a single-agent conversation with tool use and file retrieval. AgentC2 provides multi-agent orchestration, multi-channel deployment, enterprise governance, a marketplace, and continuous learning — the full operational layer that the Assistants API does not cover."
        },
        {
            question: "Can I use GPTs from the GPT Store in AgentC2?",
            answer: "GPTs are proprietary to the ChatGPT interface and cannot be directly imported. However, you can recreate any GPT's instructions, tool configuration, and behavior as an AgentC2 agent with the added benefits of governance, multi-channel deployment, and orchestration."
        },
        {
            question:
                "Is AgentC2 more expensive than using OpenAI directly?",
            answer: "AgentC2 adds platform value on top of model costs. You still pay OpenAI for API usage, and AgentC2's platform features — governance, channels, marketplace, learning — reduce operational costs that would otherwise require custom engineering."
        },
        {
            question:
                "Does AgentC2 support OpenAI's Realtime API for voice?",
            answer: "Yes. AgentC2 supports both OpenAI Realtime API and ElevenLabs for voice agents, giving you flexibility in voice quality, latency, and cost."
        }
    ]
}
