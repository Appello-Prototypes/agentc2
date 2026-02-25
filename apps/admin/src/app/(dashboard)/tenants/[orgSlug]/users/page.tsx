import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { TenantUsersManager } from "@/components/tenant-users-manager";

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

    const userIds = memberships.map((m) => m.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, status: true }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const members = memberships.map((m) => {
        const user = userMap.get(m.userId);
        return {
            id: m.id,
            userId: m.userId,
            role: m.role,
            createdAt: m.createdAt.toISOString(),
            userName: user?.name || "Unknown",
            userEmail: user?.email || m.userId,
            userStatus: user?.status || "unknown"
        };
    });

    return <TenantUsersManager orgId={org.id} initialMembers={members} />;
}
