"use client";

import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem
} from "./command";
import { useCommand } from "./providers/command-provider";
import { HugeiconsIcon } from "@hugeicons/react";
import type { HugeiconsProps } from "@hugeicons/react";

export interface CommandPaletteCommand {
    label: string;
    icon: HugeiconsProps["icon"];
    path: string;
}

interface CommandPaletteProps {
    commands: CommandPaletteCommand[];
    placeholder?: string;
    emptyMessage?: string;
    groupHeading?: string;
}

export function CommandPalette({
    commands,
    placeholder = "Search pages...",
    emptyMessage = "No results found.",
    groupHeading = "Navigation"
}: CommandPaletteProps) {
    const { open, setOpen, router, pathname } = useCommand();

    const handleNavigate = (path: string) => {
        router.push(path);
        setOpen(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder={placeholder} />
            <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup heading={groupHeading}>
                    {commands.map((cmd) => (
                        <CommandItem
                            key={cmd.path}
                            onSelect={() => handleNavigate(cmd.path)}
                            data-current={pathname === cmd.path}
                        >
                            {cmd.icon && <HugeiconsIcon icon={cmd.icon} strokeWidth={2} />}
                            {cmd.label}
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
