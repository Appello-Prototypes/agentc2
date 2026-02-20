import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { writeAuditLog } from "@repo/agentc2/audit";

/**
 * PUT /api/federation/exposures
 *
 * Update which agents are shared within a federation agreement.
 *
 * Body:
 * {
 *   "agreementId": "clx...",
 *   "agentIds": ["clx...", "clx..."]
 * }
 */
export async function PUT(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { agreementId, agentIds } = body;

        if (!agreementId || !Array.isArray(agentIds)) {
            return NextResponse.json(
                { success: false, error: "agreementId and agentIds[] are required" },
                { status: 400 }
            );
        }

        const agreement = await prisma.federationAgreement.findUnique({
            where: { id: agreementId }
        });

        if (!agreement) {
            return NextResponse.json(
                { success: false, error: "Agreement not found" },
                { status: 404 }
            );
        }

        if (
            agreement.initiatorOrgId !== authContext.organizationId &&
            agreement.responderOrgId !== authContext.organizationId
        ) {
            return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            // Remove existing exposures for this org
            await tx.federationExposure.deleteMany({
                where: {
                    agreementId,
                    ownerOrgId: authContext.organizationId
                }
            });

            // Create new exposures
            if (agentIds.length > 0) {
                await tx.federationExposure.createMany({
                    data: agentIds.map((agentId: string) => ({
                        agreementId,
                        ownerOrgId: authContext.organizationId,
                        agentId
                    }))
                });
            }
        });

        await writeAuditLog({
            organizationId: authContext.organizationId,
            actorType: "user",
            actorId: authContext.userId,
            action: "federation.exposures_updated",
            resource: `federation_agreement:${agreementId}`,
            outcome: "success",
            metadata: { agentCount: agentIds.length }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Federation] Update exposures error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update exposures" },
            { status: 500 }
        );
    }
}
