import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantUsagePage({
    params
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true }
    });
    if (!org) notFound();

    // Get workspace IDs for this org
    const workspaces = await prisma.workspace.findMany({
        where: { organizationId: org.id },
        select: { id: true }
    });
    const wsIds = workspaces.map((w) => w.id);

    // Get agent IDs scoped to these workspaces
    const agents = await prisma.agent.findMany({
        where: { workspaceId: { in: wsIds } },
        select: { id: true, name: true, slug: true }
    });
    const agentIds = agents.map((a) => a.id);

    // Get last 30 days of stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [statsDaily, costDaily] = await Promise.all([
        prisma.agentStatsDaily.findMany({
            where: {
                agentId: { in: agentIds },
                date: { gte: thirtyDaysAgo }
            },
            orderBy: { date: "desc" }
        }),
        prisma.agentCostDaily.findMany({
            where: {
                agentId: { in: agentIds },
                date: { gte: thirtyDaysAgo }
            },
            orderBy: { date: "desc" }
        })
    ]);

    // Aggregate stats
    const totalRuns = statsDaily.reduce((sum, s) => sum + s.totalRuns, 0);
    const totalCost = costDaily.reduce((sum, c) => sum + c.totalCostUsd, 0);
    const totalPromptCost = costDaily.reduce((sum, c) => sum + c.promptCostUsd, 0);
    const totalCompletionCost = costDaily.reduce((sum, c) => sum + c.completionCostUsd, 0);

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold">Usage (Last 30 Days)</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Total Runs</p>
                    <p className="text-2xl font-bold">{totalRuns.toLocaleString()}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Total Cost</p>
                    <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Prompt / Completion Cost</p>
                    <p className="text-2xl font-bold">
                        ${totalPromptCost.toFixed(2)} / ${totalCompletionCost.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Per-agent breakdown */}
            <div>
                <h3 className="mb-3 text-sm font-semibold">Per-Agent Breakdown</h3>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Agent</th>
                                <th className="px-4 py-2 text-right font-medium">Runs</th>
                                <th className="px-4 py-2 text-right font-medium">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => {
                                const runs = statsDaily
                                    .filter((s) => s.agentId === agent.id)
                                    .reduce((sum, s) => sum + s.totalRuns, 0);
                                const cost = costDaily
                                    .filter((c) => c.agentId === agent.id)
                                    .reduce((sum, c) => sum + c.totalCostUsd, 0);
                                return (
                                    <tr
                                        key={agent.id}
                                        className="border-border border-b last:border-0"
                                    >
                                        <td className="px-4 py-2">
                                            {agent.name}
                                            <span className="text-muted-foreground ml-1 text-xs">
                                                ({agent.slug})
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {runs.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right">${cost.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
