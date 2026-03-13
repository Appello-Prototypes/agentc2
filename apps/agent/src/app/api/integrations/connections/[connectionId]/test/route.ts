import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { testMcpServer, type McpServerTestResult } from "@repo/agentc2/mcp";
import { authenticateRequest } from "@/lib/api-auth";
import {
    getConnectionMissingFields,
    getConnectionCredentials,
    resolveConnectionServerId,
    computeEffectiveDefault
} from "@/lib/integrations";

/**
 * POST /api/integrations/connections/[connectionId]/test
 *
 * Test a connection by validating credentials and listing tools (MCP).
 */
export async function POST(
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

        const missingFields = getConnectionMissingFields(connection, connection.provider);
        if (missingFields.length > 0) {
            await prisma.integrationConnection.update({
                where: { id: connection.id },
                data: {
                    lastTestedAt: new Date(),
                    errorMessage: "Missing required credentials"
                }
            });
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required credentials",
                    missingFields
                },
                { status: 400 }
            );
        }

        if (
            connection.provider.providerType === "mcp" ||
            connection.provider.providerType === "custom"
        ) {
            // Clear any previous errorMessage before testing so the connection
            // is visible to getIntegrationConnections (which filters by errorMessage)
            if (connection.errorMessage) {
                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: { errorMessage: null }
                });
            }

            // Credential-only providers (e.g. Cursor) use native tools, not MCP.
            // Validate them with a direct API call instead of MCP handshake.
            const credentialOnlyResult = await testCredentialOnlyProvider(
                connection.provider.key,
                getConnectionCredentials(connection)
            );
            if (credentialOnlyResult !== null) {
                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: {
                        lastTestedAt: new Date(),
                        errorMessage: credentialOnlyResult.success
                            ? null
                            : credentialOnlyResult.error || "Credential validation failed"
                    }
                });
                return NextResponse.json(credentialOnlyResult);
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
            // ATLAS (supergateway/SSE) and other remote MCP servers may need >10s to connect
            const timeoutMs = connection.provider.key === "atlas" ? 60000 : 30000;
            const testResult: McpServerTestResult = await testMcpServer({
                serverId,
                organizationId,
                userId: authContext.userId,
                allowEnvFallback: false,
                timeoutMs
            });
            const success = testResult.success;
            const errorDetail = testResult.phases.find((phase) => phase.status === "fail")?.detail;

            await prisma.integrationConnection.update({
                where: { id: connection.id },
                data: {
                    lastTestedAt: new Date(),
                    errorMessage: success ? null : errorDetail || "Connection test failed"
                }
            });

            return NextResponse.json(testResult);
        }

        if (connection.provider.authType === "oauth") {
            const credentials = getConnectionCredentials(connection);
            const connected = Boolean(
                credentials.accessToken || credentials.refreshToken || credentials.oauthToken
            );
            await prisma.integrationConnection.update({
                where: { id: connection.id },
                data: {
                    lastTestedAt: new Date(),
                    errorMessage: connected ? null : "OAuth credentials missing"
                }
            });
            return NextResponse.json({
                success: connected,
                connected
            });
        }

        await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: {
                lastTestedAt: new Date(),
                errorMessage: null
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Integrations Connection] Test error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test connection"
            },
            { status: 500 }
        );
    }
}

/**
 * Test credential-only providers that don't expose MCP servers.
 * Returns a result object if this provider is credential-only, or null
 * to fall through to the standard MCP test path.
 */
async function testCredentialOnlyProvider(
    providerKey: string,
    credentials: Record<string, unknown>
): Promise<{ success: boolean; error?: string; detail?: string } | null> {
    switch (providerKey) {
        case "cursor": {
            const apiKey = (credentials.CURSOR_API_KEY as string) || (credentials.apiKey as string);
            if (!apiKey) {
                return { success: false, error: "CURSOR_API_KEY not found in credentials" };
            }
            try {
                const basicAuth = Buffer.from(`${apiKey}:`).toString("base64");
                const resp = await fetch("https://api.cursor.com/v0/agents", {
                    method: "GET",
                    headers: {
                        Authorization: `Basic ${basicAuth}`,
                        "Content-Type": "application/json"
                    },
                    signal: AbortSignal.timeout(10_000)
                });
                if (resp.ok || resp.status === 200) {
                    return {
                        success: true,
                        detail: `Cursor API key valid (HTTP ${resp.status})`
                    };
                }
                const body = await resp.text().catch(() => "");
                return {
                    success: false,
                    error: `Cursor API returned HTTP ${resp.status}: ${body.slice(0, 200)}`
                };
            } catch (err) {
                return {
                    success: false,
                    error: `Cursor API unreachable: ${err instanceof Error ? err.message : String(err)}`
                };
            }
        }
        case "claude-code": {
            const apiKey =
                (credentials.ANTHROPIC_API_KEY as string) || (credentials.apiKey as string);
            if (!apiKey) {
                return { success: false, error: "ANTHROPIC_API_KEY not found in credentials" };
            }
            try {
                const resp = await fetch("https://api.anthropic.com/v1/models", {
                    method: "GET",
                    headers: {
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    signal: AbortSignal.timeout(10_000)
                });
                if (resp.ok || resp.status === 200) {
                    return {
                        success: true,
                        detail: `Claude Code API key valid (HTTP ${resp.status})`
                    };
                }
                const body = await resp.text().catch(() => "");
                return {
                    success: false,
                    error: `Claude Code API returned HTTP ${resp.status}: ${body.slice(0, 200)}`
                };
            } catch (err) {
                return {
                    success: false,
                    error: `Claude Code API unreachable: ${err instanceof Error ? err.message : String(err)}`
                };
            }
        }
        default:
            return null;
    }
}
