import type { HugeiconsProps } from "@hugeicons/react";
import { HomeIcon, DashboardSpeed01Icon } from "@hugeicons/core-free-icons";

export type NavigationItem = {
    label: string;
    icon: HugeiconsProps["icon"];
    href: string;
    children?: Array<{
        label: string;
        href: string;
    }>;
};

export const navigationItems: NavigationItem[] = [
    {
        label: "Agent",
        icon: HomeIcon,
        href: "/agent"
    },
    {
        label: "Dashboard",
        icon: DashboardSpeed01Icon,
        href: "/dashboard",
        children: [
            {
                label: "Overview",
                href: "/dashboard"
            },
            {
                label: "Sales",
                href: "/dashboard/sales"
            }
        ]
    }
];
