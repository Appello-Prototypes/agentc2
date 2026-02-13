import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { Users, Bot, Plug, BarChart3, FileText, Flag, History } from "lucide-react";

export default async function TenantDetailLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true, slug: true, status: true }
    });

    if (!org) {
        notFound();
    }

    const statusColors: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        trial: "bg-blue-500/10 text-blue-500",
        suspended: "bg-red-500/10 text-red-500",
        past_due: "bg-yellow-500/10 text-yellow-500",
        deactivated: "bg-gray-500/10 text-gray-500"
    };

    const subNav = [
        { href: `/tenants/${orgSlug}`, label: "Overview", icon: BarChart3 },
        { href: `/tenants/${orgSlug}/users`, label: "Users", icon: Users },
        { href: `/tenants/${orgSlug}/agents`, label: "Agents", icon: Bot },
        { href: `/tenants/${orgSlug}/integrations`, label: "Integrations", icon: Plug },
        { href: `/tenants/${orgSlug}/usage`, label: "Usage", icon: BarChart3 },
        { href: `/tenants/${orgSlug}/audit-log`, label: "Audit Log", icon: FileText },
        { href: `/tenants/${orgSlug}/flags`, label: "Flags", icon: Flag },
        { href: `/tenants/${orgSlug}/lifecycle`, label: "Lifecycle", icon: History }
    ];

    return (
        <div className="space-y-4">
            {/* Tenant context bar */}
            <div className="flex items-center gap-3">
                <Link
                    href="/tenants"
                    className="text-muted-foreground hover:text-foreground text-sm"
                >
                    Tenants
                </Link>
                <span className="text-muted-foreground">/</span>
                <h1 className="text-xl font-bold">{org.name}</h1>
                <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[org.status] || "bg-gray-500/10 text-gray-500"}`}
                >
                    {org.status}
                </span>
            </div>

            {/* Sub-navigation */}
            <div className="border-border flex gap-1 border-b pb-0">
                {subNav.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="hover:bg-accent/50 flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors"
                    >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                    </Link>
                ))}
            </div>

            {/* Content */}
            <div>{children}</div>
        </div>
    );
}
