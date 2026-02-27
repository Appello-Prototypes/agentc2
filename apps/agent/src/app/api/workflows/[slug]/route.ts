import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@repo/database";
import {
    createChangeLog,
    detectScalarChange,
    detectJsonChange,
    type FieldChange
} from "@/lib/changelog";

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

        if (body.expectedVersion !== undefined && existing.version !== body.expectedVersion) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Version conflict: this workflow was modified by someone else",
                    currentVersion: existing.version,
                    expectedVersion: body.expectedVersion
                },
                { status: 409 }
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
        if (body.visibility !== undefined) {
            updateData.visibility = body.visibility;
            if (body.visibility === "PUBLIC" && !existing.publicToken) {
                updateData.publicToken = randomUUID();
            }
        }
        if (body.metadata !== undefined) updateData.metadata = body.metadata;

        // Detect all field-level changes for changelog
        const fieldChanges: FieldChange[] = [];
        const sc = detectScalarChange;
        const jc = detectJsonChange;
        const checks = [
            sc("name", existing.name, body.name),
            sc("description", existing.description, body.description),
            sc("maxSteps", existing.maxSteps, body.maxSteps),
            sc("timeout", existing.timeout, body.timeout),
            sc("isPublished", existing.isPublished, body.isPublished),
            sc("isActive", existing.isActive, body.isActive),
            sc("visibility", existing.visibility, body.visibility),
            jc("definitionJson", existing.definitionJson, body.definitionJson),
            jc("inputSchemaJson", existing.inputSchemaJson, body.inputSchemaJson),
            jc("outputSchemaJson", existing.outputSchemaJson, body.outputSchemaJson),
            jc("retryConfig", existing.retryConfig, body.retryConfig)
        ];
        for (const c of checks) {
            if (c) fieldChanges.push(c);
        }

        const definitionChanged =
            body.definitionJson !== undefined &&
            JSON.stringify(existing.definitionJson) !== JSON.stringify(body.definitionJson);

        const hasAnyChange = fieldChanges.length > 0;
        let nextVersion = existing.version;

        if (definitionChanged) {
            const lastVersion = await prisma.workflowVersion.findFirst({
                where: { workflowId: existing.id },
                orderBy: { version: "desc" },
                select: { version: true }
            });
            nextVersion = (lastVersion?.version || 0) + 1;
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

        if (hasAnyChange) {
            createChangeLog({
                entityType: "workflow",
                entityId: existing.id,
                entitySlug: existing.slug,
                version: nextVersion,
                action: "update",
                changes: fieldChanges,
                reason: body.changeReason || undefined,
                createdBy: body.createdBy || undefined
            }).catch((err) => console.error("[ChangeLog] Workflow write failed:", err));
        }

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
