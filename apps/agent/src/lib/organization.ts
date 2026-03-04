import { prisma } from "@repo/database";
import { cookies } from "next/headers";

const ACTIVE_ORG_COOKIE = "agentc2-active-org";

export async function getUserMembership(userId: string) {
    return prisma.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" }
    });
}

export async function getUserOrganizationId(
    userId: string,
    preferredOrgId?: string | null
): Promise<string | null> {
    let effectivePreferred = preferredOrgId;

    if (!effectivePreferred) {
        try {
            const cookieStore = await cookies();
            effectivePreferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
        } catch {
            // cookies() unavailable outside request context
        }
    }

    if (effectivePreferred) {
        const verified = await prisma.membership.findUnique({
            where: {
                userId_organizationId: { userId, organizationId: effectivePreferred }
            },
            select: { organizationId: true }
        });
        if (verified) return verified.organizationId;
    }
    const membership = await getUserMembership(userId);
    return membership?.organizationId ?? null;
}

export async function getDefaultWorkspaceIdForUser(userId: string, preferredOrgId?: string | null) {
    const organizationId = await getUserOrganizationId(userId, preferredOrgId);
    if (!organizationId) return null;

    const workspace = await prisma.workspace.findFirst({
        where: { organizationId, isDefault: true },
        orderBy: { createdAt: "asc" }
    });

    return workspace?.id ?? null;
}

export async function userHasPermission(
    userId: string,
    organizationId: string,
    permission: string
): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } }
    });
    if (!membership) return false;
    if (membership.role === "owner") return true;
    return membership.permissions.includes(permission);
}
