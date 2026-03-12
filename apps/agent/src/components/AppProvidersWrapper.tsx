"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppProviders } from "@repo/ui";
import { useSessionContext } from "@repo/auth/providers";
import { TimezoneProvider } from "@/components/TimezoneProvider";
import { OrganizationProvider } from "@/components/OrganizationProvider";

function GmailSyncOnLogin() {
    const { session } = useSessionContext();
    const lastSyncedKey = useRef<string | null>(null);

    useEffect(() => {
        if (!session?.user?.id) {
            return;
        }

        const syncKey = `gmail:${session.user.id}`;
        if (lastSyncedKey.current === syncKey) {
            return;
        }

        lastSyncedKey.current = syncKey;

        const syncGmail = async () => {
            try {
                await fetch("/api/integrations/gmail/sync?silent=true", {
                    method: "POST"
                });
            } catch {
                return;
            }
        };

        void syncGmail();
    }, [session?.user?.id]);

    return null;
}

function MicrosoftSyncOnLogin() {
    const { session } = useSessionContext();
    const lastSyncedKey = useRef<string | null>(null);

    useEffect(() => {
        if (!session?.user?.id) {
            return;
        }

        const syncKey = `ms:${session.user.id}`;
        if (lastSyncedKey.current === syncKey) {
            return;
        }
        lastSyncedKey.current = syncKey;

        const syncMicrosoft = async () => {
            try {
                await fetch("/api/integrations/microsoft/sync?silent=true", {
                    method: "POST"
                });
            } catch {
                return;
            }
        };

        void syncMicrosoft();
    }, [session?.user?.id]);

    return null;
}

export function AppProvidersWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <AppProviders router={router} pathname={pathname}>
            <OrganizationProvider>
                <TimezoneProvider>
                    <GmailSyncOnLogin />
                    <MicrosoftSyncOnLogin />
                    {children}
                </TimezoneProvider>
            </OrganizationProvider>
        </AppProviders>
    );
}
