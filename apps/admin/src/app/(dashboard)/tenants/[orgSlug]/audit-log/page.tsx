import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantAuditLogPage({
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

    // Get tenant audit logs (from the customer-facing audit log table)
    const logs = await prisma.auditLog.findMany({
        where: { tenantId: org.id },
        orderBy: { createdAt: "desc" },
        take: 100
    });

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Audit Log ({logs.length})</h2>
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Action</th>
                            <th className="px-4 py-2 text-left font-medium">Entity</th>
                            <th className="px-4 py-2 text-left font-medium">Actor</th>
                            <th className="px-4 py-2 text-left font-medium">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {log.entityType}:{log.entityId?.substring(0, 8)}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {log.actorId?.substring(0, 8) || "system"}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {log.createdAt.toISOString()}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No audit logs found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
