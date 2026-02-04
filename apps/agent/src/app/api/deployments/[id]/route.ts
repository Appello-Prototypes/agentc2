import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
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
        const { id } = await params;
        const body = await request.json();

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
