import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { getServerTimezone } from "@/lib/timezone-server";
import { formatDateTime } from "@/lib/timezone";
import { TenantLifecycleActions } from "@/components/tenant-lifecycle-actions";

export const dynamic = "force-dynamic";

export default async function TenantLifecyclePage({
    params
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true, status: true }
    });
    if (!org) notFound();

    const tz = await getServerTimezone();

    const events = await prisma.tenantLifecycleEvent.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 50
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Lifecycle History</h2>
                <TenantLifecycleActions
                    orgId={org.id}
                    orgName={org.name}
                    status={org.status}
                    variant="compact"
                />
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">From</th>
                            <th className="px-4 py-2 text-left font-medium">To</th>
                            <th className="px-4 py-2 text-left font-medium">Reason</th>
                            <th className="px-4 py-2 text-left font-medium">By</th>
                            <th className="px-4 py-2 text-left font-medium">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((event) => (
                            <tr key={event.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-2">
                                    <StatusBadge status={event.fromStatus} />
                                </td>
                                <td className="px-4 py-2">
                                    <StatusBadge status={event.toStatus} />
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {event.reason || "—"}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                                    {event.performedBy?.substring(0, 8) || "system"}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {formatDateTime(event.createdAt, tz)}
                                </td>
                            </tr>
                        ))}
                        {events.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No lifecycle events recorded
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        trial: "bg-blue-500/10 text-blue-500",
        suspended: "bg-red-500/10 text-red-500",
        past_due: "bg-yellow-500/10 text-yellow-500",
        deactivated: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-500/10 text-gray-500"}`}
        >
            {status}
        </span>
    );
}
