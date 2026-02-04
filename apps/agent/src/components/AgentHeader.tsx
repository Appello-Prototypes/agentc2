"use client";

import { AppTopBar, AgentC2Logo } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
    { label: "Agents", href: "/workspace" },
    { label: "Workflows", href: "/workflows" },
    { label: "Networks", href: "/networks" },
    { label: "Monitoring", href: "/live" },
    { label: "BIM", href: "/bim" },
    { label: "Integrations", href: "/mcp" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/login");
    };

    const handleSettings = () => {
        router.push("/settings");
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
            logo={<AgentC2Logo size={28} />}
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
    );
}
