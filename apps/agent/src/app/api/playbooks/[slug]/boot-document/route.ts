import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            select: { bootDocument: true, autoBootEnabled: true }
        });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        return NextResponse.json({
            bootDocument: playbook.bootDocument,
            autoBootEnabled: playbook.autoBootEnabled
        });
    } catch (error) {
        console.error("[playbooks] Boot document get error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: Params) {
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

        const data: Record<string, unknown> = {};
        if (body.content !== undefined) data.bootDocument = body.content;
        if (body.autoBootEnabled !== undefined) data.autoBootEnabled = body.autoBootEnabled;

        await prisma.playbook.update({
            where: { slug },
            data
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[playbooks] Boot document update error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
