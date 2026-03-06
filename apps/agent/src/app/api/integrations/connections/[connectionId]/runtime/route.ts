import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import {
    resolveConnectionServerId,
    getConnectionCredentials,
    computeEffectiveDefault
} from "@/lib/integrations";

const REDACT_PATTERNS = [/key/i, /token/i, /secret/i, /password/i, /credential/i, /auth/i];

function redactValue(key: string, value: unknown): unknown {
    if (typeof value === "string" && REDACT_PATTERNS.some((p) => p.test(key))) {
        if (value.length <= 8) return "••••";
        return value.slice(0, 4) + "••••" + value.slice(-4);
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return redactObject(value as Record<string, unknown>);
    }
    return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = redactValue(key, value);
    }
    return result;
}

/**
 * GET /api/integrations/connections/[connectionId]/runtime
 *
 * Returns the compiled runtime configuration for this connection (with redacted secrets).
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request as NextRequest);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const organizationId = authContext.organizationId;

        const { connectionId } = await params;
        const connection = await prisma.integrationConnection.findFirst({
            where: { id: connectionId, organizationId },
            include: { provider: true }
        });

        if (!connection) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        const isEffectiveDefault = await computeEffectiveDefault(
            connection,
            connection.provider.key
        );
        const serverId = resolveConnectionServerId(
            connection.provider.key,
            connection,
            isEffectiveDefault
        );
        const credentials = getConnectionCredentials(connection);
        const redactedCredentials = redactObject(credentials);

        const providerConfig = connection.provider.configJson as Record<string, unknown> | null;

        const config: Record<string, unknown> = {
            serverId,
            providerKey: connection.provider.key,
            providerType: connection.provider.providerType,
            transportType: providerConfig?.hostedMcpUrl ? "sse" : "stdio",
            scope: connection.scope,
            isDefault: connection.isDefault,
            lastTestedAt: connection.lastTestedAt?.toISOString() ?? null,
            credentials: redactedCredentials,
            metadata: connection.metadata
                ? redactObject(connection.metadata as Record<string, unknown>)
                : null
        };

        if (providerConfig?.hostedMcpUrl) {
            config.hostedMcpUrl = providerConfig.hostedMcpUrl;
        }
        if (providerConfig?.command) {
            config.command = providerConfig.command;
        }
        if (providerConfig?.args) {
            config.args = providerConfig.args;
        }

        // OAuth token metadata
        if (credentials.accessToken) {
            config.oauth = {
                hasAccessToken: true,
                hasRefreshToken: !!credentials.refreshToken,
                tokenType: credentials.tokenType ?? "Bearer",
                expiresAt: credentials.expiresAt ?? null,
                scopes: credentials.scope ?? credentials.scopes ?? null
            };
        }

        // Tool count
        const toolCount = await prisma.integrationTool.count({
            where: { connectionId }
        });
        config.toolCount = toolCount;

        return NextResponse.json({
            success: true,
            connectionId,
            config
        });
    } catch (error) {
        console.error("[Integrations Runtime] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get runtime config"
            },
            { status: 500 }
        );
    }
}
