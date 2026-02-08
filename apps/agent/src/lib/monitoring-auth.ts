import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";

const OWNER_ROLE = "owner";

export async function requireMonitoringWorkspace(workspaceId?: string | null) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        return { ok: false, status: 401, error: "Unauthorized" } as const;
    }

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" }
    });

    if (!membership || membership.role !== OWNER_ROLE) {
        return { ok: false, status: 403, error: "Insufficient permissions" } as const;
    }

    let resolvedWorkspaceId = workspaceId || null;

    if (resolvedWorkspaceId) {
        const workspace = await prisma.workspace.findFirst({
            where: { id: resolvedWorkspaceId, organizationId: membership.organizationId },
            select: { id: true }
        });

        if (!workspace) {
            return { ok: false, status: 403, error: "Workspace not accessible" } as const;
        }
    } else {
        resolvedWorkspaceId = await getDefaultWorkspaceIdForUser(session.user.id);
        if (!resolvedWorkspaceId) {
            const workspace = await prisma.workspace.findFirst({
                where: { organizationId: membership.organizationId },
                orderBy: { createdAt: "asc" },
                select: { id: true }
            });
            resolvedWorkspaceId = workspace?.id ?? null;
        }
    }

    if (!resolvedWorkspaceId) {
        return { ok: false, status: 403, error: "Workspace not found" } as const;
    }

    return {
        ok: true,
        workspaceId: resolvedWorkspaceId,
        organizationId: membership.organizationId,
        userId: session.user.id
    } as const;
}
