import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            select: { id: true }
        });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const tasks = await prisma.playbookBootTask.findMany({
            where: { playbookId: playbook.id },
            orderBy: { sortOrder: "asc" }
        });

        return NextResponse.json({ tasks });
    } catch (error) {
        console.error("[playbooks] Boot tasks list error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const body = await request.json();

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const maxSort = await prisma.playbookBootTask.aggregate({
            where: { playbookId: playbook.id },
            _max: { sortOrder: true }
        });

        const task = await prisma.playbookBootTask.create({
            data: {
                playbookId: playbook.id,
                title: body.title,
                description: body.description ?? null,
                priority: body.priority ?? 5,
                tags: body.tags ?? [],
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1
            }
        });

        return NextResponse.json({ task }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Boot task create error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
