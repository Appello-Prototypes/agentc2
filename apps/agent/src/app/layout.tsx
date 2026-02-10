import type { Metadata } from "next";
import { Suspense } from "react";
import { CommandPalette, type AppNavigationConfig } from "@repo/ui";
import { getAppUrl } from "@repo/auth";

import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { AgentHeader } from "@/components/AgentHeader";

export const metadata: Metadata = {
    title: {
        default: "AgentC2",
        template: "%s | AgentC2"
    },
    description:
        "Build, deploy, and improve AI agents with workflows, networks, and continuous learning.",
    keywords: ["AI agents", "LLM orchestration", "AI workflows", "agent networks", "MCP"]
};

const appNavigation: AppNavigationConfig = {
    currentApp: "agent",
    baseUrl: getAppUrl("https://catalyst.localhost")
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
            <body className="h-dvh overflow-hidden">
                <Suspense fallback={null}>
                    <AppProvidersWrapper>
                        <div className="flex h-full flex-col">
                            <AgentHeader />
                            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                        </div>
                        <CommandPalette appNavigation={appNavigation} />
                    </AppProvidersWrapper>
                </Suspense>
            </body>
        </html>
    );
}
