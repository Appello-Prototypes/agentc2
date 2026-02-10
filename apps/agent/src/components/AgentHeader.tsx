"use client";

import { AppTopBar } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname, useRouter } from "next/navigation";
import { AgentBrand } from "@/components/AgentBrand";

const navItems = [
    { label: "Chat", href: "/" },
    { label: "Canvas", href: "/canvas" },
    { label: "Agents", href: "/agents" },
    { label: "Workflows", href: "/workflows" },
    { label: "Networks", href: "/networks" },
    { label: "Live Runs", href: "/live" },
    { label: "Automations", href: "/triggers" },
    { label: "Knowledge", href: "/knowledge" },
    { label: "Integrations", href: "/mcp" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

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
        if (href === "/") {
            return pathname === "/";
        }
        return pathname?.startsWith(href);
    };

    return (
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
    );
}
