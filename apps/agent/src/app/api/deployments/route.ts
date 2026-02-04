import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get("entityType");
        const entityId = searchParams.get("entityId");
        const environment = searchParams.get("environment");

        const deployments = await prisma.deployment.findMany({
            where: {
                entityType: entityType || undefined,
                entityId: entityId || undefined,
                environment: environment || undefined
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, deployments });
    } catch (error) {
        console.error("[Deployments List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list deployments" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { entityType, entityId, versionId, environment } = body;

        if (!entityType || !entityId || !versionId || !environment) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: entityType, entityId, versionId, environment"
                },
                { status: 400 }
            );
        }

        const existing = await prisma.deployment.findFirst({
            where: { entityType, entityId, environment }
        });

        if (existing) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Deployment already exists for this environment"
                },
                { status: 409 }
            );
        }

        const deployment = await prisma.deployment.create({
            data: {
                entityType,
                entityId,
                versionId,
                environment,
                status: body.status || "DRAFT",
                approvedBy: body.approvedBy || null,
                approvedAt: body.approvedAt || null,
                trafficPercent: body.trafficPercent || null,
                previousDeploymentId: body.previousDeploymentId || null
            }
        });

        return NextResponse.json({ success: true, deployment });
    } catch (error) {
        console.error("[Deployment Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create deployment" },
            { status: 500 }
        );
    }
}
