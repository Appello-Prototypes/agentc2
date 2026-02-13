import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: "AgentC2",
    robots: "noindex, nofollow"
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
};

/**
 * Minimal layout for embed-v2 pages -- no navigation, no sidebar, no auth providers.
 * Just renders children in a clean shell with the app's theme.
 */
export default function EmbedV2Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
