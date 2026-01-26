"use client"

import { useRouter, usePathname } from "next/navigation"
import { useCommandPalette } from "@/hooks/use-command-palette"
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    DashboardSpeed01Icon,
    ShoppingCart01Icon,
    FolderOpenIcon
} from "@hugeicons/core-free-icons"

export function CommandPalette() {
    const router = useRouter()
    const pathname = usePathname()
    const { open, setOpen } = useCommandPalette()

    const handleNavigate = (path: string) => {
        router.push(path)
        setOpen(false)
    }

    const commands = [
        {
            label: "Dashboard Overview",
            icon: DashboardSpeed01Icon,
            onSelect: () => handleNavigate("/dashboard"),
            path: "/dashboard"
        },
        {
            label: "Sales Dashboard",
            icon: ShoppingCart01Icon,
            onSelect: () => handleNavigate("/dashboard/sales"),
            path: "/dashboard/sales"
        },
        {
            label: "Examples",
            icon: FolderOpenIcon,
            onSelect: () => handleNavigate("/examples"),
            path: "/examples"
        },
    ]

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search pages..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    {commands.map((cmd) => (
                        <CommandItem
                            key={cmd.path}
                            onSelect={cmd.onSelect}
                            data-current={pathname === cmd.path}
                        >
                            <HugeiconsIcon
                                icon={cmd.icon}
                                strokeWidth={2}
                            />
                            {cmd.label}
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
