import { CommandPalette, type CommandPaletteGroup, type AppNavigationConfig } from "@repo/ui";
import {
    HomeIcon,
    DashboardSpeed01Icon,
    ShoppingCart01Icon,
    FolderOpenIcon
} from "@hugeicons/core-free-icons";

import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { AgentHeader } from "@/components/AgentHeader";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost";

const commandGroups: CommandPaletteGroup[] = [
    {
        heading: "Agent",
        commands: [
            {
                label: "Agent Home",
                icon: HomeIcon,
                path: "/",
                keywords: ["home", "main", "start"]
            },
            {
                label: "Agent Dashboard",
                icon: DashboardSpeed01Icon,
                path: "/dashboard",
                keywords: ["dashboard", "overview", "stats"]
            }
        ]
    },
    {
        heading: "Frontend",
        commands: [
            {
                label: "Dashboard Overview",
                icon: DashboardSpeed01Icon,
                href: `${baseUrl}/dashboard`,
                keywords: ["home", "overview", "main", "frontend"]
            },
            {
                label: "Sales Dashboard",
                icon: ShoppingCart01Icon,
                href: `${baseUrl}/dashboard/sales`,
                keywords: ["sales", "revenue", "analytics", "frontend"]
            },
            {
                label: "Examples",
                icon: FolderOpenIcon,
                href: `${baseUrl}/examples`,
                keywords: ["demos", "samples", "frontend"]
            }
        ]
    }
];

const appNavigation: AppNavigationConfig = {
    currentApp: "agent",
    baseUrl
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
                    <CommandPalette groups={commandGroups} appNavigation={appNavigation} />
                </AppProvidersWrapper>
            </body>
        </html>
    );
}
