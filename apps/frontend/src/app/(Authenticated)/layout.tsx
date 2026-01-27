"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette, SidebarProvider, type AppNavigationConfig } from "@repo/ui";

const appNavigation: AppNavigationConfig = {
    currentApp: "frontend",
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost"
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
