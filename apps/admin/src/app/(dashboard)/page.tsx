import Link from "next/link";
import { prisma } from "@repo/database";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { RevenueSparkChart, TenantStatusChart } from "./dashboard-charts";
import type { MonthlyRevenue, TenantStatusData } from "./dashboard-charts";

export const dynamic = "force-dynamic";

function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
    const [y, m] = key.split("-");
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];
    return `${months[parseInt(m!, 10) - 1]} ${y!.slice(2)}`;
}

export default async function DashboardPage() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [
        tenantCounts,
        totalAgents,
        totalUsers,
        activeSubscriptions,
        openTickets,
        urgentTickets,
        waitlistPending,
        costEvents6mo,
        previousMonthEvents,
        agentRunsWeek,
        failedRunsWeek,
        recentAdminActions,
        newTenantsThisMonth,
        newUsersThisMonth
    ] = await Promise.all([
        prisma.organization.groupBy({
            by: ["status"],
            _count: { id: true }
        }),
        prisma.agent.count(),
        prisma.user.count({ where: { status: "active" } }),
        prisma.orgSubscription.findMany({
            where: { status: "active" },
            include: {
                plan: { select: { monthlyPriceUsd: true } }
            }
        }),
        prisma.supportTicket.count({
            where: { status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] } }
        }),
        prisma.supportTicket.count({
            where: {
                status: { in: ["NEW", "TRIAGED", "IN_PROGRESS"] },
                priority: { in: ["CRITICAL", "HIGH"] }
            }
        }),
        prisma.waitlist.count({ where: { status: "pending" } }),
        prisma.costEvent.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: {
                billedCostUsd: true,
                costUsd: true,
                platformCostUsd: true,
                createdAt: true
            }
        }),
        prisma.costEvent.findMany({
            where: {
                createdAt: { gte: prevMonthStart, lt: startOfMonth }
            },
            select: { billedCostUsd: true, costUsd: true, platformCostUsd: true }
        }),
        prisma.agentRun.count({
            where: { createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.agentRun.count({
            where: { status: "FAILED", createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.adminAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { adminUser: { select: { name: true, email: true } } }
        }),
        prisma.organization.count({
            where: { createdAt: { gte: startOfMonth } }
        }),
        prisma.user.count({
            where: { createdAt: { gte: startOfMonth } }
        })
    ]);

    // ─── Tenant breakdown ────────────────────────────────────────────────────

    const statusMap: Record<string, number> = {};
    for (const row of tenantCounts) {
        statusMap[row.status] = row._count.id;
    }
    const totalTenants = Object.values(statusMap).reduce((a, b) => a + b, 0);

    const tenantStatusData: TenantStatusData[] = Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

    // ─── MRR / ARR ──────────────────────────────────────────────────────────

    const mrr = activeSubscriptions.reduce(
        (s, sub) => s + sub.plan.monthlyPriceUsd * sub.seatCount,
        0
    );
    const arr = mrr * 12;

    // ─── Revenue & cost (current month) ──────────────────────────────────────

    const currentMonthEvents = costEvents6mo.filter((e) => e.createdAt >= startOfMonth);
    const currentRevenue = currentMonthEvents.reduce(
        (s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0),
        0
    );
    const currentCost = currentMonthEvents.reduce(
        (s, e) => s + (e.platformCostUsd ?? e.costUsd ?? 0),
        0
    );
    const currentMargin = currentRevenue - currentCost;
    const marginPct = currentRevenue > 0 ? (currentMargin / currentRevenue) * 100 : 0;

    // ─── Previous month (for MoM) ────────────────────────────────────────────

    const prevRevenue = previousMonthEvents.reduce(
        (s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0),
        0
    );
    const revenueGrowth =
        prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : null;

    // ─── 6-month revenue trend ───────────────────────────────────────────────

    const monthBuckets: Record<string, { revenue: number; cost: number }> = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthBuckets[monthKey(d)] = { revenue: 0, cost: 0 };
    }
    for (const e of costEvents6mo) {
        const key = monthKey(e.createdAt);
        if (monthBuckets[key]) {
            monthBuckets[key].revenue += e.billedCostUsd ?? e.costUsd ?? 0;
            monthBuckets[key].cost += e.platformCostUsd ?? e.costUsd ?? 0;
        }
    }
    const monthlyTrend: MonthlyRevenue[] = Object.entries(monthBuckets).map(([key, v]) => ({
        month: monthLabel(key),
        revenue: Math.round(v.revenue * 100) / 100,
        cost: Math.round(v.cost * 100) / 100
    }));

    // ─── Agent run success rate ──────────────────────────────────────────────

    const successRate =
        agentRunsWeek > 0 ? ((agentRunsWeek - failedRunsWeek) / agentRunsWeek) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Platform Dashboard</h1>
                <span className="text-muted-foreground text-sm">
                    {now.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    })}
                </span>
            </div>

            {/* ── Primary KPI Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    title="MRR"
                    value={`$${mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle={`ARR: $${arr.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    icon={<DollarSign className="h-4 w-4" />}
                    href="/financials"
                />
                <KpiCard
                    title="Revenue MTD"
                    value={`$${currentRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    change={revenueGrowth}
                    icon={<ArrowUpRight className="h-4 w-4" />}
                    href="/financials"
                />
                <KpiCard
                    title="Gross Margin MTD"
                    value={`$${currentMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle={`${marginPct.toFixed(1)}%`}
                    icon={<TrendingUp className="h-4 w-4" />}
                    href="/financials"
                />
                <KpiCard
                    title="Platform Cost MTD"
                    value={`$${currentCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={<TrendingDown className="h-4 w-4" />}
                    href="/financials"
                />
            </div>

            {/* ── Secondary KPI Strip ────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                <MiniKpi
                    label="Tenants"
                    value={totalTenants}
                    detail={`+${newTenantsThisMonth} this mo`}
                    href="/tenants"
                />
                <MiniKpi
                    label="Active"
                    value={statusMap["active"] ?? 0}
                    accent="green"
                    href="/tenants"
                />
                <MiniKpi
                    label="Trial"
                    value={statusMap["trial"] ?? 0}
                    accent="blue"
                    href="/tenants"
                />
                <MiniKpi
                    label="Users"
                    value={totalUsers}
                    detail={`+${newUsersThisMonth} this mo`}
                    href="/users"
                />
                <MiniKpi label="Agents" value={totalAgents} href="/tenants" />
                <MiniKpi
                    label="Open Tickets"
                    value={openTickets}
                    detail={urgentTickets > 0 ? `${urgentTickets} urgent` : undefined}
                    accent={urgentTickets > 0 ? "red" : undefined}
                    href="/tickets"
                />
                <MiniKpi label="Waitlist" value={waitlistPending} accent="amber" href="/waitlist" />
            </div>

            {/* ── Charts Row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="bg-card border-border rounded-lg border p-4 lg:col-span-2">
                    <div className="mb-1 flex items-center justify-between">
                        <h2 className="text-base font-semibold">Revenue vs Cost</h2>
                        <Link
                            href="/financials"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            View details →
                        </Link>
                    </div>
                    <p className="text-muted-foreground mb-3 text-xs">Last 6 months</p>
                    <RevenueSparkChart data={monthlyTrend} />
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <div className="mb-1 flex items-center justify-between">
                        <h2 className="text-base font-semibold">Tenants by Status</h2>
                        <Link
                            href="/tenants"
                            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                        >
                            View all →
                        </Link>
                    </div>
                    <p className="text-muted-foreground mb-3 text-xs">{totalTenants} total</p>
                    <TenantStatusChart data={tenantStatusData} />
                </div>
            </div>

            {/* ── Platform Health Strip ───────────────────────────────────── */}
            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-3 text-base font-semibold">Platform Health (7d)</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                        <p className="text-muted-foreground text-xs">Agent Runs</p>
                        <p className="text-xl font-bold">{agentRunsWeek.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Failed Runs</p>
                        <p
                            className={`text-xl font-bold ${failedRunsWeek > 0 ? "text-red-500" : "text-green-500"}`}
                        >
                            {failedRunsWeek.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Success Rate</p>
                        <p
                            className={`text-xl font-bold ${successRate >= 95 ? "text-green-500" : successRate >= 80 ? "text-amber-500" : "text-red-500"}`}
                        >
                            {agentRunsWeek > 0 ? `${successRate.toFixed(1)}%` : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Active Subscriptions</p>
                        <p className="text-xl font-bold">{activeSubscriptions.length}</p>
                    </div>
                </div>
            </div>

            {/* ── Recent Admin Actions ────────────────────────────────────── */}
            <div className="bg-card border-border rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Recent Admin Activity</h2>
                    <Link
                        href="/audit"
                        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                        View audit log →
                    </Link>
                </div>
                {recentAdminActions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No admin actions recorded yet.</p>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border bg-muted/50 border-b">
                                    <th className="px-3 py-2 text-left text-xs font-medium">
                                        Action
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">
                                        Admin
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">
                                        Entity
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">
                                        Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAdminActions.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="border-border border-b last:border-0"
                                    >
                                        <td className="px-3 py-2">
                                            <ActionBadge action={log.action} />
                                        </td>
                                        <td className="px-3 py-2 text-xs">{log.adminUser.name}</td>
                                        <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                                            {log.entityType}
                                        </td>
                                        <td className="text-muted-foreground px-3 py-2 text-xs">
                                            {formatRelativeTime(log.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
    title,
    value,
    subtitle,
    change,
    icon,
    href
}: {
    title: string;
    value: string;
    subtitle?: string;
    change?: number | null;
    icon?: React.ReactNode;
    href?: string;
}) {
    const isPositive = change != null && change > 0;
    const changeColor = change == null ? "" : isPositive ? "text-green-500" : "text-red-500";

    const content = (
        <div className="bg-card border-border hover:border-primary/30 rounded-lg border p-4 transition-colors">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">{title}</p>
                {icon && <span className="text-muted-foreground">{icon}</span>}
            </div>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <div className="mt-1 flex items-center gap-2">
                {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
                {change != null && (
                    <span className={`text-xs font-medium ${changeColor}`}>
                        {change > 0 ? "+" : ""}
                        {change.toFixed(1)}% MoM
                    </span>
                )}
            </div>
        </div>
    );

    return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Mini KPI ────────────────────────────────────────────────────────────────

function MiniKpi({
    label,
    value,
    detail,
    accent,
    href
}: {
    label: string;
    value: number | string;
    detail?: string;
    accent?: "green" | "red" | "blue" | "amber";
    href?: string;
}) {
    const accentMap: Record<string, string> = {
        green: "text-green-500",
        red: "text-red-500",
        blue: "text-blue-500",
        amber: "text-amber-500"
    };

    const content = (
        <div className="bg-card border-border hover:border-primary/30 rounded-lg border p-3 transition-colors">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={`text-lg font-bold ${accentMap[accent ?? ""] ?? ""}`}>
                {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {detail && (
                <p
                    className={`text-xs ${accent === "red" ? "text-red-400" : "text-muted-foreground"}`}
                >
                    {detail}
                </p>
            )}
        </div>
    );

    return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Action Badge ────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
    const colorMap: Record<string, string> = {
        TENANT_SUSPEND: "bg-red-500/10 text-red-500",
        TENANT_REACTIVATE: "bg-green-500/10 text-green-500",
        TICKET_UPDATE: "bg-blue-500/10 text-blue-500",
        USER_RESET_PASSWORD: "bg-amber-500/10 text-amber-500",
        USER_FORCE_LOGOUT: "bg-orange-500/10 text-orange-500",
        USER_IMPERSONATE: "bg-purple-500/10 text-purple-500",
        FLAG_UPDATE: "bg-indigo-500/10 text-indigo-500",
        ADMIN_CREATE: "bg-green-500/10 text-green-500",
        ADMIN_UPDATE: "bg-blue-500/10 text-blue-500"
    };

    const style = colorMap[action] ?? "bg-secondary text-secondary-foreground";
    const label = action
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
            {label}
        </span>
    );
}

// ─── Relative time formatter ─────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}
