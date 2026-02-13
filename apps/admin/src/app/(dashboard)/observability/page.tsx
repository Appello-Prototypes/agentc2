import { prisma } from "@repo/database";
import { Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Platform-wide aggregations
    const [dailyStats, dailyCosts, topTenants, recentErrors] = await Promise.all([
        // Runs per day (last 7 days)
        prisma.agentStatsDaily.groupBy({
            by: ["date"],
            _sum: { totalRuns: true, totalCostUsd: true },
            _avg: { successRate: true },
            where: { date: { gte: sevenDaysAgo } },
            orderBy: { date: "desc" }
        }),
        // Costs per day
        prisma.agentCostDaily.groupBy({
            by: ["date"],
            _sum: { totalCostUsd: true, promptCostUsd: true, completionCostUsd: true },
            where: { date: { gte: sevenDaysAgo } },
            orderBy: { date: "desc" }
        }),
        // Top 10 organizations by cost
        prisma.$queryRaw`
            SELECT o.name, o.slug, SUM(c."totalCostUsd") as total_cost
            FROM agent_cost_daily c
            JOIN agent a ON c."agentId" = a.id
            JOIN workspace w ON a."workspaceId" = w.id
            JOIN organization o ON w."organizationId" = o.id
            WHERE c.date >= ${sevenDaysAgo}
            GROUP BY o.id, o.name, o.slug
            ORDER BY total_cost DESC
            LIMIT 10
        ` as Promise<Array<{ name: string; slug: string; total_cost: number }>>,
        // Recent failed runs
        prisma.agentRun.findMany({
            where: {
                status: "FAILED",
                createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                outputText: true,
                createdAt: true,
                agent: {
                    select: { name: true, slug: true }
                }
            }
        })
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Platform Observability</h1>

            {/* Daily stats */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Daily Runs (Last 7 Days)</h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Date</th>
                                <th className="px-4 py-2 text-right font-medium">Total Runs</th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Avg Success Rate
                                </th>
                                <th className="px-4 py-2 text-right font-medium">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyStats.map((day) => (
                                <tr
                                    key={day.date.toISOString()}
                                    className="border-border border-b last:border-0"
                                >
                                    <td className="px-4 py-2">{day.date.toLocaleDateString()}</td>
                                    <td className="px-4 py-2 text-right">
                                        {day._sum?.totalRuns?.toLocaleString() ?? 0}
                                    </td>
                                    <td className="px-4 py-2 text-right text-green-500">
                                        {day._avg?.successRate != null
                                            ? `${(day._avg.successRate * 100).toFixed(1)}%`
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        ${day._sum?.totalCostUsd?.toFixed(2) ?? "0.00"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Daily costs */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Daily Costs (Last 7 Days)</h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Date</th>
                                <th className="px-4 py-2 text-right font-medium">Total Cost</th>
                                <th className="px-4 py-2 text-right font-medium">Prompt Cost</th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Completion Cost
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyCosts.map((day) => (
                                <tr
                                    key={day.date.toISOString()}
                                    className="border-border border-b last:border-0"
                                >
                                    <td className="px-4 py-2">{day.date.toLocaleDateString()}</td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        ${day._sum?.totalCostUsd?.toFixed(2) ?? "0.00"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        ${day._sum?.promptCostUsd?.toFixed(2) ?? "0.00"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        ${day._sum?.completionCostUsd?.toFixed(2) ?? "0.00"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top tenants by cost */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Top 10 Tenants by Cost (7 Days)</h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Tenant</th>
                                <th className="px-4 py-2 text-right font-medium">Cost (USD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topTenants.map((t) => (
                                <tr key={t.slug} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{t.name}</td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        ${Number(t.total_cost).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {topTenants.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={2}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        No cost data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent errors */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Failed Runs</h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Agent</th>
                                <th className="px-4 py-2 text-left font-medium">Run ID</th>
                                <th className="px-4 py-2 text-left font-medium">Error</th>
                                <th className="px-4 py-2 text-left font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentErrors.map((run) => (
                                <tr key={run.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{run.agent.name}</td>
                                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                                        {run.id.substring(0, 12)}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-red-500">
                                        {(run.outputText || "Unknown error").substring(0, 80)}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {run.createdAt.toISOString()}
                                    </td>
                                </tr>
                            ))}
                            {recentErrors.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        <Activity className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                        No recent failures
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
