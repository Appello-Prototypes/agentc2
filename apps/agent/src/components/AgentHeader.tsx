"use client";

import { AppTopBar, useCommand } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname, useRouter } from "next/navigation";
import { AgentBrand } from "@/components/AgentBrand";

const navItems = [
    { label: "Workspace", href: "/workspace" },
    { label: "Campaigns", href: "/campaigns" },
    {
        label: "Build",
        href: "/agents",
        children: [
            { label: "Agents", href: "/agents" },
            { label: "Workflows", href: "/workflows" },
            { label: "Networks", href: "/networks" },
            { label: "Skills", href: "/skills" }
        ]
    },
    { label: "Schedule", href: "/schedule" },
    { label: "Observe", href: "/observe" },
    { label: "Knowledge", href: "/knowledge" },
    { label: "Integrations", href: "/mcp" }
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
        return pathname?.startsWith(href);
    };

    const handleHelp = () => {
        router.push("/support");
    };

    const handleCommunity = () => {
        router.push("/community");
    };

    const handleMarketplace = () => {
        router.push("/marketplace");
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
