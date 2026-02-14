"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy setup page — redirects to the Integrations Hub "Connect Your Tools" tab.
 * All setup content has been moved inline to the main hub page.
 */
export default function McpSetupPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/mcp");
    }, [router]);

    return (
        <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">Redirecting to Integrations Hub...</p>
        </div>
    );
}
