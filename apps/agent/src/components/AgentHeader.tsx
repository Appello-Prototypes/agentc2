"use client";

import { AppTopBar } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname } from "next/navigation";

const navItems = [
    { label: "Workspace", href: "/workspace" },
    { label: "Live", href: "/live" },
    { label: "MCP", href: "/mcp" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/login");
    };

    const isActive = (href: string) => {
        if (href === "/workspace") {
            // Workspace is active for root and /workspace paths
            return pathname === "/" || pathname?.startsWith("/workspace");
        }
        return pathname?.startsWith(href);
    };

    return (
        <AppTopBar
            title="AgentC2"
            session={session}
            navItems={navItems}
            onSignOut={handleSignOut}
            isActive={isActive}
            app="agent"
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
