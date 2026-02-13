import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantAgentsPage({
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

    const agents = await prisma.agent.findMany({
        where: { workspace: { organizationId: org.id } },
        include: {
            workspace: { select: { name: true } },
            _count: { select: { runs: true } }
        },
        orderBy: { updatedAt: "desc" }
    });

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Agents ({agents.length})</h2>
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">Slug</th>
                            <th className="px-4 py-2 text-left font-medium">Workspace</th>
                            <th className="px-4 py-2 text-left font-medium">Model</th>
                            <th className="px-4 py-2 text-left font-medium">Runs</th>
                            <th className="px-4 py-2 text-left font-medium">Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map((agent) => (
                            <tr key={agent.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-2 font-medium">{agent.name}</td>
                                <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                                    {agent.slug}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {agent.workspace.name}
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {agent.modelName}
                                </td>
                                <td className="px-4 py-2">{agent._count.runs}</td>
                                <td className="px-4 py-2">
                                    <span
                                        className={`inline-flex h-2 w-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-400"}`}
                                    />
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No agents found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
