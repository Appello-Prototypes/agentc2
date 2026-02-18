import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { approveConnection, suspendConnection, revokeConnection } from "@repo/mastra/federation";

/**
 * GET /api/federation/connections/[id]
 *
 * Get details of a specific federation connection.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id },
            include: {
                initiatorOrg: {
                    select: { id: true, name: true, slug: true, logoUrl: true }
                },
                responderOrg: {
                    select: { id: true, name: true, slug: true, logoUrl: true }
                },
                exposures: {
                    include: {
                        agent: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                description: true
                            }
                        }
                    }
                },
                _count: { select: { messages: true } }
            }
        });

        if (!agreement) {
            return NextResponse.json(
                { success: false, error: "Connection not found" },
                { status: 404 }
            );
        }

        // Verify the requesting org is a party to this agreement
        if (
            agreement.initiatorOrgId !== authContext.organizationId &&
            agreement.responderOrgId !== authContext.organizationId
        ) {
            return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
        }

        const isInitiator = agreement.initiatorOrgId === authContext.organizationId;
        const partnerOrg = isInitiator ? agreement.responderOrg : agreement.initiatorOrg;

        return NextResponse.json({
            success: true,
            connection: {
                id: agreement.id,
                status: agreement.status,
                direction: isInitiator ? "initiated" : "received",
                partnerOrg,
                myExposures: agreement.exposures
                    .filter((e) => e.ownerOrgId === authContext.organizationId)
                    .map((e) => ({
                        id: e.id,
                        agent: e.agent,
                        exposedSkills: e.exposedSkills,
                        enabled: e.enabled
                    })),
                partnerExposures: agreement.exposures
                    .filter((e) => e.ownerOrgId !== authContext.organizationId)
                    .map((e) => ({
                        id: e.id,
                        agent: {
                            name: e.agent.name,
                            slug: e.agent.slug,
                            description: e.agent.description
                        },
                        exposedSkills: e.exposedSkills,
                        enabled: e.enabled
                    })),
                governance: {
                    maxRequestsPerHour: agreement.maxRequestsPerHour,
                    maxRequestsPerDay: agreement.maxRequestsPerDay,
                    dataClassification: agreement.dataClassification,
                    allowFileTransfer: agreement.allowFileTransfer,
                    requireHumanApproval: agreement.requireHumanApproval
                },
                messageCount: agreement._count.messages,
                createdAt: agreement.createdAt,
                approvedAt: agreement.approvedAt
            }
        });
    } catch (error) {
        console.error("[Federation] Get connection error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get connection details" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/federation/connections/[id]
 *
 * Update a federation connection: approve, suspend, or revoke.
 *
 * Body:
 * {
 *   "action": "approve" | "suspend" | "revoke",
 *   "exposedAgentIds": ["clx..."],  // required for approve
 *   "reason": "..."                  // required for suspend/revoke
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        let result: { success: boolean; error?: string };

        switch (action) {
            case "approve":
                result = await approveConnection(
                    id,
                    authContext.organizationId,
                    authContext.userId,
                    {
                        exposedAgentIds: body.exposedAgentIds || [],
                        maxRequestsPerHour: body.maxRequestsPerHour,
                        maxRequestsPerDay: body.maxRequestsPerDay,
                        dataClassification: body.dataClassification
                    }
                );
                break;

            case "suspend":
                result = await suspendConnection(
                    id,
                    authContext.organizationId,
                    authContext.userId,
                    body.reason || "Suspended by admin"
                );
                break;

            case "revoke":
                result = await revokeConnection(
                    id,
                    authContext.organizationId,
                    authContext.userId,
                    body.reason || "Revoked by admin"
                );
                break;

            default:
                return NextResponse.json(
                    { success: false, error: `Invalid action: ${action}` },
                    { status: 400 }
                );
        }

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, action });
    } catch (error) {
        console.error("[Federation] Update connection error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update connection" },
            { status: 500 }
        );
    }
}
