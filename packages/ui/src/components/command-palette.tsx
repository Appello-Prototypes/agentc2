"use client";

import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator
} from "./command";
import { useCommand } from "./providers/command-provider";
import { icons, HugeiconsIcon, type IconComponent } from "../icons";
import { getAllNavigationItems, type NavigationItem } from "../config/navigation";
import { userMenuItems, type UserMenuItem } from "../config/user-menu";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { signOut } from "@repo/auth";

/**
 * Command configuration for command palette
 * Use one of: path (internal navigation), href (external/cross-app navigation), or action (custom function)
 */
export interface CommandPaletteCommand {
    label: string;
    icon: IconComponent;
    path?: string; // For internal Next.js navigation
    href?: string; // For external/cross-app navigation (full page reload)
    action?: () => void; // For custom actions
    keywords?: string[]; // Optional keywords for better search
}

/**
 * Group of related commands
 */
export interface CommandPaletteGroup {
    heading: string;
    commands: CommandPaletteCommand[];
}

/**
 * Configuration for built-in app navigation between Next.js instances
 */
export interface AppNavigationConfig {
    currentApp: "frontend" | "agent";
    baseUrl: string; // e.g., "https://catalyst.localhost"
}

/**
 * Optional user action overrides for command palette
 * If not provided, default behaviors will be used:
 * - onSignOut: Better Auth signOut + redirect to home
 * - onSettings: Opens built-in settings dialog
 */
export interface UserActions {
    onSignOut?: () => void | Promise<void>; // Override default signout behavior
    onSettings?: () => void; // Override default settings dialog
}

interface CommandPaletteProps {
    groups?: CommandPaletteGroup[]; // Additional custom groups (merged with defaults)
    placeholder?: string;
    emptyMessage?: string;
    appNavigation?: AppNavigationConfig; // Optional: adds quick app switcher and default navigation
    userActions?: UserActions; // Optional: override default user action behaviors
    enableUserMenu?: boolean; // Optional: show user menu commands (default: true when appNavigation is provided)
}

/**
 * Convert NavigationItem to CommandPaletteCommand
 * Determines whether to use internal routing (path) or cross-app navigation (href)
 */
function navigationItemToCommand(
    item: NavigationItem,
    currentApp: "frontend" | "agent",
    baseUrl: string
): CommandPaletteCommand {
    const isCurrentApp = item.app === currentApp;

    // For current app, use internal routing (path)
    // For other apps, use cross-app navigation (href)
    if (isCurrentApp) {
        // Convert absolute href to relative path for current app
        const path = item.href.startsWith(`/${item.app}`)
            ? item.href.replace(`/${item.app}`, "") || "/"
            : item.href;

        return {
            label: item.label,
            icon: item.icon,
            path,
            keywords: item.keywords
        };
    } else {
        return {
            label: item.label,
            icon: item.icon,
            href: `${baseUrl}${item.href}`,
            keywords: item.keywords
        };
    }
}

/**
 * Build user menu group from centralized user menu config
 * Provides default implementations for common actions
 */
function buildUserMenuGroup(
    baseUrl: string,
    userActions?: UserActions,
    setSettingsOpen?: (open: boolean) => void
): CommandPaletteGroup | null {
    // Default sign out handler
    const defaultSignOut = async () => {
        await signOut();
        if (typeof window !== "undefined") {
            window.location.replace(baseUrl);
        }
    };

    // Default settings handler
    const defaultSettings = () => setSettingsOpen?.(true);

    const commands: CommandPaletteCommand[] = userMenuItems
        .map((item): CommandPaletteCommand | null => {
            let action: (() => void) | undefined;

            switch (item.action) {
                case "settings":
                    action = userActions?.onSettings || defaultSettings;
                    break;
                case "signout":
                    action = userActions?.onSignOut || defaultSignOut;
                    break;
            }

            if (!action || !item.icon) return null;

            return {
                label: item.label,
                icon: item.icon,
                action,
                keywords: item.keywords
            };
        })
        .filter((cmd): cmd is CommandPaletteCommand => cmd !== null);

    if (commands.length === 0) return null;

    return {
        heading: "Account",
        commands
    };
}

/**
 * Build default navigation groups from centralized navigation config
 * Uses internal routing (path) for current app, cross-app navigation (href) for other apps
 */
function buildDefaultNavigationGroups(config?: AppNavigationConfig): CommandPaletteGroup[] {
    if (!config) return [];

    const { currentApp, baseUrl } = config;
    const allNavItems = getAllNavigationItems();

    // Group navigation items by app
    const frontendItems = allNavItems.filter((item) => item.app === "frontend");
    const agentItems = allNavItems.filter((item) => item.app === "agent");

    // Build commands for each app group
    const frontendCommands: CommandPaletteCommand[] = [];
    frontendItems.forEach((item) => {
        if (item.children) {
            // Add child items as individual commands
            item.children.forEach((child) => {
                const isCurrentApp = item.app === currentApp;
                const path = isCurrentApp ? child.href : undefined;
                const href = !isCurrentApp ? `${baseUrl}${child.href}` : undefined;

                frontendCommands.push({
                    label: child.label,
                    icon: item.icon,
                    ...(path && { path }),
                    ...(href && { href }),
                    keywords: child.keywords
                });
            });
        } else {
            frontendCommands.push(navigationItemToCommand(item, currentApp, baseUrl));
        }
    });

    const agentCommands: CommandPaletteCommand[] = agentItems.map((item) =>
        navigationItemToCommand(item, currentApp, baseUrl)
    );

    const frontendGroup: CommandPaletteGroup = {
        heading: "Frontend",
        commands: frontendCommands
    };

    const agentGroup: CommandPaletteGroup = {
        heading: "Agent",
        commands: agentCommands
    };

    // Return groups in order: current app first
    return currentApp === "frontend" ? [frontendGroup, agentGroup] : [agentGroup, frontendGroup];
}

/**
 * Enhanced Command Palette with support for:
 * - Built-in default navigation for frontend and agent apps
 * - Multiple custom command groups (merged with defaults)
 * - Optional quick app switcher
 * - User menu commands (settings, signout, etc.) with automatic defaults
 * - Internal navigation (Next.js router)
 * - External navigation (full page navigation)
 * - Custom actions
 */
export function CommandPalette({
    groups = [],
    placeholder = "Type a command or search...",
    emptyMessage = "No results found.",
    appNavigation,
    userActions,
    enableUserMenu = true // Default to true
}: CommandPaletteProps) {
    const { open, setOpen, router, pathname } = useCommand();
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Build optional quick app switcher group if enabled
    const appNavigationGroup: CommandPaletteGroup | null = appNavigation
        ? {
              heading: "Quick Switch",
              commands: [
                  {
                      label: "Frontend Dashboard",
                      icon: icons.dashboard!,
                      href: appNavigation.baseUrl,
                      keywords: ["main", "home", "dashboard", "switch"]
                  },
                  {
                      label: "Agent App",
                      icon: icons["ai-network"]!,
                      href: `${appNavigation.baseUrl}/agent`,
                      keywords: ["ai", "assistant", "bot", "switch"]
                  }
              ].filter(
                  // Filter out current app from list
                  (cmd) =>
                      !(
                          (appNavigation.currentApp === "frontend" &&
                              cmd.href === appNavigation.baseUrl) ||
                          (appNavigation.currentApp === "agent" &&
                              cmd.href === `${appNavigation.baseUrl}/agent`)
                      )
              )
          }
        : null;

    // Build default navigation groups based on current app
    const defaultNavigationGroups = buildDefaultNavigationGroups(appNavigation);

    // Build user menu group if enabled and we have a baseUrl
    const userMenuGroup =
        enableUserMenu && appNavigation
            ? buildUserMenuGroup(appNavigation.baseUrl, userActions, setSettingsOpen)
            : null;

    // Combine all groups: quick switcher + default navigation + custom groups + user menu
    const allGroups = [
        ...(appNavigationGroup ? [appNavigationGroup] : []),
        ...defaultNavigationGroups,
        ...groups,
        ...(userMenuGroup ? [userMenuGroup] : [])
    ];

    const handleCommand = (cmd: CommandPaletteCommand) => {
        if (cmd.action) {
            cmd.action();
        } else if (cmd.href) {
            if (typeof window !== "undefined") {
                window.location.replace(cmd.href);
            }
        } else if (cmd.path) {
            router.push(cmd.path);
        }
        setOpen(false);
    };

    const isCurrentPath = (cmd: CommandPaletteCommand) => {
        if (cmd.path) {
            return pathname === cmd.path;
        }
        return false;
    };

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={placeholder} />
                <CommandList>
                    <CommandEmpty>{emptyMessage}</CommandEmpty>
                    {allGroups.map((group, groupIndex) => (
                        <div key={group.heading}>
                            <CommandGroup heading={group.heading}>
                                {group.commands.map((cmd, cmdIndex) => (
                                    <CommandItem
                                        key={`${group.heading}-${cmdIndex}`}
                                        onSelect={() => handleCommand(cmd)}
                                        data-current={isCurrentPath(cmd)}
                                        keywords={cmd.keywords}
                                    >
                                        {cmd.icon && (
                                            <HugeiconsIcon icon={cmd.icon} strokeWidth={2} />
                                        )}
                                        {cmd.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            {groupIndex < allGroups.length - 1 && <CommandSeparator />}
                        </div>
                    ))}
                </CommandList>
            </CommandDialog>

            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-muted-foreground text-sm">
                            Settings functionality coming soon...
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
