import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/agentc2/mcp";
import { getBlueprint, hasBlueprint } from "@repo/agentc2/integrations";
import { getConnectionMissingFields, getConnectionCredentials } from "@/lib/integrations";
import { authenticateRequest } from "@/lib/api-auth";

const resolveProviderStatus = (options: {
    authType: string;
    hasConnections: boolean;
    hasMissing: boolean;
}) => {
    if (options.authType === "none") {
        return "connected";
    }
    if (!options.hasConnections) {
        return "disconnected";
    }
    if (options.hasMissing) {
        return "missing_auth";
    }
    return "connected";
};

/**
 * GET /api/integrations/providers
 *
 * List available integration providers with connection status.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { userId, organizationId } = authContext;

        const [providers, connections] = await Promise.all([
            getIntegrationProviders(),
            prisma.integrationConnection.findMany({
                where: {
                    organizationId,
                    OR: [{ scope: "org" }, { scope: "user", userId }]
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            })
        ]);

        const connectionsByProvider = new Map<string, typeof connections>();
        for (const connection of connections) {
            const list = connectionsByProvider.get(connection.providerId) ?? [];
            list.push(connection);
            connectionsByProvider.set(connection.providerId, list);
        }

        // Look up provisioned resources for connected providers
        const workspace = await prisma.workspace.findFirst({
            where: { organizationId, isDefault: true },
            select: { id: true }
        });

        // Find all auto-provisioned skills and agents for this workspace
        const [provisionedSkills, provisionedAgents] = workspace
            ? await Promise.all([
                  prisma.skill.findMany({
                      where: {
                          workspaceId: workspace.id,
                          metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
                      },
                      select: {
                          id: true,
                          slug: true,
                          name: true,
                          metadata: true,
                          tools: { select: { toolId: true } }
                      }
                  }),
                  prisma.agent.findMany({
                      where: {
                          workspaceId: workspace.id,
                          metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
                      },
                      select: {
                          id: true,
                          slug: true,
                          name: true,
                          isActive: true,
                          metadata: true
                      }
                  })
              ])
            : [[], []];

        // Index by provider key from metadata
        const skillsByProvider = new Map<string, (typeof provisionedSkills)[0]>();
        for (const s of provisionedSkills) {
            const meta = s.metadata as Record<string, unknown> | null;
            const pk = meta?.providerKey as string | undefined;
            if (pk) skillsByProvider.set(pk, s);
        }
        const agentsByProvider = new Map<string, (typeof provisionedAgents)[0]>();
        for (const a of provisionedAgents) {
            const meta = a.metadata as Record<string, unknown> | null;
            const pk = meta?.providerKey as string | undefined;
            if (pk) agentsByProvider.set(pk, a);
        }

        const response = providers.map((provider) => {
            const providerConnections = connectionsByProvider.get(provider.id) ?? [];
            const connectionDetails = providerConnections.map((connection) => {
                const missingFields = getConnectionMissingFields(connection, provider);
                const credentials = getConnectionCredentials(connection);
                const connected =
                    provider.authType === "oauth"
                        ? Boolean(
                              credentials.accessToken ||
                              credentials.refreshToken ||
                              credentials.oauthToken
                          )
                        : missingFields.length === 0;
                return {
                    id: connection.id,
                    name: connection.name,
                    scope: connection.scope,
                    isDefault: connection.isDefault,
                    isActive: connection.isActive,
                    connected,
                    missingFields
                };
            });

            const hasMissing = connectionDetails.some((detail) => detail.missingFields.length > 0);
            const status = resolveProviderStatus({
                authType: provider.authType,
                hasConnections: providerConnections.length > 0,
                hasMissing
            });

            // Look up provisioned resources for this provider
            const provSkill = skillsByProvider.get(provider.key);
            const provAgent = agentsByProvider.get(provider.key);
            const provisionedMeta =
                provSkill || provAgent
                    ? {
                          skill: provSkill
                              ? {
                                    id: provSkill.id,
                                    slug: provSkill.slug,
                                    name: provSkill.name,
                                    toolCount: provSkill.tools.length,
                                    deactivated: Boolean(
                                        (provSkill.metadata as Record<string, unknown>)?.deactivated
                                    )
                                }
                              : null,
                          agent: provAgent
                              ? {
                                    id: provAgent.id,
                                    slug: provAgent.slug,
                                    name: provAgent.name,
                                    isActive: provAgent.isActive
                                }
                              : null
                      }
                    : null;

            // Extract health status from connection metadata
            const healthStatus =
                providerConnections.length > 0
                    ? ((providerConnections[0].metadata as Record<string, unknown>)
                          ?.healthStatus as string | undefined)
                    : undefined;

            // Resolve tool count: for MCP providers use provisioned count if available,
            // for static providers use blueprint definition.
            const isMcp = provider.providerType === "mcp" || provider.providerType === "custom";
            const blueprint = getBlueprint(provider.key);
            let toolCount: number | null;
            if (isMcp) {
                toolCount = provSkill ? provSkill.tools.length : null;
            } else {
                toolCount = blueprint?.skill.staticTools?.length ?? 0;
            }

            return {
                id: provider.id,
                key: provider.key,
                name: provider.name,
                description: provider.description,
                category: provider.category,
                authType: provider.authType,
                providerType: provider.providerType,
                maturityLevel: provider.maturityLevel,
                status,
                connections: connectionDetails,
                toolCount,
                toolDiscovery: blueprint?.skill.toolDiscovery ?? (isMcp ? "dynamic" : null),
                hasBlueprint: hasBlueprint(provider.key),
                actions: provider.actionsJson,
                triggers: provider.triggersJson,
                config: provider.configJson,
                provisioned: provisionedMeta,
                healthStatus: healthStatus || null
            };
        });

        return NextResponse.json({ success: true, providers: response });
    } catch (error) {
        console.error("[Integrations Providers] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list providers"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/integrations/providers
 *
 * Register a custom integration provider.
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { userId, organizationId } = authContext;

        const membership = await prisma.membership.findFirst({
            where: { userId, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            key,
            name,
            description,
            category,
            authType = "custom",
            providerType = "custom",
            config
        } = body as {
            key?: string;
            name?: string;
            description?: string;
            category?: string;
            authType?: string;
            providerType?: string;
            config?: Record<string, unknown>;
        };

        if (!name || !category) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, category" },
                { status: 400 }
            );
        }

        const providerKey =
            key && typeof key === "string"
                ? key
                : `custom-${name.toLowerCase().replace(/\s+/g, "-")}`;

        const existing = await prisma.integrationProvider.findUnique({
            where: { key: providerKey }
        });
        if (existing) {
            return NextResponse.json(
                { success: false, error: "Provider key already exists" },
                { status: 400 }
            );
        }

        if (providerType === "custom") {
            const transport = config?.transport;
            if (transport !== "http" && transport !== "stdio") {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Custom providers require config.transport of 'http' or 'stdio'"
                    },
                    { status: 400 }
                );
            }
        }

        const provider = await prisma.integrationProvider.create({
            data: {
                key: providerKey,
                name,
                description: description || null,
                category,
                authType,
                providerType,
                configJson: config ? (config as Prisma.InputJsonValue) : undefined,
                isActive: true
            }
        });

        return NextResponse.json({ success: true, provider });
    } catch (error) {
        console.error("[Integrations Providers] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create provider"
            },
            { status: 500 }
        );
    }
}
