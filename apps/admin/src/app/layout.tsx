import type { Metadata } from "next";
import { ThemeProvider } from "@repo/ui";
import { TimezoneProvider } from "@/lib/timezone-context";
import { getServerTimezone } from "@/lib/timezone-server";

import "@/styles/globals.css";

export const metadata: Metadata = {
    title: {
        default: "AgentC2 Admin Portal",
        template: "%s | AgentC2 Admin"
    },
    description: "AgentC2 administration portal for platform management."
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
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <TimezoneProvider initialTimezone={timezone}>{children}</TimezoneProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
