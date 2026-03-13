import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import {
    getIntegrationProviders,
    invalidateMcpCacheForOrg,
    resetMcpClients
} from "@repo/agentc2/mcp";
import { invalidateMcpToolsCacheForOrg } from "@repo/agentc2/tools";
import { clearModelCache } from "@repo/agentc2/agents/model-registry";
import { provisionIntegration, hasBlueprint } from "@repo/agentc2/integrations";
import { auditLog } from "@/lib/audit-log";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";
import { getConnectionMissingFields } from "@/lib/integrations";
import { authenticateRequest } from "@/lib/api-auth";

const createConnectionSchema = z.object({
    providerKey: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    scope: z.enum(["org", "user"]).default("org"),
    credentials: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    isDefault: z.boolean().optional(),
    copyFromProviderKey: z.string().max(200).optional()
});

/**
 * GET /api/integrations/connections
 *
 * List integration connections for the organization.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = authContext.organizationId;

        const { searchParams } = new URL(request.url);
        const providerKey = searchParams.get("providerKey");
        const scopeFilter = searchParams.get("scope");

        const connections = await prisma.integrationConnection.findMany({
            where: {
                organizationId,
                ...(providerKey ? { provider: { key: providerKey } } : {}),
                ...(scopeFilter ? { scope: scopeFilter } : {}),
                OR: [{ scope: "org" }, { scope: "user", userId: authContext.userId }]
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });

        const response = connections.map((connection) => ({
            id: connection.id,
            name: connection.name,
            scope: connection.scope,
            isDefault: connection.isDefault,
            isActive: connection.isActive,
            provider: {
                id: connection.provider.id,
                key: connection.provider.key,
                name: connection.provider.name,
                category: connection.provider.category,
                authType: connection.provider.authType,
                providerType: connection.provider.providerType
            },
            missingFields: getConnectionMissingFields(connection, connection.provider),
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt
        }));

        return NextResponse.json({ success: true, connections: response });
    } catch (error) {
        console.error("[Integrations Connections] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list connections"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/integrations/connections
 *
 * Create a new integration connection.
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = authContext.organizationId;

        const membership = await prisma.membership.findFirst({
            where: { userId: authContext.userId, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const parsed = createConnectionSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid input",
                    details: parsed.error.flatten().fieldErrors
                },
                { status: 400 }
            );
        }
        const { providerKey, name, scope, credentials, metadata, isDefault, copyFromProviderKey } =
            parsed.data;

        await getIntegrationProviders();

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: providerKey }
        });
        if (!provider) {
            return NextResponse.json(
                { success: false, error: `Provider '${providerKey}' not found` },
                { status: 404 }
            );
        }

        // Resolve credentials: either from manual input or by copying from a linked provider
        let resolvedCredentials = credentials ?? null;
        if (!resolvedCredentials && copyFromProviderKey) {
            const sourceConnection = await prisma.integrationConnection.findFirst({
                where: {
                    isActive: true,
                    provider: { key: copyFromProviderKey },
                    organizationId
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });
            if (sourceConnection?.credentials) {
                const decrypted = decryptCredentials(sourceConnection.credentials);
                if (decrypted && typeof decrypted === "object") {
                    resolvedCredentials = decrypted as Record<string, unknown>;
                }
            }
            if (!resolvedCredentials) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `No active credentials found for linked provider '${copyFromProviderKey}'`
                    },
                    { status: 400 }
                );
            }
        }

        const connectionUserId = scope === "user" ? authContext.userId : null;

        if (isDefault) {
            await prisma.integrationConnection.updateMany({
                where: {
                    organizationId,
                    providerId: provider.id,
                    scope,
                    ...(connectionUserId ? { userId: connectionUserId } : {})
                },
                data: { isDefault: false }
            });
        }

        const encryptedCredentials = encryptCredentials(resolvedCredentials);

        const connection = await prisma.integrationConnection.create({
            data: {
                providerId: provider.id,
                organizationId,
                userId: connectionUserId,
                scope,
                name,
                isDefault: isDefault === true,
                isActive: true,
                credentials: encryptedCredentials
                    ? JSON.parse(JSON.stringify(encryptedCredentials))
                    : undefined,
                metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
            },
            include: { provider: true }
        });

        await auditLog.integrationCreate(connection.id, authContext.userId, organizationId, {
            providerKey: provider.key,
            scope,
            name
        });

        resetMcpClients();
        invalidateMcpCacheForOrg(organizationId);
        invalidateMcpToolsCacheForOrg(organizationId);
        clearModelCache();

        // Auto-provision Skill + Agent if a blueprint exists for this provider
        let provisionResult = null;
        if (hasBlueprint(provider.key)) {
            try {
                // Get workspace for this org
                const workspace = await prisma.workspace.findFirst({
                    where: { organizationId, isDefault: true },
                    select: { id: true }
                });

                if (workspace) {
                    provisionResult = await provisionIntegration(connection.id, {
                        workspaceId: workspace.id,
                        userId: authContext.userId
                    });
                    console.log(
                        `[Integrations] Auto-provisioned ${provider.key}: ` +
                            `skill=${provisionResult.skillId || "none"}, ` +
                            `agent=${provisionResult.agentId || "none"}, ` +
                            `tools=${provisionResult.toolsDiscovered.length}`
                    );

                    // Sync tools to onboarding agent if it exists
                    if (provisionResult.success && provisionResult.toolsDiscovered.length > 0) {
                        try {
                            const onboardingAgent = await prisma.agent.findFirst({
                                where: {
                                    workspaceId: workspace.id,
                                    isOnboardingAgent: true
                                }
                            });

                            if (onboardingAgent) {
                                await prisma.agentTool.createMany({
                                    data: provisionResult.toolsDiscovered.map((toolId) => ({
                                        agentId: onboardingAgent.id,
                                        toolId
                                    })),
                                    skipDuplicates: true
                                });

                                console.log(
                                    `[Integrations] Synced ${provisionResult.toolsDiscovered.length} ` +
                                        `tools from ${provider.key} to onboarding agent ${onboardingAgent.slug}`
                                );
                            }
                        } catch (syncError) {
                            console.error(
                                `[Integrations] Failed to sync tools to onboarding agent:`,
                                syncError
                            );
                        }
                    }
                }
            } catch (provisionError) {
                console.error(
                    `[Integrations] Auto-provisioning failed for ${provider.key}:`,
                    provisionError
                );
                provisionResult = {
                    success: false,
                    toolsDiscovered: [] as string[],
                    skillCreated: false,
                    agentCreated: false,
                    error:
                        provisionError instanceof Error
                            ? provisionError.message
                            : "Unknown provisioning error"
                };
            }
        }

        return NextResponse.json({
            success: true,
            connection,
            provisioned: provisionResult
                ? {
                      success: provisionResult.success,
                      skillId: provisionResult.skillId,
                      agentId: provisionResult.agentId,
                      toolsDiscovered: provisionResult.toolsDiscovered.length,
                      error: provisionResult.error
                  }
                : null
        });
    } catch (error) {
        console.error("[Integrations Connections] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create connection"
            },
            { status: 500 }
        );
    }
}
