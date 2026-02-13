import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantIntegrationsPage({
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

    const connections = await prisma.integrationConnection.findMany({
        where: { organizationId: org.id },
        include: {
            provider: { select: { key: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Integrations ({connections.length})</h2>
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">Provider</th>
                            <th className="px-4 py-2 text-left font-medium">Scope</th>
                            <th className="px-4 py-2 text-left font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {connections.map((conn) => (
                            <tr key={conn.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-2 font-medium">{conn.name}</td>
                                <td className="px-4 py-2">
                                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                        {conn.provider.key}
                                    </span>
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {conn.scope || "—"}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {conn.createdAt.toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {connections.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No integrations configured
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
