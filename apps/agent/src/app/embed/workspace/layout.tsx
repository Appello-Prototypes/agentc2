import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: "Loading...",
    robots: { index: false, follow: false }
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1
};

export default function EmbedWorkspaceLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
