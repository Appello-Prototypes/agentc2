import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { testMcpServer, type McpServerTestResult } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";
import {
    getConnectionMissingFields,
    getConnectionCredentials,
    resolveConnectionServerId
} from "@/lib/integrations";

/**
 * POST /api/integrations/connections/[connectionId]/test
 *
 * Test a connection by validating credentials and listing tools (MCP).
 */
export async function POST(
    _request: Request,
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
            const serverId = resolveConnectionServerId(connection.provider.key, connection);
            // ATLAS (supergateway/SSE) and other remote MCP servers may need >10s to connect
            const timeoutMs = connection.provider.key === "atlas" ? 60000 : 30000;
            const testResult: McpServerTestResult = await testMcpServer({
                serverId,
                organizationId,
                userId: session.user.id,
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
