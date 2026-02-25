import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: "AgentC2 Network",
    robots: "noindex, nofollow"
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
};

export default function NetworkEmbedLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
