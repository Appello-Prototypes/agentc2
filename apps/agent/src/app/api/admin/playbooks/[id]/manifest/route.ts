import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/playbooks/[id]/manifest
 * View full manifest for security review — admin only
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { version: "desc" },
                    take: 1
                },
                components: {
                    orderBy: { sortOrder: "asc" }
                }
            }
        });

        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const latestVersion = playbook.versions[0];
        if (!latestVersion) {
            return NextResponse.json({ error: "No versions available" }, { status: 404 });
        }

        return NextResponse.json({
            playbook: {
                id: playbook.id,
                slug: playbook.slug,
                name: playbook.name,
                status: playbook.status,
                version: latestVersion.version
            },
            manifest: latestVersion.manifest,
            components: playbook.components
        });
    } catch (error) {
        console.error("[admin/playbooks] Manifest view error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
