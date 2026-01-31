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
    // Agent navigation
    {
        label: "Home",
        icon: icons.home,
        href: "/",
        app: "agent",
        keywords: ["home", "agent", "main"]
    },
    {
        label: "Chat",
        icon: icons.messages,
        href: "/chat",
        app: "agent",
        keywords: ["chat", "assistant", "conversation", "ai"]
    },
    {
        label: "Demos",
        icon: icons["folder-open"],
        href: "/demos",
        app: "agent",
        keywords: ["demos", "examples", "primitives"],
        children: [
            {
                label: "Overview",
                href: "/demos",
                keywords: ["demos", "overview", "all"]
            },
            {
                label: "Agents",
                href: "/demos/agents",
                keywords: ["agents", "structured", "vision", "research"]
            },
            {
                label: "Workflows",
                href: "/demos/workflows",
                keywords: ["workflows", "parallel", "branch", "loop"]
            },
            {
                label: "Memory",
                href: "/demos/memory",
                keywords: ["memory", "semantic", "recall", "working"]
            },
            {
                label: "RAG",
                href: "/demos/rag",
                keywords: ["rag", "retrieval", "documents", "embeddings"]
            },
            {
                label: "Evals",
                href: "/demos/evals",
                keywords: ["evals", "evaluation", "scoring", "metrics"]
            },
            {
                label: "MCP",
                href: "/demos/mcp",
                keywords: ["mcp", "model context protocol", "tools"]
            }
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
