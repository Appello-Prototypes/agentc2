"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppProviders } from "@repo/ui";
import { useSessionContext } from "@repo/auth/providers";

function GmailSyncOnLogin() {
    const { session } = useSessionContext();
    const lastSyncedUserId = useRef<string | null>(null);

    useEffect(() => {
        if (!session?.user?.id || lastSyncedUserId.current === session.user.id) {
            return;
        }

        lastSyncedUserId.current = session.user.id;
        fetch("/api/integrations/gmail/sync?silent=true", { method: "POST" }).catch(
            () => undefined
        );
    }, [session?.user?.id]);

    return null;
}

export function AppProvidersWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <AppProviders router={router} pathname={pathname}>
            <GmailSyncOnLogin />
            {children}
        </AppProviders>
    );
}
