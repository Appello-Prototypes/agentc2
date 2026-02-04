import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

async function findWorkflow(slug: string) {
    return prisma.workflow.findFirst({
        where: { OR: [{ slug }, { id: slug }] }
    });
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] },
            include: {
                _count: { select: { runs: true } }
            }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            workflow: {
                ...workflow,
                runCount: workflow._count?.runs ?? 0
            }
        });
    } catch (error) {
        console.error("[Workflow Get] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get workflow" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const existing = await findWorkflow(slug);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.definitionJson !== undefined) updateData.definitionJson = body.definitionJson;
        if (body.inputSchemaJson !== undefined) updateData.inputSchemaJson = body.inputSchemaJson;
        if (body.outputSchemaJson !== undefined)
            updateData.outputSchemaJson = body.outputSchemaJson;
        if (body.maxSteps !== undefined) updateData.maxSteps = body.maxSteps;
        if (body.timeout !== undefined) updateData.timeout = body.timeout;
        if (body.retryConfig !== undefined) updateData.retryConfig = body.retryConfig;
        if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;

        const definitionChanged =
            body.definitionJson !== undefined &&
            JSON.stringify(existing.definitionJson) !== JSON.stringify(body.definitionJson);

        if (definitionChanged) {
            const lastVersion = await prisma.workflowVersion.findFirst({
                where: { workflowId: existing.id },
                orderBy: { version: "desc" },
                select: { version: true }
            });
            const nextVersion = (lastVersion?.version || 0) + 1;
            updateData.version = nextVersion;

            await prisma.workflowVersion.create({
                data: {
                    workflowId: existing.id,
                    version: nextVersion,
                    definitionJson: body.definitionJson,
                    description: body.versionDescription || "Definition update",
                    createdBy: body.createdBy || null
                }
            });
        }

        const updated = await prisma.workflow.update({
            where: { id: existing.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            workflow: updated
        });
    } catch (error) {
        console.error("[Workflow Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update workflow" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const existing = await findWorkflow(slug);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        if (existing.type === "SYSTEM") {
            return NextResponse.json(
                { success: false, error: "SYSTEM workflows cannot be deleted" },
                { status: 403 }
            );
        }

        await prisma.workflow.delete({ where: { id: existing.id } });

        return NextResponse.json({
            success: true
        });
    } catch (error) {
        console.error("[Workflow Delete] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete workflow" },
            { status: 500 }
        );
    }
}
