import type { Metadata } from "next";
import { TimezoneProvider } from "@/lib/timezone-context";
import { getServerTimezone } from "@/lib/timezone-server";

import "@/styles/globals.css";

export const metadata: Metadata = {
    title: {
        default: "Admin Portal",
        template: "%s | Admin Portal"
    },
    description: "Internal administration portal for platform management."
};

export default async function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    const timezone = await getServerTimezone();

    return (
        <html lang="en" suppressHydrationWarning>
            <body className="h-dvh overflow-hidden">
                <TimezoneProvider initialTimezone={timezone}>{children}</TimezoneProvider>
            </body>
        </html>
    );
}
