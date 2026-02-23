import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

/**
 * GET /api/admin/playbooks
 * List all playbooks (all statuses, filterable) — admin only
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

        const where: Record<string, unknown> = {};
        if (status) where.status = status;

        const [playbooks, total] = await Promise.all([
            prisma.playbook.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    publisherOrg: {
                        select: { id: true, name: true, slug: true }
                    },
                    _count: {
                        select: { components: true, installations: true, reviews: true }
                    }
                }
            }),
            prisma.playbook.count({ where })
        ]);

        return NextResponse.json({ playbooks, total });
    } catch (error) {
        console.error("[admin/playbooks] List error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
