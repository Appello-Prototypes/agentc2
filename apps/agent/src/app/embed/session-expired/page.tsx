"use client";

import { useEffect } from "react";

function deleteCookie(name: string) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
}

export default function EmbedSessionExpired() {
    useEffect(() => {
        const isIframe = window.parent !== window;

        if (isIframe) {
            window.parent.postMessage({ type: "agentc2:session-expired" }, "*");
        } else {
            deleteCookie("agentc2-embed");
            window.location.replace("/login");
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
