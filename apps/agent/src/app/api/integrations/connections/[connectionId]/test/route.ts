import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getMcpTools } from "@repo/mastra";
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
            const tools = await getMcpTools({
                organizationId,
                userId: session.user.id
            });
            const toolNames = Object.keys(tools).filter((name) => name.startsWith(`${serverId}_`));
            const success = toolNames.length > 0;

            await prisma.integrationConnection.update({
                where: { id: connection.id },
                data: {
                    lastTestedAt: new Date(),
                    errorMessage: success ? null : "No tools available for this connection"
                }
            });

            return NextResponse.json({
                success,
                toolCount: toolNames.length,
                sampleTools: toolNames.slice(0, 5)
            });
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
