"use client";

import { AppTopBar } from "@repo/ui";
import Link from "next/link";
import { useSession, signOut } from "@repo/auth";
import { usePathname } from "next/navigation";

const navItems = [
    { label: "Home", href: "/" },
    { label: "Chat", href: "/chat" },
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
            title="Catalyst Agent"
            session={session}
            navItems={navItems}
            onSignOut={handleSignOut}
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
