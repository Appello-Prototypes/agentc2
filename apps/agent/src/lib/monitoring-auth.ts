import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { authenticateRequest } from "@/lib/api-auth";

const OWNER_ROLE = "owner";

export async function requireMonitoringWorkspace(
    workspaceId?: string | null,
    request?: NextRequest
) {
    // Try API key authentication first
    let userId: string | null = null;
    let orgId: string | null = null;

    if (request) {
        const apiAuth = await authenticateRequest(request);
        if (apiAuth) {
            userId = apiAuth.userId;
            orgId = apiAuth.organizationId;
        }
    }

    // Fall back to session auth
    if (!userId) {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        userId = session?.user?.id ?? null;
    }

    if (!userId) {
        return { ok: false, status: 401, error: "Unauthorized" } as const;
    }

    const membership = await prisma.membership.findFirst({
        where: { userId },
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
        resolvedWorkspaceId = await getDefaultWorkspaceIdForUser(userId);
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
        userId
    } as const;
}
