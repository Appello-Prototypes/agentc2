import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/playbooks/[slug]/publish
 * Submit for review / publish
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            include: { components: true, versions: { take: 1, orderBy: { version: "desc" } } }
        });

        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
        if (playbook.components.length === 0) {
            return NextResponse.json(
                { error: "Playbook must have at least one component before publishing" },
                { status: 400 }
            );
        }
        if (playbook.versions.length === 0) {
            return NextResponse.json(
                { error: "Playbook must be packaged before publishing" },
                { status: 400 }
            );
        }

        const updated = await prisma.playbook.update({
            where: { slug },
            data: { status: "PENDING_REVIEW" }
        });

        return NextResponse.json({ playbook: updated });
    } catch (error) {
        console.error("[playbooks] Publish error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
