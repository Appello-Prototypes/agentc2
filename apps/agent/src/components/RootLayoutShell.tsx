"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEmbedConfig } from "@/hooks/useEmbedConfig";

/**
 * Client-side shell that switches between three layout variants:
 *
 * 1. bareShell — embed pages (/embed/*): no nav, no providers
 * 2. embedWorkspaceShell — embed sessions (agentc2-embed cookie): partner branding, feature-gated nav
 * 3. appShell — normal authenticated users: full AgentHeader, command palette
 */
export function RootLayoutShell({
    appShell,
    bareShell,
    embedWorkspaceShell
}: {
    appShell: ReactNode;
    bareShell: ReactNode;
    embedWorkspaceShell: ReactNode;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const embedConfig = useEmbedConfig();

    // /embed/* pages always get the bare shell (Mode 1 bootstrap pages)
    if (pathname.startsWith("/embed")) {
        return <>{bareShell}</>;
    }

    // Authenticated embed sessions (Modes 2 & 3) — cookie was set by session bridge
    if (embedConfig) {
        return <>{embedWorkspaceShell}</>;
    }

    // Normal authenticated users
    return <>{appShell}</>;
}
