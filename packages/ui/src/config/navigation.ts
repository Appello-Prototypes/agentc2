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
        label: "Agent",
        icon: icons.home,
        href: "/agent",
        app: "agent",
        keywords: ["agent", "ai", "assistant"]
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
