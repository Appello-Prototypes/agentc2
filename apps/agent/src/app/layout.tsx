import { CommandPalette, type CommandPaletteCommand } from "@repo/ui";
import { HomeIcon, DashboardSpeed01Icon } from "@hugeicons/core-free-icons";

import "@/styles/globals.css";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";

const commands: CommandPaletteCommand[] = [
    {
        label: "Agent Home",
        icon: HomeIcon,
        path: "/"
    },
    {
        label: "Agent Dashboard",
        icon: DashboardSpeed01Icon,
        path: "/dashboard"
    }
];

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <AppProvidersWrapper>
                    {children}
                    <CommandPalette commands={commands} />
                </AppProvidersWrapper>
            </body>
        </html>
    );
}
