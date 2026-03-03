import type { ComparisonData } from "@/components/website/comparison/comparison-page-template"

export const n8nData: ComparisonData = {
    slug: "n8n",
    competitor: "n8n",
    competitorUrl: "https://n8n.io",
    heroSubtitle:
        "Workflow automation vs. AI agent operations — when linear flows meet autonomous reasoning",
    tldr: {
        them: "Open-source workflow automation platform. n8n connects apps with trigger-action flows, adding AI nodes for LLM calls within deterministic pipelines.",
        us: "AI-native agent operations platform where autonomous agents reason, plan, and act — with workflows as one orchestration primitive among many.",
        difference:
            "n8n automates tasks. AgentC2 deploys agents that think."
    },
    dimensions: [
        {
            name: "Core paradigm",
            them: "Workflow-first. Every process is a directed graph of nodes with deterministic execution. AI is bolted onto an automation engine — LLM calls are just another node in a pipeline.",
            us: "Agent-first. Agents reason over goals, select tools, and decide their own execution path. Workflows exist as one orchestration layer, but the core primitive is an autonomous agent.",
            whyItMatters:
                "Deterministic workflows break when the problem requires judgment. AI-native platforms let agents handle ambiguity without hard-coding every decision branch."
        },
        {
            name: "Intelligence & reasoning",
            them: "AI nodes invoke LLMs for text generation, classification, or summarization. The workflow still controls the flow — the LLM does not decide what happens next.",
            us: "Agents use chain-of-thought reasoning to decide which tools to invoke, when to ask for clarification, and when to escalate. The agent controls its own execution path.",
            whyItMatters:
                "Complex tasks — like triaging a customer issue across CRM, ticketing, and communication tools — require an agent that reasons, not a pipeline that follows rails."
        },
        {
            name: "Autonomy & self-correction",
            them: "Errors follow pre-defined error-handling branches. Workflows do not self-correct — if a step fails unexpectedly, the workflow halts or follows a hard-coded fallback.",
            us: "Agents retry with different strategies, reformulate queries, and adapt their approach based on intermediate results. Built-in eval scorers measure output quality and trigger self-improvement loops.",
            whyItMatters:
                "Production AI systems encounter novel failures constantly. Self-correcting agents reduce human intervention and improve over time."
        },
        {
            name: "Governance & compliance",
            them: "Role-based access to workflows. No token-level budget controls, no approval workflows for agent actions, no audit-grade logging of AI decisions.",
            us: "Budget hierarchies, human-in-the-loop approval workflows, role-based access at the agent/tool/workflow level, and comprehensive audit logging of every AI decision and tool invocation.",
            whyItMatters:
                "Regulated industries need provable controls over what AI can do, spend, and access. Workflow permissions alone are insufficient for autonomous AI systems."
        },
        {
            name: "Channels & deployment",
            them: "Workflows are triggered by webhooks, schedules, or app events. No built-in user-facing channels — building a Slack bot or voice agent requires custom integration.",
            us: "Seven deployment channels built in: web chat, voice, Slack, API, embeddable widget, SMS, and email. Every agent is instantly reachable on the channels your users prefer.",
            whyItMatters:
                "Agent value is realized at the point of interaction. If deploying to a new channel requires a new integration project, adoption slows."
        },
        {
            name: "Learning & improvement",
            them: "No built-in learning loop. Workflow improvements require manual editing. No mechanism for analyzing execution history and suggesting optimizations.",
            us: "Automated learning pipeline: extract signals from agent runs, generate improvement proposals, run A/B experiments, and apply approved changes — all with human oversight.",
            whyItMatters:
                "Agents that do not learn plateau quickly. Continuous improvement — governed by human approval — keeps agent quality rising without manual prompt tuning."
        },
        {
            name: "Federation & multi-org",
            them: "Self-hosted or cloud instances are single-tenant. Cross-organization workflow sharing requires manual export/import or custom API bridges.",
            us: "Encrypted cross-organization federation with scoped trust policies. Share agents, tools, and data across company boundaries with full audit trails.",
            whyItMatters:
                "Supply chain automation, partner ecosystems, and multi-company operations require agents that collaborate across organizational walls."
        }
    ],
    featureTable: [
        {
            feature: "Core primitive",
            us: "Autonomous agent",
            them: "Workflow node"
        },
        {
            feature: "AI reasoning",
            us: "Chain-of-thought",
            them: "LLM node calls"
        },
        {
            feature: "Multi-agent orchestration",
            us: "Networks + Campaigns",
            them: false
        },
        { feature: "Visual workflow builder", us: true, them: true },
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
            them: "Webhook/API"
        },
        { feature: "Marketplace", us: "Playbook Marketplace", them: false },
        { feature: "Federation", us: true, them: false },
        { feature: "Self-improving agents", us: true, them: false },
        {
            feature: "Integration count",
            us: "MCP ecosystem",
            them: "400+ native"
        },
        { feature: "Open source", us: "Core framework", them: true },
        { feature: "Self-hosted option", us: true, them: true }
    ],
    problemWeSolve:
        "n8n excels at deterministic automation — moving data between apps on triggers. But when tasks require judgment, adaptation, and multi-step reasoning, linear workflows cannot keep up. AgentC2 bridges the gap by providing autonomous agents that reason over goals, select their own tools, and improve over time — while still supporting deterministic workflows when you need them.",
    whoShouldChooseThem:
        "n8n is the right choice for teams that need deterministic, trigger-action automations across hundreds of app integrations. If your use case is well-defined — sync CRM contacts, route form submissions, transform data between systems — n8n's node-based builder is fast and reliable.",
    whoShouldChooseUs:
        "AgentC2 is built for teams deploying AI agents that must reason, adapt, and interact with users across multiple channels. If your workflows involve judgment calls, multi-step problem solving, voice interactions, or cross-organization collaboration, AgentC2 provides the agent-native platform that workflow tools cannot replicate.",
    faqs: [
        {
            question: "Can I use n8n workflows alongside AgentC2 agents?",
            answer: "Yes. AgentC2 integrates with n8n via the ATLAS MCP server, allowing agents to trigger n8n workflows as tools. This lets you keep proven automations in n8n while adding AI reasoning through AgentC2."
        },
        {
            question: "Does n8n have AI capabilities?",
            answer: "n8n offers AI nodes for LLM calls, embeddings, and vector store operations. However, the AI operates within the workflow's deterministic flow — it does not control execution. AgentC2 agents autonomously decide their execution path."
        },
        {
            question:
                "Is AgentC2 harder to set up than n8n?",
            answer: "AgentC2 provides an admin UI for no-code agent creation, similar to n8n's visual builder. For simple automations, n8n may be faster to set up. For AI agent deployments, AgentC2 is purpose-built and requires less custom integration."
        },
        {
            question:
                "Can AgentC2 replace all my n8n workflows?",
            answer: "AgentC2 is not a general-purpose automation tool — it is an AI agent platform. Simple data-sync workflows are better served by n8n. Complex, judgment-heavy processes benefit from AgentC2's agent-native approach. Many teams use both."
        },
        {
            question:
                "Which has more integrations?",
            answer: "n8n has 400+ native integrations. AgentC2 connects to external tools via MCP servers, which provide a growing ecosystem. For tools without an MCP server, AgentC2 agents can call any REST API as a custom tool."
        }
    ]
}
