import { AppSidebar } from "@/components/AppSidebar";
import {
    CommandPalette,
    SidebarProvider,
    type CommandPaletteGroup,
    type AppNavigationConfig
} from "@repo/ui";
import {
    DashboardSpeed01Icon,
    ShoppingCart01Icon,
    FolderOpenIcon,
    HomeIcon,
    AiNetworkIcon
} from "@hugeicons/core-free-icons";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost";

const commandGroups: CommandPaletteGroup[] = [
    {
        heading: "Frontend",
        commands: [
            {
                label: "Dashboard Overview",
                icon: DashboardSpeed01Icon,
                path: "/dashboard",
                keywords: ["home", "overview", "main"]
            },
            {
                label: "Sales Dashboard",
                icon: ShoppingCart01Icon,
                path: "/dashboard/sales",
                keywords: ["sales", "revenue", "analytics"]
            },
            {
                label: "Examples",
                icon: FolderOpenIcon,
                path: "/examples",
                keywords: ["demos", "samples"]
            }
        ]
    },
    {
        heading: "Agent",
        commands: [
            {
                label: "Agent Home",
                icon: HomeIcon,
                href: `${baseUrl}/agent`,
                keywords: ["agent", "ai", "assistant", "home"]
            },
            {
                label: "Agent Dashboard",
                icon: AiNetworkIcon,
                href: `${baseUrl}/agent/dashboard`,
                keywords: ["agent", "ai", "dashboard", "stats"]
            }
        ]
    }
];

const appNavigation: AppNavigationConfig = {
    currentApp: "frontend",
    baseUrl
};

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/");
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1">{children}</main>
            <CommandPalette groups={commandGroups} appNavigation={appNavigation} />
        </SidebarProvider>
    );
}
