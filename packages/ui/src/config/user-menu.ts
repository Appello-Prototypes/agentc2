import { icons, type IconComponent } from "../icons";

export type UserMenuItem = {
    label: string;
    action: "settings" | "support" | "signout";
    variant?: "default" | "destructive";
    icon?: IconComponent;
    keywords?: string[];
};

/**
 * Centralized user menu configuration
 * Used by: UserMenu dropdown and CommandPalette
 */
export const userMenuItems: UserMenuItem[] = [
    {
        label: "Settings",
        action: "settings",
        icon: icons.settings,
        keywords: ["settings", "preferences", "config", "options"]
    },
    {
        label: "Support",
        action: "support",
        icon: icons["help-circle"],
        keywords: ["support", "help", "ticket", "contact"]
    },
    {
        label: "Sign out",
        action: "signout",
        variant: "destructive",
        icon: icons.logout,
        keywords: ["logout", "signout", "exit", "leave"]
    }
];
