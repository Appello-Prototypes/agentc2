import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";
import { mapIntegrations } from "@repo/agentc2";
import { testMcpServer } from "@repo/agentc2/mcp";
import {
    resolveConnectionServerId,
    getConnectionCredentials,
    computeEffectiveDefault
} from "@/lib/integrations";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/playbooks/installations/[id]/setup/verify
 *
 * Tests all connected integrations in parallel.
 * Returns per-integration test results.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const { organizationId, userId } = authResult.context;

        const installation = await prisma.playbookInstallation.findFirst({
            where: { id, targetOrgId: organizationId },
            include: {
                playbook: {
                    select: { requiredIntegrations: true }
                }
            }
        });

        if (!installation) {
            return NextResponse.json({ error: "Installation not found" }, { status: 404 });
        }

        const integrationStatus = await mapIntegrations({
            requiredIntegrations: installation.playbook.requiredIntegrations,
            targetOrgId: organizationId,
            targetWorkspaceId: installation.targetWorkspaceId
        });

        const connectedMappings = integrationStatus.filter(
            (m: { connected: boolean }) => m.connected
        );

        const results = await Promise.allSettled(
            connectedMappings.map(
                async (mapping: {
                    provider: string;
                    connected: boolean;
                    connectionId?: string;
                }) => {
                    if (!mapping.connectionId) {
                        return {
                            provider: mapping.provider,
                            success: false,
                            error: "No connection ID"
                        };
                    }

                    const connection = await prisma.integrationConnection.findFirst({
                        where: {
                            id: mapping.connectionId,
                            organizationId
                        },
                        include: { provider: true }
                    });

                    if (!connection) {
                        return {
                            provider: mapping.provider,
                            success: false,
                            error: "Connection not found"
                        };
                    }

                    if (
                        connection.provider.providerType === "mcp" ||
                        connection.provider.providerType === "custom"
                    ) {
                        const isEffectiveDefault = await computeEffectiveDefault(
                            connection,
                            connection.provider.key
                        );
                        const serverId = resolveConnectionServerId(
                            connection.provider.key,
                            connection,
                            isEffectiveDefault
                        );
                        const testResult = await testMcpServer({
                            serverId,
                            organizationId,
                            userId,
                            timeoutMs: 30000
                        });

                        const errorDetail = testResult.phases.find(
                            (p) => p.status === "fail"
                        )?.detail;

                        await prisma.integrationConnection.update({
                            where: { id: connection.id },
                            data: {
                                lastTestedAt: new Date(),
                                errorMessage: testResult.success
                                    ? null
                                    : (errorDetail ?? "Test failed")
                            }
                        });

                        return {
                            provider: mapping.provider,
                            success: testResult.success,
                            toolCount: testResult.toolCount,
                            error: errorDetail
                        };
                    }

                    if (connection.provider.providerType === "oauth") {
                        const credentials = getConnectionCredentials(connection);
                        const hasTokens = Boolean(
                            credentials.accessToken ||
                            credentials.refreshToken ||
                            credentials.oauthToken
                        );

                        await prisma.integrationConnection.update({
                            where: { id: connection.id },
                            data: {
                                lastTestedAt: new Date(),
                                errorMessage: hasTokens ? null : "Missing OAuth tokens"
                            }
                        });

                        return {
                            provider: mapping.provider,
                            success: hasTokens,
                            error: hasTokens ? undefined : "Missing OAuth tokens"
                        };
                    }

                    await prisma.integrationConnection.update({
                        where: { id: connection.id },
                        data: {
                            lastTestedAt: new Date(),
                            errorMessage: null
                        }
                    });

                    return {
                        provider: mapping.provider,
                        success: true
                    };
                }
            )
        );

        const testResults = results.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            return {
                provider: connectedMappings[i]!.provider,
                success: false,
                error: r.reason instanceof Error ? r.reason.message : "Test failed"
            };
        });

        // Check IntegrationTool enablement for connected providers
        const toolWarnings: Array<{ provider: string; message: string }> = [];
        for (const mapping of connectedMappings) {
            if (!mapping.connectionId) continue;
            const disabledTools = await prisma.integrationTool.findMany({
                where: {
                    connectionId: mapping.connectionId,
                    isEnabled: false
                },
                select: { toolId: true, name: true }
            });
            if (disabledTools.length > 0) {
                toolWarnings.push({
                    provider: mapping.provider,
                    message: `${disabledTools.length} tool(s) disabled: ${disabledTools.map((t) => t.name).join(", ")}`
                });
            }
        }

        const allPassed = testResults.every((r: { success: boolean }) => r.success);
        const disconnected = integrationStatus.filter((m: { connected: boolean }) => !m.connected);

        return NextResponse.json({
            allPassed: allPassed && disconnected.length === 0,
            results: testResults,
            disconnected: disconnected.map((m: { provider: string }) => m.provider),
            toolWarnings
        });
    } catch (error) {
        console.error("[setup/verify]", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
