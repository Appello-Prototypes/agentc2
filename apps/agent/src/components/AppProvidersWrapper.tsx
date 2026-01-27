"use client";

import { AppProviders } from "@repo/ui";
import { useRouter, usePathname } from "next/navigation";

export function AppProvidersWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <AppProviders router={router} pathname={pathname}>
            {children}
        </AppProviders>
    );
}
