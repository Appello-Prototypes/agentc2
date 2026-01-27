"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette, SidebarProvider, type AppNavigationConfig } from "@repo/ui";
import { getAppUrl } from "@repo/auth";

const appNavigation: AppNavigationConfig = {
    currentApp: "frontend",
    baseUrl: getAppUrl("https://catalyst.localhost")
};

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1">{children}</main>
            <CommandPalette appNavigation={appNavigation} />
        </SidebarProvider>
    );
}
