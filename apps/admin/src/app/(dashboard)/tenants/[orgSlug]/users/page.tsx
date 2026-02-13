import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantUsersPage({
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

    const memberships = await prisma.membership.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" }
    });

    // Membership has no user relation — look up users by their IDs
    const userIds = memberships.map((m) => m.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Members ({memberships.length})</h2>
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">Email</th>
                            <th className="px-4 py-2 text-left font-medium">Role</th>
                            <th className="px-4 py-2 text-left font-medium">Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {memberships.map((m) => {
                            const user = userMap.get(m.userId);
                            return (
                                <tr key={m.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{user?.name || "Unknown"}</td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {user?.email || m.userId}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                            {m.role}
                                        </span>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {m.createdAt.toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
