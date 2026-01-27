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
import { HugeiconsIcon } from "@hugeicons/react";
import type { HugeiconsProps } from "@hugeicons/react";
import { DashboardSpeed01Icon, AiNetworkIcon } from "@hugeicons/core-free-icons";

/**
 * Command configuration for command palette
 * Use one of: path (internal navigation), href (external/cross-app navigation), or action (custom function)
 */
export interface CommandPaletteCommand {
    label: string;
    icon: HugeiconsProps["icon"];
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

interface CommandPaletteProps {
    groups?: CommandPaletteGroup[];
    placeholder?: string;
    emptyMessage?: string;
    appNavigation?: AppNavigationConfig; // Optional: adds quick app switcher at top
}

/**
 * Enhanced Command Palette with support for:
 * - Multiple command groups
 * - Optional built-in app navigation (quick switcher)
 * - Internal navigation (Next.js router)
 * - External navigation (full page navigation)
 * - Custom actions
 */
export function CommandPalette({
    groups = [],
    placeholder = "Type a command or search...",
    emptyMessage = "No results found.",
    appNavigation
}: CommandPaletteProps) {
    const { open, setOpen, router, pathname } = useCommand();

    // Build optional quick app switcher group if enabled
    const appNavigationGroup: CommandPaletteGroup | null = appNavigation
        ? {
              heading: "Quick Switch",
              commands: [
                  {
                      label: "Frontend Dashboard",
                      icon: DashboardSpeed01Icon,
                      href: appNavigation.baseUrl,
                      keywords: ["main", "home", "dashboard", "switch"]
                  },
                  {
                      label: "Agent App",
                      icon: AiNetworkIcon,
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

    // Combine optional quick switcher with custom groups
    const allGroups = appNavigationGroup ? [appNavigationGroup, ...groups] : groups;

    const handleCommand = (cmd: CommandPaletteCommand) => {
        if (cmd.action) {
            cmd.action();
        } else if (cmd.href) {
            window.location.href = cmd.href;
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
                                    {cmd.icon && <HugeiconsIcon icon={cmd.icon} strokeWidth={2} />}
                                    {cmd.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {groupIndex < allGroups.length - 1 && <CommandSeparator />}
                    </div>
                ))}
            </CommandList>
        </CommandDialog>
    );
}
