import { prisma } from "@repo/database";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
    searchParams
}: {
    searchParams: Promise<{
        action?: string;
        entityType?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const action = params.action || "";
    const entityType = params.entityType || "";
    const page = parseInt(params.page || "1");
    const limit = 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [logs, total] = await Promise.all([
        prisma.adminAuditLog.findMany({
            where: where as any,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                adminUser: {
                    select: { name: true, email: true, role: true }
                }
            }
        }),
        prisma.adminAuditLog.count({ where: where as any })
    ]);

    const totalPages = Math.ceil(total / limit);

    // Get unique actions for filter
    const uniqueActions = await prisma.adminAuditLog.groupBy({
        by: ["action"],
        orderBy: { action: "asc" }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Admin Audit Log</h1>
                <span className="text-muted-foreground text-sm">{total} entries</span>
            </div>

            {/* Filters */}
            <form className="flex items-center gap-3" action="/audit">
                <select
                    name="action"
                    defaultValue={action}
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                >
                    <option value="">All Actions</option>
                    {uniqueActions.map((a) => (
                        <option key={a.action} value={a.action}>
                            {a.action}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                >
                    Filter
                </button>
            </form>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Action</th>
                            <th className="px-4 py-3 text-left font-medium">Admin</th>
                            <th className="px-4 py-3 text-left font-medium">Entity</th>
                            <th className="px-4 py-3 text-left font-medium">IP</th>
                            <th className="px-4 py-3 text-left font-medium">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-3">
                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-500">
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm">{log.adminUser.name}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {log.adminUser.role}
                                    </div>
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {log.entityType}:{log.entityId.substring(0, 12)}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                                    {log.ipAddress}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {log.createdAt.toISOString()}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No audit log entries
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="text-muted-foreground text-center text-sm">
                    Page {page} of {totalPages}
                </div>
            )}
        </div>
    );
}
