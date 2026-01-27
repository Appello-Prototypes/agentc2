import { CommandPalette, type AppNavigationConfig } from "@repo/ui";

import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { AgentHeader } from "@/components/AgentHeader";

const appNavigation: AppNavigationConfig = {
    currentApp: "agent",
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost"
};

/**
 * Root layout for the agent app
 * Note: Authentication is handled by proxy.ts at the app level
 */
export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
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
