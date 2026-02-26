"use client";

import { useMemo } from "react";
import type { EmbedSessionConfig } from "@/lib/embed-deployment";

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(
        new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]!) : null;
}

function isInIframe(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return window.self !== window.top;
    } catch {
        return true;
    }
}

/**
 * Read and parse the `agentc2-embed` cookie set by the session bridge API.
 * Only returns the config when running inside an iframe — prevents the embed
 * cookie from hijacking the main site when a user visits agentc2.ai directly.
 */
export function useEmbedConfig(): EmbedSessionConfig | null {
    return useMemo(() => {
        if (!isInIframe()) return null;
        const raw = getCookie("agentc2-embed");
        if (!raw) return null;
        try {
            return JSON.parse(raw) as EmbedSessionConfig;
        } catch {
            return null;
        }
    }, []);
}

/**
 * Convenience check — true when the current session is an embed session.
 */
export function useIsEmbed(): boolean {
    return useEmbedConfig() !== null;
}
