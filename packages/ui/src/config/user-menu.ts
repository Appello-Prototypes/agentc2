import type { HugeiconsProps } from "@hugeicons/react";
import { Settings02Icon, Logout03Icon } from "@hugeicons/core-free-icons";

export type UserMenuItem = {
    label: string;
    action: "settings" | "signout";
    variant?: "default" | "destructive";
    icon?: HugeiconsProps["icon"]; // Optional icon for command palette
    keywords?: string[]; // Optional keywords for command palette search
};

/**
 * Centralized user menu configuration
 * Used by: UserMenu dropdown and CommandPalette
 */
export const userMenuItems: UserMenuItem[] = [
    {
        label: "Settings",
        action: "settings",
        icon: Settings02Icon,
        keywords: ["settings", "preferences", "config", "options"]
    },
    {
        label: "Sign out",
        action: "signout",
        variant: "destructive",
        icon: Logout03Icon,
        keywords: ["logout", "signout", "exit", "leave"]
    }
];
