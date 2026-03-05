"use client";

import { useOrganization } from "./OrganizationProvider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    HugeiconsIcon,
    icons
} from "@repo/ui";
import { useRouter } from "next/navigation";

function OrgAvatar({
    name,
    logoUrl,
    size = "sm"
}: {
    name: string;
    logoUrl?: string | null;
    size?: "sm" | "md";
}) {
    const sizeClass = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt={name}
                className={`${sizeClass} shrink-0 rounded object-cover`}
            />
        );
    }

    const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div
            className={`bg-primary/10 text-primary ${sizeClass} flex shrink-0 items-center justify-center rounded font-semibold`}
        >
            {initials}
        </div>
    );
}

export function OrgSwitcher() {
    const { activeOrganization, organizations, loading, switchOrganization, switching } =
        useOrganization();
    const router = useRouter();

    if (loading || !activeOrganization) return null;

    // Single org - show name without dropdown
    if (organizations.length <= 1) {
        return (
            <div className="flex items-center gap-2 px-1">
                <OrgAvatar
                    name={activeOrganization.name}
                    logoUrl={activeOrganization.logoUrl}
                    size="sm"
                />
                <span className="text-muted-foreground max-w-[120px] truncate text-xs font-medium">
                    {activeOrganization.name}
                </span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label="Switch organization"
                className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors outline-none"
            >
                <OrgAvatar
                    name={activeOrganization.name}
                    logoUrl={activeOrganization.logoUrl}
                    size="sm"
                />
                <span className="max-w-[120px] truncate text-xs font-medium">
                    {activeOrganization.name}
                </span>
                <HugeiconsIcon
                    icon={icons["chevron-down"]!}
                    className="text-muted-foreground size-3"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="w-64">
                <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                    Organizations
                </div>
                {organizations.map((org) => {
                    const isActive = org.id === activeOrganization.id;
                    return (
                        <DropdownMenuItem
                            key={org.id}
                            onClick={() => {
                                if (!isActive) switchOrganization(org.id);
                            }}
                            className="flex items-center gap-3 py-2"
                        >
                            <OrgAvatar name={org.name} logoUrl={org.logoUrl} size="md" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{org.name}</div>
                                <div className="text-muted-foreground text-xs">{org.role}</div>
                            </div>
                            {isActive && (
                                <HugeiconsIcon
                                    icon={icons.tick!}
                                    className="text-primary size-4 shrink-0"
                                />
                            )}
                        </DropdownMenuItem>
                    );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="text-muted-foreground"
                >
                    <HugeiconsIcon icon={icons.settings!} className="mr-2 size-4" />
                    Manage organizations
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
