import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { decryptCredentials } from "@/lib/credential-crypto";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

const EVENT_NAME = "gmail.message.received";

const DEFAULT_INPUT_MAPPING = {
    template: "New email from {{from}}. Subject: {{subject}}. Snippet: {{snippet}}. Date: {{date}}."
};

/**
 * GET /api/integrations/gmail
 *
 * List Gmail integrations for the organization.
 */
export async function GET() {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { organizationId } = authResult.context;

        const integrations = await prisma.gmailIntegration.findMany({
            where: {
                workspace: {
                    organizationId
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            integrations
        });
    } catch (error) {
        console.error("[Gmail Integration] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list integrations"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/integrations/gmail
 *
 * Create or update Gmail integration for an agent.
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { organizationId } = authResult.context;

        const body = await request.json();
        const { agentId, gmailAddress, slackUserId, isActive } = body;

        if (!agentId || !gmailAddress || !slackUserId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: agentId, gmailAddress, slackUserId"
                },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: agentId }, { id: agentId }],
                workspace: { organizationId }
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${agentId}' not found` },
                { status: 404 }
            );
        }

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "gmail" }
        });

        const connection = provider
            ? await prisma.integrationConnection.findFirst({
                  where: {
                      organizationId,
                      providerId: provider.id,
                      OR: [
                          {
                              metadata: {
                                  path: ["gmailAddress"],
                                  equals: gmailAddress
                              }
                          },
                          {
                              credentials: {
                                  path: ["gmailAddress"],
                                  equals: gmailAddress
                              }
                          }
                      ]
                  }
              })
            : null;

        const decryptedCredentials = decryptCredentials(connection?.credentials);
        const storedAddress =
            (decryptedCredentials &&
            typeof decryptedCredentials === "object" &&
            !Array.isArray(decryptedCredentials)
                ? (decryptedCredentials as { gmailAddress?: string }).gmailAddress
                : null) ||
            (connection?.metadata &&
            typeof connection.metadata === "object" &&
            !Array.isArray(connection.metadata)
                ? (connection.metadata as { gmailAddress?: string }).gmailAddress
                : null);

        if (!storedAddress || storedAddress !== gmailAddress) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Gmail credentials not found for this address"
                },
                { status: 400 }
            );
        }

        const integration = await prisma.gmailIntegration.upsert({
            where: {
                agentId_gmailAddress: {
                    agentId: agent.id,
                    gmailAddress
                }
            },
            create: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                integrationConnectionId: connection?.id || null,
                gmailAddress,
                slackUserId,
                isActive: isActive !== false
            },
            update: {
                slackUserId,
                isActive: isActive !== false,
                integrationConnectionId: connection?.id || null
            }
        });

        const existingTrigger = await prisma.agentTrigger.findFirst({
            where: {
                agentId: agent.id,
                triggerType: "event",
                eventName: EVENT_NAME
            }
        });

        if (!existingTrigger) {
            await prisma.agentTrigger.create({
                data: {
                    agentId: agent.id,
                    workspaceId: agent.workspaceId,
                    name: "Gmail incoming email",
                    description: "Triggers when Gmail receives a new email.",
                    triggerType: "event",
                    eventName: EVENT_NAME,
                    filterJson: { gmailAddress },
                    inputMapping: DEFAULT_INPUT_MAPPING,
                    isActive: true
                }
            });
        } else if (!existingTrigger.filterJson) {
            await prisma.agentTrigger.update({
                where: { id: existingTrigger.id },
                data: {
                    filterJson: { gmailAddress },
                    inputMapping: existingTrigger.inputMapping || DEFAULT_INPUT_MAPPING
                }
            });
        }

        return NextResponse.json({
            success: true,
            integration
        });
    } catch (error) {
        console.error("[Gmail Integration] Error saving:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to save integration"
            },
            { status: 500 }
        );
    }
}
