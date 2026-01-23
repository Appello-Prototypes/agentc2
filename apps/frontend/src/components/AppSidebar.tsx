"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarMenuButton,
    SidebarMenuItem
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIconProps, HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { useTheme } from "next-themes";

type SidebarItem = {
    label: string;
    icon: HugeiconsIconProps["icon"];
    href: string;
};
const sidebarItems: Array<SidebarItem & { children?: Array<SidebarItem> }> = [
    {
        label: "Dashboard",
        icon: SidebarLeftIcon,
        href: "/dashboard"
    }
];

export function AppSidebar() {
    const { data: session } = useSession();
    const { setTheme } = useTheme();

    const handleSignOut = async () => {
        await signOut();
        window.location.href = "/";
    };

    const getUserInitials = (name?: string, email?: string) => {
        if (name) {
            return name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
        }
        if (email) {
            return email.slice(0, 2).toUpperCase();
        }
        return "U";
    };

    return (
        <Sidebar>
            <SidebarHeader>
                <h1 className="text-2xl font-bold">Catalyst</h1>
                <div className="flex items-center gap-2">
                    <SidebarInput type="text" placeholder="Search" />
                </div>
            </SidebarHeader>
            <SidebarContent>
                {sidebarItems.map((item) =>
                    item.children ? (
                        <SidebarGroup key={item.href}>
                            <SidebarGroupLabel>{item.label}</SidebarGroupLabel>
                            <SidebarGroupContent>
                                {item.children?.map((child) => (
                                    <SidebarItemNode item={child} key={child.href} />
                                ))}
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ) : (
                        <SidebarItemNode item={item} key={item.href} />
                    )
                )}
            </SidebarContent>
            <SidebarFooter>
                {session?.user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger className="hover:bg-accent data-popup-open:bg-accent flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none">
                            <div className="bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                                {session.user.image ? (
                                    <img
                                        src={session.user.image ?? ""}
                                        alt={session.user.name}
                                        width={32}
                                        height={32}
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <span className="text-xs font-medium">
                                        {session.user.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium">{session.user.name}</p>
                                <p className="text-muted-foreground truncate text-xs">
                                    {session.user.email}
                                </p>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className="w-56"
                        >
                            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                                settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}

const SidebarItemNode = ({ item }: { item: SidebarItem }) => {
    return (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton>
                <Link href={item.href} className="flex items-center gap-2">
                    <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                    {item.label}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};
