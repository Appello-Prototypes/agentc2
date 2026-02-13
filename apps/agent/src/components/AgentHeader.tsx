"use client";

import { AppTopBar } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname, useRouter } from "next/navigation";
import { AgentBrand } from "@/components/AgentBrand";
import { ConnectionPowerBar } from "@/components/ConnectionPowerBar";

const navItems = [
    { label: "Workspace", href: "/workspace" },
    { label: "Canvas", href: "/canvas" },
    { label: "Agents", href: "/agents" },
    { label: "Workflows", href: "/workflows" },
    { label: "Networks", href: "/networks" },
    { label: "Live Runs", href: "/live" },
    { label: "Automations", href: "/triggers" },
    { label: "Knowledge", href: "/knowledge" },
    { label: "Skills", href: "/skills" },
    { label: "Integrations", href: "/mcp" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

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

    const showPowerBar = process.env.NEXT_PUBLIC_FEATURE_NEW_ONBOARDING === "true";

    return (
        <>
            <AppTopBar
                title=""
                logo={<AgentBrand />}
                session={session}
                navItems={navItems}
                onSignOut={handleSignOut}
                onSettings={handleSettings}
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
            {showPowerBar && (
                <div className="border-border bg-background/95 border-b px-4 py-1">
                    <ConnectionPowerBar compact />
                </div>
            )}
        </>
    );
}
