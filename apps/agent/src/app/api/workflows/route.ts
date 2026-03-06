import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { requireEntityAccess } from "@/lib/authz/require-entity-access";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const workflows = await prisma.workflow.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { runs: true } }
            }
        });

        return NextResponse.json({
            success: true,
            workflows: workflows.map((workflow) => ({
                id: workflow.id,
                slug: workflow.slug,
                name: workflow.name,
                description: workflow.description,
                version: workflow.version,
                isPublished: workflow.isPublished,
                isActive: workflow.isActive,
                runCount: workflow._count?.runs ?? 0,
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt
            }))
        });
    } catch (error) {
        console.error("[Workflows List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list workflows" },
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
        const access = await requireEntityAccess(
            authContext.userId,
            authContext.organizationId,
            "create"
        );
        if (!access.allowed) return access.response;

        const body = await request.json();
        const { name, slug, description } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "Missing required field: name" },
                { status: 400 }
            );
        }

        const { getDefaultWorkspaceIdForUser } = await import("@/lib/organization");
        let workspaceId = body.workspaceId;
        if (workspaceId) {
            const ws = await prisma.workspace.findFirst({
                where: { id: workspaceId, organizationId: authContext.organizationId }
            });
            if (!ws) {
                return NextResponse.json(
                    { success: false, error: "Workspace not found in your organization" },
                    { status: 403 }
                );
            }
        } else {
            workspaceId = await getDefaultWorkspaceIdForUser(authContext.userId);
        }

        const workflowSlug = slug || generateSlug(name);
        const existing = await prisma.workflow.findFirst({
            where: {
                slug: workflowSlug,
                workspace: { organizationId: authContext.organizationId }
            }
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: `Workflow slug '${workflowSlug}' already exists` },
                { status: 409 }
            );
        }

        const definitionJson = body.definitionJson || { steps: [] };

        const workflow = await prisma.workflow.create({
            data: {
                slug: workflowSlug,
                name,
                description: description || null,
                definitionJson,
                inputSchemaJson: body.inputSchemaJson || null,
                outputSchemaJson: body.outputSchemaJson || null,
                maxSteps: body.maxSteps ?? 50,
                timeout: body.timeout || null,
                retryConfig: body.retryConfig || null,
                isPublished: body.isPublished ?? false,
                isActive: body.isActive ?? true,
                workspaceId: workspaceId || null,
                ownerId: body.ownerId || authContext.userId,
                type: body.type || "USER"
            }
        });

        await prisma.workflowVersion.create({
            data: {
                workflowId: workflow.id,
                version: 1,
                definitionJson,
                description: body.versionDescription || "Initial version",
                createdBy: body.createdBy || null
            }
        });

        return NextResponse.json({
            success: true,
            workflow
        });
    } catch (error) {
        console.error("[Workflow Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create workflow" },
            { status: 500 }
        );
    }
}
