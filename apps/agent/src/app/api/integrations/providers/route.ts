import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma, type Prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";
import { getConnectionMissingFields, getConnectionCredentials } from "@/lib/integrations";

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
export async function GET() {
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

        const [providers, connections] = await Promise.all([
            getIntegrationProviders(),
            prisma.integrationConnection.findMany({
                where: {
                    organizationId,
                    OR: [{ scope: "org" }, { scope: "user", userId: session.user.id }]
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

            return {
                id: provider.id,
                key: provider.key,
                name: provider.name,
                description: provider.description,
                category: provider.category,
                authType: provider.authType,
                providerType: provider.providerType,
                status,
                connections: connectionDetails,
                toolCount:
                    provider.providerType === "mcp" || provider.providerType === "custom"
                        ? null
                        : 0,
                actions: provider.actionsJson,
                triggers: provider.triggersJson,
                config: provider.configJson
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
