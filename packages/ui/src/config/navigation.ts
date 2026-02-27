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
    // Primary navigation
    {
        label: "Workspace",
        icon: icons.home,
        href: "/workspace",
        app: "agent",
        keywords: ["workspace", "chat", "assistant", "conversation", "ai", "home"]
    },
    {
        label: "Campaigns",
        icon: icons["play-circle"],
        href: "/campaigns",
        app: "agent",
        keywords: ["campaigns", "missions", "autopilot", "autonomous", "long-running"]
    },
    {
        label: "Pulse",
        icon: icons.activity,
        href: "/pulse",
        app: "agent",
        keywords: [
            "pulse",
            "collective",
            "community",
            "evaluation",
            "rewards",
            "capacity",
            "agents"
        ]
    },
    // Build group
    {
        label: "Agents",
        icon: icons.dashboard,
        href: "/agents",
        app: "agent",
        keywords: ["agents", "manage", "monitor", "configure", "analytics", "build"]
    },
    {
        label: "Workflows",
        icon: icons["git-branch"],
        href: "/workflows",
        app: "agent",
        keywords: ["workflows", "builder", "automation", "steps", "runs", "traces", "build"]
    },
    {
        label: "Networks",
        icon: icons["ai-network"],
        href: "/networks",
        app: "agent",
        keywords: ["networks", "routing", "multi-agent", "orchestration", "topology", "build"]
    },
    {
        label: "Skills",
        icon: icons["task-list"],
        href: "/skills",
        app: "agent",
        keywords: ["skills", "instructions", "tools", "documents", "build"]
    },
    // Schedule
    {
        label: "Schedule",
        icon: icons.calendar,
        href: "/schedule",
        app: "agent",
        keywords: [
            "schedule",
            "automations",
            "triggers",
            "cron",
            "webhooks",
            "calendar",
            "registry"
        ]
    },
    // Observe
    {
        label: "Observe",
        icon: icons.activity,
        href: "/observe",
        app: "agent",
        keywords: [
            "observe",
            "monitoring",
            "live",
            "runs",
            "traces",
            "activity",
            "triggers",
            "real-time"
        ]
    },
    // Knowledge
    {
        label: "Knowledge",
        icon: icons.folder,
        href: "/knowledge",
        app: "agent",
        keywords: ["knowledge", "rag", "documents", "vectors", "search"]
    },
    // Integrations
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
    // Marketplace (not in main nav but searchable via command palette)
    {
        label: "Marketplace",
        icon: icons["shopping-cart"],
        href: "/marketplace",
        app: "agent",
        keywords: ["marketplace", "playbooks", "templates", "browse", "install", "deploy"],
        children: [
            {
                label: "Browse",
                href: "/marketplace",
                keywords: ["browse", "search", "discover", "playbooks"]
            },
            {
                label: "Installed",
                href: "/marketplace/installed",
                keywords: ["installed", "deployed", "my playbooks"]
            }
        ]
    },
    {
        label: "Playbooks",
        icon: icons.folder,
        href: "/playbooks",
        app: "agent",
        keywords: ["playbooks", "publish", "package", "builder", "sell"],
        children: [
            {
                label: "My Playbooks",
                href: "/playbooks",
                keywords: ["published", "my", "manage"]
            },
            {
                label: "New Playbook",
                href: "/playbooks/new",
                keywords: ["create", "new", "package"]
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
    // BIM (feature-flagged, accessible via command palette)
    {
        label: "BIM",
        icon: icons.building,
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
    // Utility (accessible via command palette and user menu)
    {
        label: "Support",
        icon: icons["help-circle"],
        href: "/support",
        app: "agent",
        keywords: ["support", "help", "ticket", "contact"]
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
