import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { invalidateMcpCacheForOrg, resetMcpClients } from "@repo/mastra/mcp";
import { invalidateMcpToolsCacheForOrg } from "@repo/mastra/tools";
import { auditLog } from "@/lib/audit-log";
import { getUserOrganizationId } from "@/lib/organization";
import { decryptCredentials, encryptCredentials } from "@/lib/credential-crypto";
import { getConnectionMissingFields } from "@/lib/integrations";

async function resolveConnection(connectionId: string, organizationId: string) {
    return prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
        include: { provider: true }
    });
}

/**
 * GET /api/integrations/connections/[connectionId]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const { connectionId } = await params;
        const connection = await resolveConnection(connectionId, organizationId);

        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        const decryptedCredentials = decryptCredentials(connection.credentials);

        return NextResponse.json({
            success: true,
            connection: {
                ...connection,
                credentials: decryptedCredentials,
                missingFields: getConnectionMissingFields(connection, connection.provider)
            }
        });
    } catch (error) {
        console.error("[Integrations Connection] Error loading:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to load connection"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/integrations/connections/[connectionId]
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const { connectionId } = await params;
        const connection = await resolveConnection(connectionId, organizationId);
        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, isDefault, isActive, credentials, metadata } = body as {
            name?: string;
            isDefault?: boolean;
            isActive?: boolean;
            credentials?: Record<string, unknown> | null;
            metadata?: Record<string, unknown> | null;
        };

        if (isDefault) {
            await prisma.integrationConnection.updateMany({
                where: {
                    organizationId,
                    providerId: connection.providerId,
                    scope: connection.scope,
                    ...(connection.userId ? { userId: connection.userId } : {})
                },
                data: { isDefault: false }
            });
        }

        const encryptedCredentials =
            credentials !== undefined ? encryptCredentials(credentials ?? null) : undefined;

        const updated = await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(isDefault !== undefined ? { isDefault } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
                ...(encryptedCredentials !== undefined
                    ? {
                          credentials: encryptedCredentials
                              ? JSON.parse(JSON.stringify(encryptedCredentials))
                              : null
                      }
                    : {}),
                ...(metadata !== undefined
                    ? { metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null }
                    : {})
            }
        });

        await auditLog.integrationUpdate(connection.id, session.user.id, organizationId, {
            name,
            isDefault,
            isActive,
            credentialsUpdated: credentials !== undefined,
            metadataUpdated: metadata !== undefined
        });

        resetMcpClients();
        invalidateMcpCacheForOrg(organizationId);
        invalidateMcpToolsCacheForOrg(organizationId);

        return NextResponse.json({ success: true, connection: updated });
    } catch (error) {
        console.error("[Integrations Connection] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update connection"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/integrations/connections/[connectionId]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const { connectionId } = await params;
        const connection = await resolveConnection(connectionId, organizationId);
        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        // Deactivate provisioned Skill + Agent before deleting the connection
        let deprovisioned = null;
        try {
            const { deprovisionIntegration, hasBlueprint } = await import("@repo/mastra");
            if (hasBlueprint(connection.provider.key)) {
                const workspace = await prisma.workspace.findFirst({
                    where: { organizationId, isDefault: true },
                    select: { id: true }
                });
                if (workspace) {
                    deprovisioned = await deprovisionIntegration(
                        connection.provider.key,
                        workspace.id
                    );
                }
            }
        } catch (deprovisionError) {
            console.error("[Integrations] Deprovisioning failed:", deprovisionError);
        }

        await prisma.integrationConnection.delete({
            where: { id: connection.id }
        });

        if (connection.agentTriggerId) {
            await prisma.agentTrigger.delete({
                where: { id: connection.agentTriggerId }
            });
        }

        await auditLog.integrationDelete(connection.id, session.user.id, organizationId, {
            providerId: connection.providerId,
            deprovisioned
        });

        resetMcpClients();
        invalidateMcpCacheForOrg(organizationId);
        invalidateMcpToolsCacheForOrg(organizationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Integrations Connection] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete connection"
            },
            { status: 500 }
        );
    }
}
