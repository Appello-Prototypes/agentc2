import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string; taskId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug, taskId } = await params;
        const body = await request.json();

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const task = await prisma.playbookBootTask.findUnique({ where: { id: taskId } });
        if (!task || task.playbookId !== playbook.id) {
            return NextResponse.json({ error: "Boot task not found" }, { status: 404 });
        }

        const updated = await prisma.playbookBootTask.update({
            where: { id: taskId },
            data: {
                title: body.title ?? undefined,
                description: body.description ?? undefined,
                priority: body.priority ?? undefined,
                tags: body.tags ?? undefined,
                sortOrder: body.sortOrder ?? undefined
            }
        });

        return NextResponse.json({ task: updated });
    } catch (error) {
        console.error("[playbooks] Boot task update error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug, taskId } = await params;

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const task = await prisma.playbookBootTask.findUnique({ where: { id: taskId } });
        if (!task || task.playbookId !== playbook.id) {
            return NextResponse.json({ error: "Boot task not found" }, { status: 404 });
        }

        await prisma.playbookBootTask.delete({ where: { id: taskId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[playbooks] Boot task delete error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
