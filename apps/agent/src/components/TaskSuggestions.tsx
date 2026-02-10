"use client";

import { useState, useEffect } from "react";
import { getApiBase } from "@/lib/utils";

interface SuggestionCard {
    title: string;
    description: string;
    prompt: string;
    agentSlug?: string;
    icon: string;
}

// ─── Icon derivation ─────────────────────────────────────────────────────────

const ICON_KEYWORDS: [string[], string][] = [
    [["research", "analyze", "search", "find"], "\uD83D\uDD0D"],
    [["support", "help", "service", "ticket"], "\uD83C\uDFA7"],
    [["trip", "travel", "vacation", "flight"], "\u2708\uFE0F"],
    [["write", "draft", "content", "copy"], "\u270D\uFE0F"],
    [["code", "develop", "engineer", "build"], "\uD83D\uDCBB"],
    [["data", "analytics", "report", "chart"], "\uD83D\uDCCA"],
    [["sales", "deal", "pipeline", "revenue"], "\uD83D\uDCB0"],
    [["email", "mail", "message", "outreach"], "\u2709\uFE0F"],
    [["schedule", "calendar", "meeting", "standup"], "\uD83D\uDCC5"],
    [["plan", "project", "roadmap", "strategy"], "\uD83D\uDDFA\uFE0F"],
    [["voice", "speak", "call", "phone"], "\uD83C\uDF99\uFE0F"],
    [["knowledge", "document", "wiki", "docs"], "\uD83D\uDCDA"],
    [["creative", "brainstorm", "idea"], "\uD83D\uDCA1"],
    [["slack", "chat", "communicate"], "\uD83D\uDCAC"],
    [["security", "audit", "compliance"], "\uD83D\uDD12"],
    [["onboard", "welcome", "getting started"], "\uD83C\uDF93"]
];

function deriveIcon(
    name: string,
    description: string | null,
    type: "agent" | "workflow" | "network"
): string {
    const text = `${name} ${description || ""}`.toLowerCase();
    for (const [keywords, icon] of ICON_KEYWORDS) {
        if (keywords.some((k) => text.includes(k))) return icon;
    }
    if (type === "workflow") return "\u2699\uFE0F";
    if (type === "network") return "\uD83D\uDD78\uFE0F";
    return "\uD83E\uDD16";
}

// ─── Prompt derivation ───────────────────────────────────────────────────────

function deriveAgentPrompt(name: string, description: string | null): string {
    if (!description) return `What can you help me with, ${name}?`;
    const d = description.toLowerCase();
    if (d.includes("support") || d.includes("service"))
        return "I need help with a customer issue. Can you look into it?";
    if (d.includes("research") || d.includes("analyze"))
        return "I need you to research a topic and give me a thorough summary.";
    if (d.includes("trip") || d.includes("travel"))
        return "Help me plan a trip. I'll give you the details.";
    if (d.includes("write") || d.includes("draft") || d.includes("content"))
        return "Help me draft a professional document.";
    if (d.includes("code") || d.includes("develop")) return "Help me with a coding task.";
    if (d.includes("data") || d.includes("analytic"))
        return "Help me analyze some data and find key insights.";
    if (d.includes("sales") || d.includes("deal"))
        return "Help me review the sales pipeline and find opportunities.";
    // Fallback: use first sentence of description as prompt context
    const firstSentence = description.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 10) {
        return `I'd like your help. ${firstSentence}.`;
    }
    return `What can you help me with?`;
}

function truncate(text: string | null | undefined, max: number): string {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "\u2026";
}

// ─── API response types ──────────────────────────────────────────────────────

interface AgentResponse {
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    type: "SYSTEM" | "USER";
    toolCount: number;
    updatedAt: string;
}

interface WorkflowResponse {
    slug: string;
    name: string;
    description: string | null;
    isPublished: boolean;
    isActive: boolean;
}

interface NetworkResponse {
    slug: string;
    name: string;
    description: string | null;
    isPublished: boolean;
    isActive: boolean;
    primitiveCount: number;
}

// ─── Meta-action cards (fallbacks for new platforms) ─────────────────────────

function getMetaActions(conciergeSlug: string): SuggestionCard[] {
    return [
        {
            title: "Create a new agent",
            description: "Design a custom AI assistant",
            prompt: "Help me create a new AI agent. Walk me through choosing a name, purpose, model, and tools it should have.",
            agentSlug: conciergeSlug,
            icon: "\uD83E\uDD16"
        },
        {
            title: "Build a workflow",
            description: "Automate a multi-step process",
            prompt: "Help me design and build a workflow that automates a business process. Ask me what I want to automate.",
            agentSlug: conciergeSlug,
            icon: "\u2699\uFE0F"
        },
        {
            title: "Connect integrations",
            description: "Link your tools and services",
            prompt: "What integrations are available on this platform? Help me understand which ones I should connect and walk me through setup.",
            agentSlug: conciergeSlug,
            icon: "\uD83D\uDD0C"
        },
        {
            title: "Design an agent network",
            description: "Orchestrate multiple agents",
            prompt: "Help me design a network where multiple specialized agents collaborate on complex tasks. What's the best architecture?",
            agentSlug: conciergeSlug,
            icon: "\uD83D\uDD78\uFE0F"
        },
        {
            title: "Explore the platform",
            description: "See what you can build",
            prompt: "Give me a tour of this platform's capabilities. What can I build with agents, workflows, networks, and integrations? Show me the highlights.",
            agentSlug: conciergeSlug,
            icon: "\u2728"
        }
    ];
}

// ─── Build suggestions from platform state ───────────────────────────────────

async function buildSuggestionsFromPlatform(apiBase: string): Promise<SuggestionCard[]> {
    // Fetch all platform data in parallel
    const [agentsRes, workflowsRes, networksRes] = await Promise.all([
        fetch(`${apiBase}/api/agents`).catch(() => null),
        fetch(`${apiBase}/api/workflows`).catch(() => null),
        fetch(`${apiBase}/api/networks`).catch(() => null)
    ]);

    // Parse responses
    let agents: AgentResponse[] = [];
    let workflows: WorkflowResponse[] = [];
    let networks: NetworkResponse[] = [];

    try {
        if (agentsRes?.ok) {
            const data = await agentsRes.json();
            if (data.success && Array.isArray(data.agents)) {
                agents = data.agents;
            }
        }
    } catch {
        /* ignore */
    }

    try {
        if (workflowsRes?.ok) {
            const data = await workflowsRes.json();
            if (data.success && Array.isArray(data.workflows)) {
                workflows = data.workflows;
            }
        }
    } catch {
        /* ignore */
    }

    try {
        if (networksRes?.ok) {
            const data = await networksRes.json();
            if (data.success && Array.isArray(data.networks)) {
                networks = data.networks;
            }
        }
    } catch {
        /* ignore */
    }

    // Determine concierge agent (for meta-action routing)
    const conciergeSlug =
        agents.find((a) => a.slug === "workspace-concierge" && a.isActive)?.slug ||
        agents.find((a) => a.slug === "assistant" && a.isActive)?.slug ||
        agents.find((a) => a.isActive)?.slug ||
        "assistant";

    // ── Tier 1: Agent-derived cards ──────────────────────────────────────
    const activeAgents = agents
        .filter((a) => a.isActive)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const agentCards: SuggestionCard[] = activeAgents.slice(0, 6).map((agent) => ({
        title: agent.name,
        description: truncate(agent.description, 45) || `${agent.toolCount} tools available`,
        prompt: deriveAgentPrompt(agent.name, agent.description),
        agentSlug: agent.slug,
        icon: deriveIcon(agent.name, agent.description, "agent")
    }));

    // ── Tier 2: Workflow-derived cards ───────────────────────────────────
    const publishedWorkflows = workflows.filter((w) => w.isActive && w.isPublished);

    const workflowCards: SuggestionCard[] = publishedWorkflows.slice(0, 3).map((wf) => ({
        title: wf.name,
        description: truncate(wf.description, 45) || "Automated workflow",
        prompt: `Run the "${wf.name}" workflow.${wf.description ? ` ${wf.description}` : ""}`,
        agentSlug: conciergeSlug,
        icon: deriveIcon(wf.name, wf.description, "workflow")
    }));

    // ── Tier 3: Network-derived cards ───────────────────────────────────
    const publishedNetworks = networks.filter((n) => n.isActive && n.isPublished);

    const networkCards: SuggestionCard[] = publishedNetworks.slice(0, 2).map((net) => ({
        title: net.name,
        description: truncate(net.description, 45) || `${net.primitiveCount} agents coordinated`,
        prompt: `Using the "${net.name}" network, help me get started.${net.description ? ` ${net.description}` : ""}`,
        agentSlug: conciergeSlug,
        icon: deriveIcon(net.name, net.description, "network")
    }));

    // ── Assemble final list ──────────────────────────────────────────────
    const cards: SuggestionCard[] = [];
    cards.push(...agentCards);
    cards.push(...workflowCards);
    cards.push(...networkCards);

    // Fill remaining slots with meta-actions (up to 12 total, min 4 shown)
    const metaActions = getMetaActions(conciergeSlug);
    // Skip "Connect integrations" if there are already many capabilities
    const filteredMeta =
        cards.length >= 8
            ? metaActions.filter((m) => m.title === "Explore the platform")
            : metaActions;

    for (const meta of filteredMeta) {
        if (cards.length >= 12) break;
        // Don't add duplicate-looking cards
        if (!cards.some((c) => c.title.toLowerCase() === meta.title.toLowerCase())) {
            cards.push(meta);
        }
    }

    // Ensure we always have at least 4 cards
    if (cards.length < 4) {
        for (const meta of metaActions) {
            if (cards.length >= 6) break;
            if (!cards.some((c) => c.title === meta.title)) {
                cards.push(meta);
            }
        }
    }

    return cards.slice(0, 12);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TaskSuggestionsProps {
    onSelect: (prompt: string, agentSlug?: string) => void;
}

export function TaskSuggestions({ onSelect }: TaskSuggestionsProps) {
    const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        buildSuggestionsFromPlatform(getApiBase())
            .then(setSuggestions)
            .catch(() => {
                // Fallback: show meta-actions with default agent
                setSuggestions(getMetaActions("assistant"));
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-muted/30 flex h-[58px] animate-pulse items-start gap-2.5 rounded-lg border border-transparent px-3 py-2.5"
                    >
                        <div className="bg-muted mt-px size-5 rounded" />
                        <div className="flex-1 space-y-1.5">
                            <div className="bg-muted h-3 w-3/4 rounded" />
                            <div className="bg-muted h-2.5 w-1/2 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (suggestions.length === 0) return null;

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestions.map((card, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(card.prompt, card.agentSlug)}
                    className="bg-card hover:border-foreground/20 hover:bg-accent/40 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all"
                >
                    <span className="mt-px text-base leading-none">{card.icon}</span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] leading-snug font-medium">{card.title}</div>
                        <div className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
                            {card.description}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
