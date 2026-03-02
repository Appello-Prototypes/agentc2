"use client";

import { AppTopBar, useCommand } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname, useRouter } from "next/navigation";
import { AgentBrand } from "@/components/AgentBrand";

const navItems = [
    { label: "Work", href: "/workspace" },
    {
        label: "Build",
        href: "/agents",
        children: [
            { label: "Agents", href: "/agents" },
            { label: "Workflows", href: "/workflows" },
            { label: "Networks", href: "/networks" },
            { label: "Skills", href: "/skills" },
            { label: "Campaigns", href: "/campaigns" },
            { label: "Pulse", href: "/pulse" }
        ]
    },
    { label: "Command", href: "/command" },
    { label: "Coordinate", href: "/schedule" },
    {
        label: "Observe",
        href: "/observe",
        children: [
            { label: "Dashboard", href: "/observe" },
            { label: "Runs", href: "/observe/runs" },
            { label: "Triggers", href: "/observe/triggers" },
            { label: "God Mode", href: "/godmode" }
        ]
    },
    { label: "Knowledge", href: "/knowledge" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const { toggleCommand } = useCommand();

    // Hide full nav during onboarding -- layout provides its own minimal header
    if (pathname?.startsWith("/onboarding")) {
        return null;
    }

    if (!session?.user) {
        return null;
    }

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/login");
    };

    const handleSettings = () => {
        router.push("/settings");
    };

    const isActive = (href: string) => {
        if (href === "/workspace") {
            return pathname === "/workspace";
        }
        if (href === "/observe") {
            return pathname === "/observe";
        }
        return pathname?.startsWith(href);
    };

    const handleHelp = () => {
        router.push("/support");
    };

    const handleCommunity = () => {
        router.push("/pulse");
    };

    const handleMarketplace = () => {
        router.push("/marketplace");
    };

    const handleIntegrations = () => {
        router.push("/mcp");
    };

    return (
        <AppTopBar
            title=""
            logo={<AgentBrand />}
            session={session}
            navItems={navItems}
            onSignOut={handleSignOut}
            onSettings={handleSettings}
            onSearchClick={toggleCommand}
            onHelp={handleHelp}
            onCommunity={handleCommunity}
            onMarketplace={handleMarketplace}
            onIntegrations={handleIntegrations}
            isActive={isActive}
            renderNavLink={(item, active) => (
                <Link
                    href={item.href}
                    className={`hover:text-primary text-sm font-medium transition-colors ${
                        active ? "text-foreground" : "text-muted-foreground"
                    }`}
                >
                    {item.label}
                </Link>
            )}
        />
    );
}
