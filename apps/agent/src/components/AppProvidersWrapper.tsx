"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { linkSocial } from "@repo/auth/client";
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { AppProviders } from "@repo/ui";
import { useSessionContext } from "@repo/auth/providers";

function GmailSyncOnLogin() {
    const { session } = useSessionContext();
    const searchParams = useSearchParams();
    const lastSyncedKey = useRef<string | null>(null);
    const gmailLinked = searchParams.get("gmail_linked") === "1";

    useEffect(() => {
        if (!session?.user?.id) {
            return;
        }

        const syncKey = `${session.user.id}:${gmailLinked ? "linked" : "base"}`;
        if (lastSyncedKey.current === syncKey) {
            return;
        }

        lastSyncedKey.current = syncKey;

        const syncGmail = async () => {
            try {
                const response = await fetch("/api/integrations/gmail/sync?silent=true", {
                    method: "POST"
                });
                const data = await response.json();

                if (
                    !data.success &&
                    Array.isArray(data.missingScopes) &&
                    data.missingScopes.length > 0
                ) {
                    const storageKey = `gmail-reauth-${session.user.id}`;
                    if (!sessionStorage.getItem(storageKey)) {
                        sessionStorage.setItem(storageKey, "1");
                        const callbackURL = (() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set("gmail_linked", "1");
                            return `${url.pathname}${url.search}`;
                        })();
                        await linkSocial({
                            provider: "google",
                            scopes: [...GOOGLE_OAUTH_SCOPES],
                            callbackURL
                        });
                    }
                }
            } catch {
                return;
            }
        };

        void syncGmail();
    }, [gmailLinked, session?.user?.id]);

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
