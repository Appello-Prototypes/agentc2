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
        label: "Agents",
        icon: icons.dashboard,
        href: "/agents",
        app: "agent",
        keywords: ["agents", "manage", "monitor", "configure", "analytics", "home"]
    },
    {
        label: "Workflows",
        icon: icons["git-branch"],
        href: "/workflows",
        app: "agent",
        keywords: ["workflows", "builder", "automation", "steps", "runs", "traces"]
    },
    {
        label: "Networks",
        icon: icons["ai-network"],
        href: "/networks",
        app: "agent",
        keywords: ["networks", "routing", "multi-agent", "orchestration", "topology"]
    },
    {
        label: "Monitoring",
        icon: icons.activity,
        href: "/live",
        app: "agent",
        keywords: ["monitoring", "live", "production", "runs", "real-time"]
    },
    {
        label: "BIM",
        icon: icons.folder,
        href: "/bim",
        app: "agent",
        keywords: [
            "bim",
            "building",
            "model",
            "ifc",
            "navisworks",
            "revit",
            "takeoff",
            "clash",
            "construction"
        ],
        children: [
            {
                label: "Models",
                href: "/bim",
                keywords: ["models", "list", "versions", "upload"]
            },
            {
                label: "Takeoffs",
                href: "/bim/takeoffs",
                keywords: ["takeoff", "quantities", "materials", "bom"]
            },
            {
                label: "Clash Detection",
                href: "/bim/clashes",
                keywords: ["clash", "collision", "interference", "conflicts"]
            },
            {
                label: "Version Diffs",
                href: "/bim/diffs",
                keywords: ["diff", "compare", "changes", "versions"]
            }
        ]
    },
    {
        label: "Integrations",
        icon: icons["ai-network"],
        href: "/mcp",
        app: "agent",
        keywords: [
            "integrations",
            "mcp",
            "model context protocol",
            "tools",
            "servers",
            "connections"
        ],
        children: [
            {
                label: "Connections",
                href: "/mcp",
                keywords: ["connections", "servers", "tools", "status"]
            },
            {
                label: "Webhooks",
                href: "/mcp/webhooks",
                keywords: ["webhooks", "inbound", "triggers", "zapier", "make"]
            },
            {
                label: "Setup for Cursor",
                href: "/mcp/setup",
                keywords: ["setup", "cursor", "configure", "install", "ide"]
            },
            {
                label: "Gmail",
                href: "/mcp/gmail",
                keywords: ["gmail", "email", "integration", "oauth"]
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
    },
    {
        label: "Settings",
        icon: icons.settings,
        href: "/settings",
        app: "agent",
        keywords: [
            "settings",
            "account",
            "profile",
            "organization",
            "members",
            "invites",
            "security"
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
