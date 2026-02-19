"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn, icons, HugeiconsIcon, Button, Badge } from "@repo/ui";
import type { IconName } from "@repo/ui";
import { DetailPageShell } from "@/components/DetailPageShell";
import { getApiBase } from "@/lib/utils";

interface SettingsNavItem {
    id: string;
    label: string;
    href: string;
    icon: IconName;
    description?: string;
    requiresRole?: ("owner" | "admin")[];
}

const settingsNavItems: SettingsNavItem[] = [
    {
        id: "profile",
        label: "Profile",
        href: "/settings/profile",
        icon: "user",
        description: "Your personal account settings"
    },
    {
        id: "appearance",
        label: "Appearance",
        href: "/settings/appearance",
        icon: "paint-board",
        description: "Theme and display preferences"
    },
    {
        id: "security",
        label: "Security",
        href: "/settings/security",
        icon: "shield",
        description: "Password and session management"
    },
    {
        id: "organization",
        label: "Organization",
        href: "/settings/organization",
        icon: "building",
        description: "Organization settings",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "billing",
        label: "Billing & Budget",
        href: "/settings/billing",
        icon: "dollar",
        description: "Plans, budgets, and usage controls",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "members",
        label: "Members",
        href: "/settings/members",
        icon: "user-group",
        description: "Team and role management",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "invites",
        label: "Invites",
        href: "/settings/invites",
        icon: "mail-send",
        description: "Invite codes and domains",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "workspaces",
        label: "Workspaces",
        href: "/settings/workspaces",
        icon: "folder",
        description: "Environment management",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "instances",
        label: "Agent Instances",
        href: "/settings/instances",
        icon: "git-branch",
        description: "Channel-scoped agent instances",
        requiresRole: ["owner", "admin"]
    },
    {
        id: "connections",
        label: "Connections",
        href: "/settings/connections",
        icon: "ai-network",
        description: "Cross-org agent federation",
        requiresRole: ["owner", "admin"]
    }
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const activeSection = pathname.split("/")[2] || "profile";
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        fetch(`${getApiBase()}/api/federation/connections`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    const pending = (data.connections || []).filter(
                        (c: { status: string; direction: string }) =>
                            c.status === "pending" && c.direction === "received"
                    );
                    setPendingCount(pending.length);
                }
            })
            .catch(() => {});
    }, []);

    return (
        <DetailPageShell
            sidebarTitle="Settings"
            mainClassName="mx-auto max-w-4xl p-4 md:p-6"
            sidebar={
                <>
                    {/* Header */}
                    <div className="border-b p-4">
                        <h1 className="text-lg font-semibold">Settings</h1>
                        <p className="text-muted-foreground text-sm">
                            Manage your account and organization
                        </p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-2 py-2">
                        <ul className="flex flex-col gap-0.5">
                            {settingsNavItems.map((item) => {
                                const isActive = activeSection === item.id;

                                return (
                                    <li key={item.id}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                isActive
                                                    ? "bg-accent text-accent-foreground font-medium"
                                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                            )}
                                        >
                                            <HugeiconsIcon
                                                icon={icons[item.icon]!}
                                                className="size-4 shrink-0"
                                                strokeWidth={1.5}
                                            />
                                            <span className="flex-1">{item.label}</span>
                                            {item.id === "connections" && pendingCount > 0 && (
                                                <Badge
                                                    variant="destructive"
                                                    className="ml-auto size-5 items-center justify-center rounded-full p-0 text-[10px]"
                                                >
                                                    {pendingCount}
                                                </Badge>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="border-t p-4">
                        <Link href="/agents" className="block">
                            <Button variant="outline" size="sm" className="w-full">
                                ← Back to Agents
                            </Button>
                        </Link>
                    </div>
                </>
            }
        >
            {children}
        </DetailPageShell>
    );
}
