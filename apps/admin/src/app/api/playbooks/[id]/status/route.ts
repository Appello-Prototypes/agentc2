import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError, getAdminSession } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING_REVIEW: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["SUSPENDED"],
    SUSPENDED: ["PUBLISHED"],
    DRAFT: ["PENDING_REVIEW"]
};

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        await requireAdminAction(request, "playbook:review");

        const session = await getAdminSession(request);
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
            data: { status: newStatus },
            include: {
                publisherOrg: {
                    select: { id: true, name: true, slug: true }
                },
                _count: {
                    select: { components: true, installations: true, reviews: true }
                }
            }
        });

        const actionMap: Record<string, string> = {
            PUBLISHED: "PLAYBOOK_APPROVE",
            DRAFT: "PLAYBOOK_REJECT",
            SUSPENDED: "PLAYBOOK_SUSPEND"
        };
        const auditAction = actionMap[newStatus] ?? "PLAYBOOK_APPROVE";
        const { ipAddress, userAgent } = getRequestContext(request);

        await adminAudit.log({
            adminUserId: session?.adminUser?.id ?? "unknown",
            action: auditAction as "PLAYBOOK_APPROVE",
            entityType: "Playbook",
            entityId: id,
            beforeJson: { status: playbook.status },
            afterJson: { status: newStatus, reason: reason ?? null },
            ipAddress,
            userAgent,
            metadata: { playbookSlug: playbook.slug, reason: reason ?? null }
        });

        return NextResponse.json({ playbook: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[admin/playbooks] Status update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
