import { prisma } from "@repo/database";

export async function getUserMembership(userId: string) {
    return prisma.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" }
    });
}

export async function getUserOrganizationId(userId: string) {
    const membership = await getUserMembership(userId);
    return membership?.organizationId ?? null;
}

export async function getDefaultWorkspaceIdForUser(userId: string) {
    const membership = await getUserMembership(userId);
    if (!membership) return null;

    const workspace = await prisma.workspace.findFirst({
        where: { organizationId: membership.organizationId, isDefault: true },
        orderBy: { createdAt: "asc" }
    });

    return workspace?.id ?? null;
}
