import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function verifyEntityBelongsToOrg(
    entityId: string,
    organizationId: string
): Promise<boolean> {
    const agent = await prisma.agent.findFirst({
        where: { id: entityId, workspace: { organizationId } }
    });
    if (agent) return true;

    const workspace = await prisma.workspace.findFirst({
        where: { id: entityId, organizationId }
    });
    return !!workspace;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const deployment = await prisma.deployment.findUnique({
            where: { id }
        });

        if (!deployment) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        const belongsToOrg = await verifyEntityBelongsToOrg(
            deployment.entityId,
            authContext.organizationId
        );
        if (!belongsToOrg) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, deployment });
    } catch (error) {
        console.error("[Deployment Get] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get deployment" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.deployment.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        const belongsToOrg = await verifyEntityBelongsToOrg(
            existing.entityId,
            authContext.organizationId
        );
        if (!belongsToOrg) {
            return NextResponse.json(
                { success: false, error: "Deployment not found" },
                { status: 404 }
            );
        }

        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                status: body.status,
                approvedBy: body.approvedBy,
                approvedAt: body.approvedAt,
                trafficPercent: body.trafficPercent,
                previousDeploymentId: body.previousDeploymentId
            }
        });

        return NextResponse.json({ success: true, deployment });
    } catch (error) {
        console.error("[Deployment Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update deployment" },
            { status: 500 }
        );
    }
}
