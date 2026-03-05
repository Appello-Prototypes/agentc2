import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function getOrgEntityIds(organizationId: string): Promise<Set<string>> {
    const workspaces = await prisma.workspace.findMany({
        where: { organizationId },
        select: { id: true }
    });
    const workspaceIds = workspaces.map((w) => w.id);

    const agents = await prisma.agent.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true }
    });

    const entityIds = new Set<string>();
    for (const a of agents) entityIds.add(a.id);
    for (const wId of workspaceIds) entityIds.add(wId);
    entityIds.add(organizationId);
    return entityIds;
}

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get("entityType");
        const entityId = searchParams.get("entityId");
        const environment = searchParams.get("environment");

        const orgEntityIds = await getOrgEntityIds(authContext.organizationId);

        const deployments = await prisma.deployment.findMany({
            where: {
                entityType: entityType || undefined,
                entityId: entityId || undefined,
                environment: environment || undefined
            },
            orderBy: { createdAt: "desc" }
        });

        const filtered = deployments.filter((d) => orgEntityIds.has(d.entityId));

        return NextResponse.json({ success: true, deployments: filtered });
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
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

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

        const orgEntityIds = await getOrgEntityIds(authContext.organizationId);
        if (!orgEntityIds.has(entityId)) {
            return NextResponse.json(
                { success: false, error: "Entity not found" },
                { status: 404 }
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
