import { icons, type IconComponent } from "../icons";

export const NavigationAppValues = ["frontend", "agent"] as const;
export type NavigationApp = (typeof NavigationAppValues)[number];

export type NavigationItem = {
    label: string;
    icon: IconComponent;
    href: string;
    app: NavigationApp; // Which app this item belongs to
    keywords?: string[]; // For command palette search
    children?: Array<{
        label: string;
        href: string;
        keywords?: string[];
    }>;
};

/**
 * Centralized navigation configuration for AgentWorkplace
 * Used by: TopBar and CommandPalette
 */
export const navigationItems: NavigationItem[] = [
    // Primary navigation - AgentWorkplace
    {
        label: "Workspace",
        icon: icons.dashboard,
        href: "/workspace",
        app: "agent",
        keywords: ["workspace", "agents", "manage", "monitor", "configure", "analytics", "home"]
    },
    {
        label: "Live",
        icon: icons.activity,
        href: "/live",
        app: "agent",
        keywords: ["live", "production", "monitoring", "runs", "real-time"]
    },
    {
        label: "MCP",
        icon: icons["ai-network"],
        href: "/mcp",
        app: "agent",
        keywords: ["mcp", "model context protocol", "tools", "servers", "connections"],
        children: [
            {
                label: "Connections",
                href: "/mcp",
                keywords: ["connections", "servers", "tools", "status"]
            },
            {
                label: "Setup for Cursor",
                href: "/mcp/setup",
                keywords: ["setup", "cursor", "configure", "install", "ide"]
            }
        ]
    },
    // Secondary navigation - Demos (accessible via command palette)
    {
        label: "Demos",
        icon: icons["folder-open"],
        href: "/demos",
        app: "agent",
        keywords: ["demos", "examples", "playground"],
        children: [
            {
                label: "Agents",
                href: "/demos/agents",
                keywords: ["agents", "structured", "vision", "research"]
            },
            {
                label: "Agent Management",
                href: "/demos/agents/manage",
                keywords: ["agent", "manage", "config", "settings"]
            },
            {
                label: "Agent Network",
                href: "/demos/agent-network",
                keywords: ["network", "multi-agent", "orchestration"]
            },
            {
                label: "Workflows",
                href: "/demos/workflows",
                keywords: ["workflows", "parallel", "branch"]
            },
            {
                label: "Memory",
                href: "/demos/memory",
                keywords: ["memory", "semantic", "recall"]
            },
            {
                label: "RAG",
                href: "/demos/rag",
                keywords: ["rag", "retrieval", "documents"]
            },
            {
                label: "Evals",
                href: "/demos/evals",
                keywords: ["evals", "evaluation", "scoring"]
            },
            {
                label: "Voice",
                href: "/demos/voice",
                keywords: ["voice", "speech", "tts", "stt"]
            },
            {
                label: "Live Agent (MCP)",
                href: "/demos/live-agent-mcp",
                keywords: ["live", "agent", "voice", "elevenlabs"]
            },
            {
                label: "Observability",
                href: "/demos/observability",
                keywords: ["observability", "traces", "debugging"]
            }
        ]
    },
    {
        label: "Chat",
        icon: icons.messages,
        href: "/chat",
        app: "agent",
        keywords: ["chat", "assistant", "conversation", "ai"]
    }
];

/**
 * Get navigation items for a specific app
 */
export function getNavigationItemsForApp(app: NavigationApp): NavigationItem[] {
    return navigationItems.filter((item) => item.app === app);
}

/**
 * Get all navigation items (for cross-app navigation like CommandPalette)
 */
export function getAllNavigationItems(): NavigationItem[] {
    return navigationItems;
}
