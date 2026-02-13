import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    // Platform KPIs
    const [tenantCounts, totalAgents, recentAdminActions] = await Promise.all([
        prisma.organization.groupBy({
            by: ["status"],
            _count: { id: true }
        }),
        prisma.agent.count(),
        prisma.adminAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { adminUser: { select: { name: true, email: true } } }
        })
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of tenantCounts) {
        statusMap[row.status] = row._count.id;
    }
    const totalTenants = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Platform Dashboard</h1>

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Total Tenants" value={totalTenants} />
                <KpiCard title="Active" value={statusMap["active"] || 0} accent="green" />
                <KpiCard title="Suspended" value={statusMap["suspended"] || 0} accent="red" />
                <KpiCard title="Total Agents" value={totalAgents} />
            </div>

            {/* Recent admin actions */}
            <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Admin Actions</h2>
                {recentAdminActions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No admin actions recorded yet.</p>
                ) : (
                    <div className="bg-card border-border overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border border-b">
                                    <th className="px-4 py-2 text-left font-medium">Action</th>
                                    <th className="px-4 py-2 text-left font-medium">Admin</th>
                                    <th className="px-4 py-2 text-left font-medium">Entity</th>
                                    <th className="px-4 py-2 text-left font-medium">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAdminActions.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="border-border border-b last:border-0"
                                    >
                                        <td className="px-4 py-2 font-mono text-xs">
                                            {log.action}
                                        </td>
                                        <td className="px-4 py-2">{log.adminUser.name}</td>
                                        <td className="text-muted-foreground px-4 py-2 text-xs">
                                            {log.entityType}:{log.entityId}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-2 text-xs">
                                            {log.createdAt.toISOString()}
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

function KpiCard({
    title,
    value,
    accent
}: {
    title: string;
    value: number;
    accent?: "green" | "red";
}) {
    const accentClass =
        accent === "green" ? "text-green-500" : accent === "red" ? "text-red-500" : "";
    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className={`text-3xl font-bold ${accentClass}`}>{value}</p>
        </div>
    );
}
