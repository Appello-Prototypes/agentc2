import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette, SidebarProvider, type CommandPaletteCommand } from "@repo/ui";
import {
    DashboardSpeed01Icon,
    ShoppingCart01Icon,
    FolderOpenIcon
} from "@hugeicons/core-free-icons";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const commands: CommandPaletteCommand[] = [
    {
        label: "Dashboard Overview",
        icon: DashboardSpeed01Icon,
        path: "/dashboard"
    },
    {
        label: "Sales Dashboard",
        icon: ShoppingCart01Icon,
        path: "/dashboard/sales"
    },
    {
        label: "Examples",
        icon: FolderOpenIcon,
        path: "/examples"
    }
];

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
            <CommandPalette commands={commands} />
        </SidebarProvider>
    );
}
