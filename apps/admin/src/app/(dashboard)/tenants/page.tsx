import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import {
    Search,
    Building2,
    AlertTriangle,
    ArrowUp,
    ArrowDown,
    Activity,
    Users,
    ShieldAlert,
    Layers
} from "lucide-react";
import { TenantCreateForm } from "@/components/tenant-create-form";
import { TenantRowActions } from "@/components/tenant-row-actions";
import { TenantStatusChart } from "../dashboard-charts";
import type { TenantStatusData } from "../dashboard-charts";
import { getServerTimezone } from "@/lib/timezone-server";
import { formatDate, formatRelativeTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

type SortField = "name" | "status" | "members" | "agents" | "risk" | "created" | "lastActive";
type SortDir = "asc" | "desc";

const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
    { key: "name", label: "Tenant" },
    { key: "status", label: "Status" },
    { key: "members", label: "Members" },
    { key: "agents", label: "Agents" },
    { key: "risk", label: "Risk" },
    { key: "lastActive", label: "Last Active" },
    { key: "created", label: "Created" }
];

function buildOrderBy(sort: SortField, dir: SortDir): Prisma.OrganizationOrderByWithRelationInput {
    switch (sort) {
        case "name":
            return { name: dir };
        case "status":
            return { status: dir };
        case "members":
            return { memberships: { _count: dir } };
        case "risk":
            return { riskScore: dir };
        case "created":
            return { createdAt: dir };
        default:
            return { createdAt: dir };
    }
}

export default async function TenantsPage({
    searchParams
}: {
    searchParams: Promise<{
        search?: string;
        status?: string;
        page?: string;
        sort?: string;
        dir?: string;
    }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const page = parseInt(params.page || "1");
    const sort = (params.sort as SortField) || "created";
    const dir = (params.dir as SortDir) || "desc";
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

    const tz = await getServerTimezone();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [tenants, total, statusCounts, atRiskCount, trialExpiringCount] = await Promise.all([
        prisma.organization.findMany({
            where,
            orderBy: buildOrderBy(sort, dir),
            skip,
            take: limit,
            include: {
                _count: {
                    select: {
                        workspaces: true,
                        memberships: true,
                        integrationConnections: true
                    }
                },
                subscription: {
                    include: {
                        plan: { select: { name: true, slug: true } }
                    }
                }
            }
        }),
        prisma.organization.count({ where }),
        prisma.organization.groupBy({
            by: ["status"],
            _count: { id: true }
        }),
        prisma.organization.count({
            where: { riskScore: { gte: 0.7 } }
        }),
        prisma.organization.count({
            where: {
                status: "trial",
                trialEndsAt: { lte: sevenDaysFromNow, gte: now }
            }
        })
    ]);

    // Build status map for KPIs and chart
    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
        statusMap[row.status] = row._count.id;
    }
    const totalTenants = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const tenantStatusData: TenantStatusData[] = Object.entries(statusMap)
        .map(([s, count]) => ({ status: s, count }))
        .sort((a, b) => b.count - a.count);

    // Batch: agent counts per org (via workspace)
    const orgIds = tenants.map((t) => t.id);

    const [agentCountRows, runActivityRows] = await Promise.all([
        orgIds.length > 0
            ? (prisma.$queryRaw`
                SELECT w."organizationId" AS "orgId", COUNT(a.id)::int AS "count"
                FROM agent a
                JOIN workspace w ON a."workspaceId" = w.id
                WHERE w."organizationId" IN (${Prisma.join(orgIds)})
                GROUP BY w."organizationId"
            ` as Promise<{ orgId: string; count: number }[]>)
            : Promise.resolve([]),
        orgIds.length > 0
            ? (prisma.$queryRaw`
                SELECT w."organizationId" AS "orgId",
                       COUNT(*)::int AS "runCount",
                       MAX(r."startedAt") AS "lastRun"
                FROM agent_run r
                JOIN agent a ON r."agentId" = a.id
                JOIN workspace w ON a."workspaceId" = w.id
                WHERE w."organizationId" IN (${Prisma.join(orgIds)})
                  AND r."startedAt" >= ${thirtyDaysAgo}
                GROUP BY w."organizationId"
            ` as Promise<{ orgId: string; runCount: number; lastRun: Date }[]>)
            : Promise.resolve([])
    ]);

    const agentCountMap = new Map(agentCountRows.map((r) => [r.orgId, r.count]));
    const runActivityMap = new Map(
        runActivityRows.map((r) => [r.orgId, { runCount: r.runCount, lastRun: r.lastRun }])
    );

    const totalPages = Math.ceil(total / limit);
    const statuses = ["active", "trial", "suspended", "past_due", "deactivated"];

    // URL builder helper
    function buildUrl(overrides: Record<string, string | undefined>) {
        const base: Record<string, string> = {};
        if (search) base.search = search;
        if (status) base.status = status;
        if (sort !== "created") base.sort = sort;
        if (dir !== "desc") base.dir = dir;
        const merged = { ...base, ...overrides };
        const qs = Object.entries(merged)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
            .join("&");
        return `/tenants${qs ? `?${qs}` : ""}`;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Tenants</h1>
                    <span className="text-muted-foreground text-sm">{total} total</span>
                </div>
                <TenantCreateForm />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    title="Total Tenants"
                    value={totalTenants}
                    icon={<Building2 className="h-4 w-4" />}
                />
                <KpiCard
                    title="Active"
                    value={statusMap["active"] ?? 0}
                    accent="green"
                    icon={<Activity className="h-4 w-4" />}
                />
                <KpiCard
                    title="Trial"
                    value={statusMap["trial"] ?? 0}
                    subtitle={
                        trialExpiringCount > 0
                            ? `${trialExpiringCount} expiring within 7d`
                            : undefined
                    }
                    accent="blue"
                    icon={<Layers className="h-4 w-4" />}
                />
                <KpiCard
                    title="At Risk"
                    value={atRiskCount}
                    accent={atRiskCount > 0 ? "red" : undefined}
                    icon={<ShieldAlert className="h-4 w-4" />}
                />
            </div>

            {/* Status Chart */}
            {tenantStatusData.length > 0 && (
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-1 text-sm font-semibold">Status Distribution</h2>
                    <p className="text-muted-foreground mb-3 text-xs">{totalTenants} total</p>
                    <TenantStatusChart data={tenantStatusData} />
                </div>
            )}

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
                            {SORTABLE_COLUMNS.map((col) => {
                                const isActive = sort === col.key;
                                const nextDir = isActive && dir === "asc" ? "desc" : "asc";
                                const href = buildUrl({
                                    sort: col.key,
                                    dir: nextDir,
                                    page: undefined
                                });
                                return (
                                    <th key={col.key} className="px-4 py-3 text-left font-medium">
                                        <Link
                                            href={href}
                                            className="inline-flex items-center gap-1 hover:underline"
                                        >
                                            {col.label}
                                            {isActive &&
                                                (dir === "asc" ? (
                                                    <ArrowUp className="h-3 w-3" />
                                                ) : (
                                                    <ArrowDown className="h-3 w-3" />
                                                ))}
                                        </Link>
                                    </th>
                                );
                            })}
                            <th className="px-4 py-3 text-left font-medium">Plan</th>
                            <th className="px-4 py-3 text-left font-medium">Integrations</th>
                            <th className="px-4 py-3 text-left font-medium">Runs (30d)</th>
                            <th className="w-12 px-4 py-3 text-right font-medium" />
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map((tenant) => {
                            const agents = agentCountMap.get(tenant.id) ?? 0;
                            const activity = runActivityMap.get(tenant.id);
                            const isTrialExpiring =
                                tenant.status === "trial" &&
                                tenant.trialEndsAt &&
                                tenant.trialEndsAt <= sevenDaysFromNow &&
                                tenant.trialEndsAt >= now;

                            return (
                                <tr
                                    key={tenant.id}
                                    className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                                >
                                    {/* Tenant */}
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
                                    {/* Status */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <StatusBadge status={tenant.status} />
                                            {isTrialExpiring && (
                                                <span
                                                    className="inline-flex items-center gap-0.5 text-amber-500"
                                                    title={`Trial expires ${formatDate(tenant.trialEndsAt!, tz)}`}
                                                >
                                                    <AlertTriangle className="h-3 w-3" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Members */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <Users className="text-muted-foreground h-3 w-3" />
                                            {tenant._count.memberships}
                                        </div>
                                    </td>
                                    {/* Agents */}
                                    <td className="px-4 py-3">{agents}</td>
                                    {/* Risk */}
                                    <td className="px-4 py-3">
                                        <RiskIndicator score={tenant.riskScore} />
                                    </td>
                                    {/* Last Active */}
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {activity?.lastRun
                                            ? formatRelativeTime(activity.lastRun, tz)
                                            : "--"}
                                    </td>
                                    {/* Created */}
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {formatDate(tenant.createdAt, tz)}
                                    </td>
                                    {/* Plan */}
                                    <td className="px-4 py-3">
                                        {tenant.subscription ? (
                                            <span className="bg-secondary text-secondary-foreground inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
                                                {tenant.subscription.plan.name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                --
                                            </span>
                                        )}
                                    </td>
                                    {/* Integrations */}
                                    <td className="px-4 py-3">
                                        {tenant._count.integrationConnections}
                                    </td>
                                    {/* Runs (30d) */}
                                    <td className="px-4 py-3">
                                        {activity?.runCount?.toLocaleString() ?? "0"}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right">
                                        <TenantRowActions
                                            orgId={tenant.id}
                                            orgSlug={tenant.slug}
                                            status={tenant.status}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {tenants.length === 0 && (
                            <tr>
                                <td
                                    colSpan={11}
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
                            href={buildUrl({ page: String(page - 1) })}
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
                            href={buildUrl({ page: String(page + 1) })}
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
    title,
    value,
    subtitle,
    accent,
    icon
}: {
    title: string;
    value: number;
    subtitle?: string;
    accent?: "green" | "red" | "blue";
    icon?: React.ReactNode;
}) {
    const accentMap: Record<string, string> = {
        green: "text-green-500",
        red: "text-red-500",
        blue: "text-blue-500"
    };

    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">{title}</p>
                {icon && <span className="text-muted-foreground">{icon}</span>}
            </div>
            <p className={`mt-1 text-2xl font-bold ${accentMap[accent ?? ""] ?? ""}`}>
                {value.toLocaleString()}
            </p>
            {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
        </div>
    );
}

// ─── Inline helpers ───────────────────────────────────────────────────────────

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
