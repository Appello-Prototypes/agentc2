"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn, icons, HugeiconsIcon, Button } from "@repo/ui";
import type { IconName } from "@repo/ui";
import { DetailPageShell } from "@/components/DetailPageShell";

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
    }
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const activeSection = pathname.split("/")[2] || "profile";

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
                                            <span>{item.label}</span>
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
