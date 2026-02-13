import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
    title: {
        default: "Admin Portal",
        template: "%s | Admin Portal"
    },
    description: "Internal administration portal for platform management."
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="h-dvh overflow-hidden">{children}</body>
        </html>
    );
}
