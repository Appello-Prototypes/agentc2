"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    Users,
    Flag,
    Activity,
    FileText,
    Settings,
    Shield,
    ClipboardList,
    Bug,
    Globe2,
    CreditCard,
    TrendingUp
} from "lucide-react";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tenants", label: "Tenants", icon: Building2 },
    { href: "/users", label: "Users", icon: Users },
    { href: "/financials", label: "Financials", icon: TrendingUp },
    { href: "/plans", label: "Plans & Pricing", icon: CreditCard },
    { href: "/tickets", label: "Tickets", icon: Bug },
    { href: "/waitlist", label: "Waitlist", icon: ClipboardList },
    { href: "/flags", label: "Feature Flags", icon: Flag },
    { href: "/observability", label: "Observability", icon: Activity },
    { href: "/federation", label: "Federation", icon: Globe2 },
    { href: "/audit", label: "Audit Log", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings }
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="bg-card border-border flex w-56 shrink-0 flex-col border-r">
            <div className="border-border flex h-14 items-center border-b px-4">
                <Shield className="text-primary mr-2 h-5 w-5" />
                <span className="text-sm font-semibold">Admin Portal</span>
            </div>
            <nav className="flex-1 space-y-0.5 p-2">
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/" || pathname === ""
                            : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                                isActive
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                            }`}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
