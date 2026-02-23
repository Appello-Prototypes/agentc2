import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING_REVIEW: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["SUSPENDED"],
    SUSPENDED: ["PUBLISHED"],
    DRAFT: ["PENDING_REVIEW"]
};

/**
 * PATCH /api/admin/playbooks/[id]/status
 * Approve, suspend, or reject a playbook — admin only
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { id } = await params;
        const body = await request.json();
        const { status: newStatus, reason } = body;

        if (!newStatus) {
            return NextResponse.json({ error: "status is required" }, { status: 400 });
        }

        const playbook = await prisma.playbook.findUnique({ where: { id } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const allowed = VALID_TRANSITIONS[playbook.status] ?? [];
        if (!allowed.includes(newStatus)) {
            return NextResponse.json(
                {
                    error: `Cannot transition from ${playbook.status} to ${newStatus}`,
                    allowedTransitions: allowed
                },
                { status: 400 }
            );
        }

        const updated = await prisma.playbook.update({
            where: { id },
            data: { status: newStatus }
        });

        // Create audit log entry
        try {
            await prisma.auditLog.create({
                data: {
                    actorId: authResult.context.userId,
                    action: `PLAYBOOK_STATUS_${newStatus.toUpperCase()}`,
                    entityType: "Playbook",
                    entityId: id,
                    metadata: { previousStatus: playbook.status, newStatus, reason: reason ?? null }
                }
            });
        } catch {
            // Non-critical: don't fail the status change if audit log fails
        }

        return NextResponse.json({ playbook: updated });
    } catch (error) {
        console.error("[admin/playbooks] Status update error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
