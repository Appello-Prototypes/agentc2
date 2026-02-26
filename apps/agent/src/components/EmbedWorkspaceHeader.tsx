"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@repo/auth/client";
import { cn, AgentC2Logo } from "@repo/ui";
import type { EmbedSessionConfig } from "@/lib/embed-deployment";

const FEATURE_TO_NAV: Record<string, { label: string; href: string }> = {
    chat: { label: "Chat", href: "/workspace" },
    agents: { label: "Agents", href: "/agents" },
    workflows: { label: "Workflows", href: "/workflows" },
    networks: { label: "Networks", href: "/networks" },
    skills: { label: "Skills", href: "/skills" },
    knowledge: { label: "Knowledge", href: "/knowledge" },
    observe: { label: "Observe", href: "/observe" },
    schedule: { label: "Schedule", href: "/schedule" },
    integrations: { label: "Integrations", href: "/mcp" },
    settings: { label: "Settings", href: "/settings" },
    campaigns: { label: "Campaigns", href: "/campaigns" }
};

function PartnerBrand({ config }: { config: EmbedSessionConfig }) {
    if (config.branding?.logoUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={config.branding.logoUrl}
                alt={config.branding.appName || ""}
                className="h-6 max-w-[120px] object-contain"
            />
        );
    }
    if (config.branding?.appName) {
        return (
            <span className="text-foreground text-sm font-semibold">{config.branding.appName}</span>
        );
    }
    return (
        <div className="flex items-center gap-[2px]">
            <span className="text-sm font-semibold">Agent</span>
            <AgentC2Logo size={22} />
        </div>
    );
}

interface EmbedWorkspaceHeaderProps {
    config: EmbedSessionConfig;
}

export function EmbedWorkspaceHeader({ config }: EmbedWorkspaceHeaderProps) {
    const { data: session } = useSession();
    const pathname = usePathname();

    const navItems = config.features.map((f) => FEATURE_TO_NAV[f]).filter(Boolean) as {
        label: string;
        href: string;
    }[];

    const isActive = (href: string) => {
        if (href === "/workspace") return pathname === "/workspace";
        return pathname?.startsWith(href);
    };

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/embed/workspace");
    };

    return (
        <header className="border-border bg-background/95 flex h-12 shrink-0 items-center border-b px-4 backdrop-blur">
            {/* Brand */}
            <div className="mr-6 flex items-center">
                <PartnerBrand config={config} />
            </div>

            {/* Navigation (Mode 3 only — Mode 2 has no nav) */}
            {config.mode === "workspace" && navItems.length > 1 && (
                <nav className="flex items-center gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                                isActive(item.href)
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* User */}
            {session?.user && (
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                        {session.user.name || session.user.email}
                    </span>
                    <button
                        onClick={handleSignOut}
                        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            )}
        </header>
    );
}

/**
 * Minimal brand bar for Mode 2 (agent mode) — just logo + agent name + user.
 */
export function EmbedBrandBar({ config }: { config: EmbedSessionConfig }) {
    const { data: session } = useSession();

    return (
        <header className="border-border bg-background/95 flex h-10 shrink-0 items-center border-b px-4 backdrop-blur">
            <PartnerBrand config={config} />
            <div className="flex-1" />
            {session?.user && (
                <span className="text-muted-foreground text-xs">
                    {session.user.name || session.user.email}
                </span>
            )}
        </header>
    );
}
