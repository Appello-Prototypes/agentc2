"use client";

import { AppTopBar } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth/client";
import { usePathname } from "next/navigation";

const navItems = [
    { label: "Overview", href: "/demos" },
    { label: "Chat", href: "/chat" },
    { label: "Agents", href: "/demos/agents" },
    { label: "Workflows", href: "/demos/workflows" },
    { label: "Memory", href: "/demos/memory" },
    { label: "RAG", href: "/demos/rag" },
    { label: "Evals", href: "/demos/evals" },
    { label: "MCP", href: "/demos/mcp" },
    { label: "Voice", href: "/demos/voice" }
];

export function AgentHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const handleSignOut = async () => {
        await signOut();
        window.location.replace("/");
    };

    const isActive = (href: string) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname?.startsWith(href);
    };

    return (
        <AppTopBar
            title="Mastra Playground"
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
