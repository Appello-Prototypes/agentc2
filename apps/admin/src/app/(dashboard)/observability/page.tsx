import { prisma } from "@repo/database";
import { Activity } from "lucide-react";
import { getServerTimezone } from "@/lib/timezone-server";
import { formatDate, formatDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

interface DailyRunStat {
    date: string;
    total_runs: bigint;
    completed_runs: bigint;
    failed_runs: bigint;
    success_rate: number | null;
    total_cost: number | null;
    avg_duration_ms: number | null;
}

interface DailyCostStat {
    date: string;
    total_cost: number | null;
    prompt_cost: number | null;
    completion_cost: number | null;
    total_tokens: bigint;
}

interface TopTenant {
    name: string;
    slug: string;
    total_cost: number;
    run_count: bigint;
}

export default async function ObservabilityPage() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const tz = await getServerTimezone();

    const [dailyStats, dailyCosts, topTenants, recentErrors, summaryStats] = await Promise.all([
        // Daily run stats from AgentRun (the table that actually has data)
        prisma.$queryRaw<DailyRunStat[]>`
            SELECT
                DATE(r."startedAt") as date,
                COUNT(*)::bigint as total_runs,
                COUNT(*) FILTER (WHERE r.status = 'COMPLETED')::bigint as completed_runs,
                COUNT(*) FILTER (WHERE r.status = 'FAILED')::bigint as failed_runs,
                CASE
                    WHEN COUNT(*) FILTER (WHERE r.status IN ('COMPLETED', 'FAILED')) > 0
                    THEN COUNT(*) FILTER (WHERE r.status = 'COMPLETED')::float
                         / COUNT(*) FILTER (WHERE r.status IN ('COMPLETED', 'FAILED'))::float
                    ELSE NULL
                END as success_rate,
                SUM(r."costUsd") as total_cost,
                AVG(r."durationMs") as avg_duration_ms
            FROM agent_run r
            WHERE r."startedAt" >= ${sevenDaysAgo}
            GROUP BY DATE(r."startedAt")
            ORDER BY date DESC
        `,

        // Daily cost breakdown from CostEvent
        prisma.$queryRaw<DailyCostStat[]>`
            SELECT
                DATE(c."createdAt") as date,
                SUM(c."costUsd") as total_cost,
                SUM(
                    CASE WHEN c."promptTokens" > 0 AND c."totalTokens" > 0
                    THEN c."costUsd" * c."promptTokens"::float / NULLIF(c."totalTokens", 0)
                    ELSE 0 END
                ) as prompt_cost,
                SUM(
                    CASE WHEN c."completionTokens" > 0 AND c."totalTokens" > 0
                    THEN c."costUsd" * c."completionTokens"::float / NULLIF(c."totalTokens", 0)
                    ELSE 0 END
                ) as completion_cost,
                COALESCE(SUM(c."totalTokens"), 0)::bigint as total_tokens
            FROM cost_event c
            WHERE c."createdAt" >= ${sevenDaysAgo}
              AND c.status = 'FINALIZED'
            GROUP BY DATE(c."createdAt")
            ORDER BY date DESC
        `,

        // Top tenants by cost from CostEvent → Agent → Workspace → Organization
        prisma.$queryRaw<TopTenant[]>`
            SELECT
                o.name,
                o.slug,
                SUM(c."costUsd") as total_cost,
                COUNT(DISTINCT c."runId")::bigint as run_count
            FROM cost_event c
            JOIN agent a ON c."agentId" = a.id
            LEFT JOIN workspace w ON a."workspaceId" = w.id
            LEFT JOIN organization o ON w."organizationId" = o.id
            WHERE c."createdAt" >= ${sevenDaysAgo}
              AND c.status = 'FINALIZED'
              AND o.id IS NOT NULL
            GROUP BY o.id, o.name, o.slug
            ORDER BY total_cost DESC
            LIMIT 10
        `,

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
                source: true,
                durationMs: true,
                agent: {
                    select: { name: true, slug: true }
                }
            }
        }),

        // Summary stats for the header
        prisma.$queryRaw<
            [{ total_runs: bigint; total_cost: number | null; avg_duration: number | null }]
        >`
            SELECT
                COUNT(*)::bigint as total_runs,
                SUM("costUsd") as total_cost,
                AVG("durationMs") as avg_duration
            FROM agent_run
            WHERE "startedAt" >= ${sevenDaysAgo}
        `
    ]);

    const summary = summaryStats[0];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Platform Observability</h1>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Total Runs (7d)</p>
                    <p className="text-2xl font-bold">
                        {Number(summary?.total_runs ?? 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Total Cost (7d)</p>
                    <p className="text-2xl font-bold">${(summary?.total_cost ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Avg Duration (7d)</p>
                    <p className="text-2xl font-bold">
                        {summary?.avg_duration
                            ? `${(Number(summary.avg_duration) / 1000).toFixed(1)}s`
                            : "—"}
                    </p>
                </div>
            </div>

            {/* Daily stats */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Daily Runs (Last 7 Days)</h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Date</th>
                                <th className="px-4 py-2 text-right font-medium">Total Runs</th>
                                <th className="px-4 py-2 text-right font-medium">Completed</th>
                                <th className="px-4 py-2 text-right font-medium">Failed</th>
                                <th className="px-4 py-2 text-right font-medium">Success Rate</th>
                                <th className="px-4 py-2 text-right font-medium">Avg Duration</th>
                                <th className="px-4 py-2 text-right font-medium">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyStats.map((day) => (
                                <tr
                                    key={String(day.date)}
                                    className="border-border border-b last:border-0"
                                >
                                    <td className="px-4 py-2">{formatDate(day.date, tz)}</td>
                                    <td className="px-4 py-2 text-right">
                                        {Number(day.total_runs).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right text-green-500">
                                        {Number(day.completed_runs).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right text-red-500">
                                        {Number(day.failed_runs).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right text-green-500">
                                        {day.success_rate != null
                                            ? `${(day.success_rate * 100).toFixed(1)}%`
                                            : "—"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        {day.avg_duration_ms != null
                                            ? `${(day.avg_duration_ms / 1000).toFixed(1)}s`
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        ${(day.total_cost ?? 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {dailyStats.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        No run data in the last 7 days
                                    </td>
                                </tr>
                            )}
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
                                <th className="px-4 py-2 text-right font-medium">
                                    Prompt Cost (est.)
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                    Completion Cost (est.)
                                </th>
                                <th className="px-4 py-2 text-right font-medium">Tokens</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyCosts.map((day) => (
                                <tr
                                    key={String(day.date)}
                                    className="border-border border-b last:border-0"
                                >
                                    <td className="px-4 py-2">{formatDate(day.date, tz)}</td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        ${(day.total_cost ?? 0).toFixed(2)}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        ${(day.prompt_cost ?? 0).toFixed(2)}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        ${(day.completion_cost ?? 0).toFixed(2)}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        {Number(day.total_tokens).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {dailyCosts.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        No cost data in the last 7 days
                                    </td>
                                </tr>
                            )}
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
                                <th className="px-4 py-2 text-right font-medium">Runs</th>
                                <th className="px-4 py-2 text-right font-medium">Cost (USD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topTenants.map((t) => (
                                <tr key={t.slug} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{t.name}</td>
                                    <td className="text-muted-foreground px-4 py-2 text-right">
                                        {Number(t.run_count).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        ${Number(t.total_cost).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {topTenants.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3}
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
                                <th className="px-4 py-2 text-left font-medium">Source</th>
                                <th className="px-4 py-2 text-left font-medium">Run ID</th>
                                <th className="px-4 py-2 text-left font-medium">Error</th>
                                <th className="px-4 py-2 text-left font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentErrors.map((run) => (
                                <tr key={run.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{run.agent.name}</td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {run.source || "—"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                                        {run.id.substring(0, 12)}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-red-500">
                                        {(run.outputText || "Unknown error").substring(0, 80)}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {formatDateTime(run.createdAt, tz)}
                                    </td>
                                </tr>
                            ))}
                            {recentErrors.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
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
