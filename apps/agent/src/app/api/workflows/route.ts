import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET() {
    try {
        const workflows = await prisma.workflow.findMany({
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
        const body = await request.json();
        const { name, slug, description } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "Missing required field: name" },
                { status: 400 }
            );
        }

        const workflowSlug = slug || generateSlug(name);
        const existing = await prisma.workflow.findUnique({
            where: { slug: workflowSlug }
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
                workspaceId: body.workspaceId || null,
                ownerId: body.ownerId || null,
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
