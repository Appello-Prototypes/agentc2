import { icons, type IconComponent } from "../icons";

export type UserMenuItem = {
    label: string;
    action: "settings" | "signout";
    variant?: "default" | "destructive";
    icon?: IconComponent; // Optional icon for command palette
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
        icon: icons.settings,
        keywords: ["settings", "preferences", "config", "options"]
    },
    {
        label: "Sign out",
        action: "signout",
        variant: "destructive",
        icon: icons.logout,
        keywords: ["logout", "signout", "exit", "leave"]
    }
];
