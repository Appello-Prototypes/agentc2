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
    SidebarMenuItem,
    UserMenu,
    navigationItems,
    type NavigationItem
} from "@repo/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth";

export function AppSidebar() {
    const { data: session } = useSession();

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/");
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
                {navigationItems.map((item) =>
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
                    <UserMenu
                        side="top"
                        align="start"
                        sideOffset={8}
                        onSignOut={handleSignOut}
                        trigger={
                            <div className="hover:bg-accent data-popup-open:bg-accent flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none">
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
                                    <p className="truncate text-sm font-medium">
                                        {session.user.name}
                                    </p>
                                    <p className="text-muted-foreground truncate text-xs">
                                        {session.user.email}
                                    </p>
                                </div>
                            </div>
                        }
                    />
                )}
            </SidebarFooter>
        </Sidebar>
    );
}

const SidebarItemNode = ({
    item
}: {
    item: NavigationItem | NonNullable<NavigationItem["children"]>[number];
}) => {
    const isExternalApp = item.href === "/agent" || item.href.startsWith("/agent/");
    const hasIcon = "icon" in item;

    return (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton>
                {isExternalApp ? (
                    <a href={item.href} className="flex items-center gap-2">
                        {hasIcon && <HugeiconsIcon icon={item.icon} strokeWidth={2} />}
                        {item.label}
                    </a>
                ) : (
                    <Link href={item.href} className="flex items-center gap-2">
                        {hasIcon && <HugeiconsIcon icon={item.icon} strokeWidth={2} />}
                        {item.label}
                    </Link>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};
