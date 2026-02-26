"use client";

import { useEffect } from "react";

export default function EmbedSessionExpired() {
    useEffect(() => {
        if (window.parent !== window) {
            window.parent.postMessage({ type: "agentc2:session-expired" }, "*");
        }
    }, []);

    return (
        <div className="bg-background flex h-dvh w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 px-6 text-center">
                <p className="text-foreground text-sm font-medium">Session expired</p>
                <p className="text-muted-foreground max-w-sm text-xs">
                    Please close and reopen this panel to continue.
                </p>
            </div>
        </div>
    );
}
