import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TenantsPage({
    searchParams
}: {
    searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } }
        ];
    }
    if (status) {
        where.status = status;
    }

    const [tenants, total] = await Promise.all([
        prisma.organization.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                _count: {
                    select: {
                        workspaces: true,
                        memberships: true
                    }
                }
            }
        }),
        prisma.organization.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);
    const statuses = ["active", "trial", "suspended", "past_due", "deactivated"];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Tenants</h1>
                <span className="text-muted-foreground text-sm">{total} total</span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <form className="relative flex-1" action="/tenants">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <input
                        name="search"
                        defaultValue={search}
                        placeholder="Search by name or slug..."
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                    {status && <input type="hidden" name="status" value={status} />}
                </form>
                <div className="flex gap-1">
                    <FilterLink href="/tenants" label="All" active={!status} search={search} />
                    {statuses.map((s) => (
                        <FilterLink
                            key={s}
                            href={`/tenants?status=${s}${search ? `&search=${search}` : ""}`}
                            label={s}
                            active={status === s}
                            search={search}
                        />
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Tenant</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Workspaces</th>
                            <th className="px-4 py-3 text-left font-medium">Members</th>
                            <th className="px-4 py-3 text-left font-medium">Risk</th>
                            <th className="px-4 py-3 text-left font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map((tenant) => (
                            <tr
                                key={tenant.id}
                                className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                            >
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/tenants/${tenant.slug}`}
                                        className="font-medium hover:underline"
                                    >
                                        {tenant.name}
                                    </Link>
                                    <div className="text-muted-foreground text-xs">
                                        {tenant.slug}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={tenant.status} />
                                </td>
                                <td className="px-4 py-3">{tenant._count.workspaces}</td>
                                <td className="px-4 py-3">{tenant._count.memberships}</td>
                                <td className="px-4 py-3">
                                    <RiskIndicator score={tenant.riskScore} />
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {tenant.createdAt.toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No tenants found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/tenants?page=${page - 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                            className="border-border rounded-md border px-3 py-1 text-sm"
                        >
                            Previous
                        </Link>
                    )}
                    <span className="text-muted-foreground text-sm">
                        Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                        <Link
                            href={`/tenants?page=${page + 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
                            className="border-border rounded-md border px-3 py-1 text-sm"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        trial: "bg-blue-500/10 text-blue-500",
        suspended: "bg-red-500/10 text-red-500",
        past_due: "bg-yellow-500/10 text-yellow-500",
        deactivated: "bg-gray-500/10 text-gray-500",
        provisioning: "bg-purple-500/10 text-purple-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-500/10 text-gray-500"}`}
        >
            {status}
        </span>
    );
}

function RiskIndicator({ score }: { score: number | null }) {
    if (score === null || score === undefined) {
        return <span className="text-muted-foreground text-xs">--</span>;
    }
    const color =
        score >= 0.7 ? "text-red-500" : score >= 0.4 ? "text-yellow-500" : "text-green-500";
    return <span className={`text-xs font-medium ${color}`}>{(score * 100).toFixed(0)}%</span>;
}

function FilterLink({
    href,
    label,
    active
}: {
    href: string;
    label: string;
    active: boolean;
    search?: string;
}) {
    return (
        <Link
            href={href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
        >
            {label}
        </Link>
    );
}
