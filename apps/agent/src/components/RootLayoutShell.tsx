"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Client-side shell that switches between the full app layout (with sidebar,
 * header, command palette) and a bare layout for embed pages.
 *
 * This is necessary because Next.js App Router doesn't support conditional
 * root layouts based on the current pathname from a Server Component.
 */
export function RootLayoutShell({
    appShell,
    bareShell
}: {
    appShell: ReactNode;
    bareShell: ReactNode;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const isEmbed = pathname.startsWith("/embed");

    if (isEmbed) {
        return <>{bareShell}</>;
    }

    return <>{appShell}</>;
}
