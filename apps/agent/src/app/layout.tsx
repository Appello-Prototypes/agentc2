import { CommandPalette, type AppNavigationConfig } from "@repo/ui";

import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { AgentHeader } from "@/components/AgentHeader";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const appNavigation: AppNavigationConfig = {
    currentApp: "agent",
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost"
};

export default async function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect(process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost");
    }

    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <AppProvidersWrapper>
                    <AgentHeader />
                    {children}
                    <CommandPalette appNavigation={appNavigation} />
                </AppProvidersWrapper>
            </body>
        </html>
    );
}
