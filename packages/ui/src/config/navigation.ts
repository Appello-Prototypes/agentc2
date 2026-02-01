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
 * Centralized navigation configuration for all apps
 * Used by: Sidebar, TopBar, and CommandPalette
 */
export const navigationItems: NavigationItem[] = [
    // Frontend navigation
    {
        label: "Dashboard",
        icon: icons.dashboard,
        href: "/dashboard",
        app: "frontend",
        keywords: ["home", "overview", "main"],
        children: [
            {
                label: "Overview",
                href: "/dashboard",
                keywords: ["home", "overview", "main", "dashboard"]
            },
            {
                label: "Sales",
                href: "/dashboard/sales",
                keywords: ["sales", "revenue", "analytics"]
            }
        ]
    },
    {
        label: "Examples",
        icon: icons["folder-open"],
        href: "/examples",
        app: "frontend",
        keywords: ["demos", "samples", "examples"]
    },
    // Agent navigation (Mastra Playground)
    {
        label: "Overview",
        icon: icons.home,
        href: "/demos",
        app: "agent",
        keywords: ["home", "overview", "demos", "all"]
    },
    {
        label: "Chat",
        icon: icons.messages,
        href: "/chat",
        app: "agent",
        keywords: ["chat", "assistant", "conversation", "ai"]
    },
    {
        label: "Agent Network",
        icon: icons["folder-open"],
        href: "/demos/agent-network",
        app: "agent",
        keywords: [
            "network",
            "multi-agent",
            "orchestration",
            "trip",
            "planner",
            "routing",
            "workflows"
        ]
    },
    {
        label: "Agents",
        icon: icons["folder-open"],
        href: "/demos/agents",
        app: "agent",
        keywords: ["agents", "structured", "vision", "research", "manage"],
        children: [
            {
                label: "Agent Demos",
                href: "/demos/agents",
                keywords: ["agents", "structured", "vision", "research", "demo"]
            },
            {
                label: "Agent Management",
                href: "/demos/agents/manage",
                keywords: ["agent", "manage", "config", "settings", "instructions", "tools"]
            }
        ]
    },
    {
        label: "Workflows",
        icon: icons["folder-open"],
        href: "/demos/workflows",
        app: "agent",
        keywords: ["workflows", "parallel", "branch", "loop"]
    },
    {
        label: "Memory",
        icon: icons["folder-open"],
        href: "/demos/memory",
        app: "agent",
        keywords: ["memory", "semantic", "recall", "working"]
    },
    {
        label: "RAG",
        icon: icons["folder-open"],
        href: "/demos/rag",
        app: "agent",
        keywords: ["rag", "retrieval", "documents", "embeddings"]
    },
    {
        label: "Evals",
        icon: icons["folder-open"],
        href: "/demos/evals",
        app: "agent",
        keywords: ["evals", "evaluation", "scoring", "metrics"]
    },
    {
        label: "MCP",
        icon: icons["folder-open"],
        href: "/demos/mcp",
        app: "agent",
        keywords: ["mcp", "model context protocol", "tools"]
    },
    {
        label: "Voice",
        icon: icons["folder-open"],
        href: "/demos/voice",
        app: "agent",
        keywords: ["voice", "speech", "tts", "stt", "audio", "elevenlabs"],
        children: [
            {
                label: "Voice Agent",
                href: "/demos/voice",
                keywords: ["voice", "speech", "tts", "stt", "audio", "elevenlabs"]
            },
            {
                label: "Live Agent (MCP)",
                href: "/demos/live-agent-mcp",
                keywords: ["live", "agent", "mcp", "voice", "elevenlabs", "realtime", "tools"]
            }
        ]
    },
    {
        label: "Observability",
        icon: icons["folder-open"],
        href: "/demos/observability",
        app: "agent",
        keywords: [
            "observability",
            "traces",
            "monitoring",
            "debugging",
            "tools",
            "dashboard",
            "tracing"
        ]
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
