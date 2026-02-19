import { prisma } from "@repo/database";
import { TrendingUp, TrendingDown, DollarSign, Users, ArrowUpRight } from "lucide-react";
import {
    RevenueTrendChart,
    MarginTrendChart,
    RevenueByPlanChart,
    CostByModelChart
} from "./charts";
import type { MonthlyFinancial, PlanRevenue, ModelCost } from "./charts";

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

export default async function FinancialsPage() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
        costEvents6mo,
        activeSubscriptions,
        allSubscriptions,
        activeOrgs,
        costByModel,
        previousMonthEvents
    ] = await Promise.all([
        prisma.costEvent.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: {
                billedCostUsd: true,
                costUsd: true,
                platformCostUsd: true,
                tenantId: true,
                createdAt: true
            }
        }),
        prisma.orgSubscription.findMany({
            where: { status: "active" },
            include: {
                plan: { select: { name: true, monthlyPriceUsd: true, slug: true } },
                organization: { select: { name: true, slug: true } }
            }
        }),
        prisma.orgSubscription.groupBy({
            by: ["status"],
            _count: { id: true }
        }),
        prisma.organization.count({ where: { status: "active" } }),
        prisma.costEvent.groupBy({
            by: ["modelName"],
            where: { createdAt: { gte: startOfMonth } },
            _sum: { platformCostUsd: true, costUsd: true },
            _count: { id: true }
        }),
        prisma.costEvent.findMany({
            where: {
                createdAt: {
                    gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    lt: startOfMonth
                }
            },
            select: { billedCostUsd: true, costUsd: true, platformCostUsd: true }
        })
    ]);

    // ─── Current month totals ───────────────────────────────────────────────

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

    // ─── Previous month totals (for MoM growth) ────────────────────────────

    const prevRevenue = previousMonthEvents.reduce(
        (s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0),
        0
    );
    const prevCost = previousMonthEvents.reduce(
        (s, e) => s + (e.platformCostUsd ?? e.costUsd ?? 0),
        0
    );
    const prevMargin = prevRevenue - prevCost;

    const revenueGrowth =
        prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : null;
    const costGrowth = prevCost > 0 ? ((currentCost - prevCost) / prevCost) * 100 : null;
    const marginGrowth = prevMargin > 0 ? ((currentMargin - prevMargin) / prevMargin) * 100 : null;

    // ─── MRR from active subscriptions ──────────────────────────────────────

    const mrr = activeSubscriptions.reduce(
        (s, sub) => s + sub.plan.monthlyPriceUsd * sub.seatCount,
        0
    );
    const arr = mrr * 12;

    // ─── Subscription status counts ─────────────────────────────────────────

    const subStatusMap: Record<string, number> = {};
    for (const row of allSubscriptions) {
        subStatusMap[row.status] = row._count.id;
    }

    // ─── Monthly trend data (last 6 months) ─────────────────────────────────

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

    const monthlyTrend: MonthlyFinancial[] = Object.entries(monthBuckets).map(([key, v]) => ({
        month: monthLabel(key),
        revenue: Math.round(v.revenue * 100) / 100,
        cost: Math.round(v.cost * 100) / 100,
        margin: Math.round((v.revenue - v.cost) * 100) / 100
    }));

    // ─── Revenue by plan ────────────────────────────────────────────────────

    const planRevenueMap: Record<string, { name: string; revenue: number }> = {};
    for (const sub of activeSubscriptions) {
        const key = sub.plan.slug;
        if (!planRevenueMap[key]) {
            planRevenueMap[key] = { name: sub.plan.name, revenue: 0 };
        }
        planRevenueMap[key].revenue += sub.plan.monthlyPriceUsd * sub.seatCount;
    }
    const planRevenue: PlanRevenue[] = Object.values(planRevenueMap).sort(
        (a, b) => b.revenue - a.revenue
    );

    // ─── Cost by model (current month) ──────────────────────────────────────

    const modelCosts: ModelCost[] = costByModel
        .map((row) => ({
            label: row.modelName,
            cost: Math.round((row._sum.platformCostUsd ?? row._sum.costUsd ?? 0) * 10000) / 10000
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

    // ─── Top customers by revenue (current month) ───────────────────────────

    const tenantRevMap: Record<string, number> = {};
    const tenantCostMap: Record<string, number> = {};
    for (const e of currentMonthEvents) {
        if (e.tenantId) {
            tenantRevMap[e.tenantId] =
                (tenantRevMap[e.tenantId] ?? 0) + (e.billedCostUsd ?? e.costUsd ?? 0);
            tenantCostMap[e.tenantId] =
                (tenantCostMap[e.tenantId] ?? 0) + (e.platformCostUsd ?? e.costUsd ?? 0);
        }
    }

    const topTenantIds = Object.entries(tenantRevMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);

    const tenantOrgs =
        topTenantIds.length > 0
            ? await prisma.organization.findMany({
                  where: { id: { in: topTenantIds } },
                  select: { id: true, name: true, slug: true }
              })
            : [];

    const tenantNameMap: Record<string, string> = {};
    for (const org of tenantOrgs) {
        tenantNameMap[org.id] = org.name;
    }

    // ─── ARPU ───────────────────────────────────────────────────────────────

    const arpu = activeOrgs > 0 ? currentRevenue / activeOrgs : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Financials</h1>
                <span className="text-muted-foreground text-sm">
                    {now.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric"
                    })}
                </span>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    title="MRR"
                    value={`$${mrr.toFixed(2)}`}
                    subtitle={`ARR: $${arr.toFixed(0)}`}
                    icon={<DollarSign className="h-4 w-4" />}
                />
                <KpiCard
                    title="Revenue (MTD)"
                    value={`$${currentRevenue.toFixed(2)}`}
                    change={revenueGrowth}
                    icon={<ArrowUpRight className="h-4 w-4" />}
                />
                <KpiCard
                    title="Platform Cost (MTD)"
                    value={`$${currentCost.toFixed(2)}`}
                    change={costGrowth}
                    invertChange
                    icon={<TrendingDown className="h-4 w-4" />}
                />
                <KpiCard
                    title="Gross Margin (MTD)"
                    value={`$${currentMargin.toFixed(2)}`}
                    subtitle={`${marginPct.toFixed(1)}%`}
                    change={marginGrowth}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
            </div>

            {/* ── Subscription Metrics ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <MiniKpi label="Active Subs" value={subStatusMap["active"] ?? 0} accent="green" />
                <MiniKpi label="Trialing" value={subStatusMap["trialing"] ?? 0} accent="blue" />
                <MiniKpi label="Past Due" value={subStatusMap["past_due"] ?? 0} accent="amber" />
                <MiniKpi label="Canceled" value={subStatusMap["canceled"] ?? 0} accent="red" />
                <MiniKpi label="ARPU (MTD)" value={`$${arpu.toFixed(2)}`} accent="default" />
            </div>

            {/* ── Revenue Trend ─────────────────────────────────────────────── */}
            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-1 text-lg font-semibold">Revenue vs Cost</h2>
                <p className="text-muted-foreground mb-4 text-sm">Last 6 months</p>
                <RevenueTrendChart data={monthlyTrend} />
            </div>

            {/* ── Row: Margin Trend + Revenue by Plan ──────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-1 text-lg font-semibold">Gross Margin Trend</h2>
                    <p className="text-muted-foreground mb-4 text-sm">Monthly gross margin</p>
                    <MarginTrendChart data={monthlyTrend} />
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-1 text-lg font-semibold">MRR by Plan</h2>
                    <p className="text-muted-foreground mb-4 text-sm">
                        Recurring revenue distribution
                    </p>
                    <RevenueByPlanChart data={planRevenue} />
                </div>
            </div>

            {/* ── Row: Top Customers + Cost by Model ───────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Top Customers */}
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-3 text-lg font-semibold">Top Customers (MTD)</h2>
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border bg-muted/50 border-b">
                                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                                    <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                                    <th className="px-3 py-2 text-right font-medium">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topTenantIds.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="text-muted-foreground px-3 py-8 text-center"
                                        >
                                            No usage data this month
                                        </td>
                                    </tr>
                                ) : (
                                    topTenantIds.map((id) => {
                                        const rev = tenantRevMap[id] ?? 0;
                                        const cost = tenantCostMap[id] ?? 0;
                                        const m = rev - cost;
                                        return (
                                            <tr
                                                key={id}
                                                className="border-border border-b last:border-0"
                                            >
                                                <td className="px-3 py-2">
                                                    {tenantNameMap[id] ?? id.slice(0, 12)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                    ${rev.toFixed(2)}
                                                </td>
                                                <td className="text-muted-foreground px-3 py-2 text-right">
                                                    ${cost.toFixed(2)}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-right font-medium ${m >= 0 ? "text-green-500" : "text-red-500"}`}
                                                >
                                                    ${m.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cost by Model */}
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-1 text-lg font-semibold">Cost by Model (MTD)</h2>
                    <p className="text-muted-foreground mb-4 text-sm">
                        Platform API spend by AI model
                    </p>
                    <CostByModelChart data={modelCosts} />
                </div>
            </div>

            {/* ── Active Subscriptions Table ────────────────────────────────── */}
            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-3 text-lg font-semibold">Active Subscriptions</h2>
                <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border bg-muted/50 border-b">
                                <th className="px-3 py-2 text-left font-medium">Organization</th>
                                <th className="px-3 py-2 text-left font-medium">Plan</th>
                                <th className="px-3 py-2 text-right font-medium">Seats</th>
                                <th className="px-3 py-2 text-right font-medium">Monthly Price</th>
                                <th className="px-3 py-2 text-right font-medium">Credits Used</th>
                                <th className="px-3 py-2 text-right font-medium">Overage</th>
                                <th className="px-3 py-2 text-left font-medium">Period End</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSubscriptions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-muted-foreground px-3 py-8 text-center"
                                    >
                                        <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                        No active subscriptions
                                    </td>
                                </tr>
                            ) : (
                                activeSubscriptions
                                    .sort(
                                        (a, b) =>
                                            b.plan.monthlyPriceUsd * b.seatCount -
                                            a.plan.monthlyPriceUsd * a.seatCount
                                    )
                                    .map((sub) => (
                                        <tr
                                            key={sub.id}
                                            className="border-border border-b last:border-0"
                                        >
                                            <td className="px-3 py-2 font-medium">
                                                {sub.organization.name}
                                            </td>
                                            <td className="px-3 py-2">{sub.plan.name}</td>
                                            <td className="px-3 py-2 text-right">
                                                {sub.seatCount}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">
                                                $
                                                {(sub.plan.monthlyPriceUsd * sub.seatCount).toFixed(
                                                    2
                                                )}
                                            </td>
                                            <td className="text-muted-foreground px-3 py-2 text-right">
                                                ${sub.usedCreditsUsd.toFixed(2)} / $
                                                {sub.includedCreditsUsd.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                ${sub.overageAccruedUsd.toFixed(2)}
                                            </td>
                                            <td className="text-muted-foreground px-3 py-2 text-xs">
                                                {sub.currentPeriodEnd.toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
    title,
    value,
    subtitle,
    change,
    invertChange,
    icon
}: {
    title: string;
    value: string;
    subtitle?: string;
    change?: number | null;
    invertChange?: boolean;
    icon?: React.ReactNode;
}) {
    const isPositive = change != null && (invertChange ? change < 0 : change > 0);
    const changeColor = change == null ? "" : isPositive ? "text-green-500" : "text-red-500";

    return (
        <div className="bg-card border-border rounded-lg border p-4">
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
}

// ─── Mini KPI ───────────────────────────────────────────────────────────────

function MiniKpi({
    label,
    value,
    accent
}: {
    label: string;
    value: number | string;
    accent?: "green" | "red" | "blue" | "amber" | "default";
}) {
    const accentMap: Record<string, string> = {
        green: "text-green-500",
        red: "text-red-500",
        blue: "text-blue-500",
        amber: "text-amber-500",
        default: ""
    };
    return (
        <div className="bg-card border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={`text-xl font-bold ${accentMap[accent ?? "default"] ?? ""}`}>
                {typeof value === "number" ? value.toLocaleString() : value}
            </p>
        </div>
    );
}
