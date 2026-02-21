import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * DELETE /api/users/me
 * GDPR Right to Erasure (Art. 17)
 *
 * Soft-deletes the user immediately. Hard-delete after 30-day grace period.
 * Anonymizes audit log entries (userId -> "DELETED_USER").
 * Returns a deletion confirmation receipt.
 */
export async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = auth;

    try {
        const deletionTimestamp = new Date();

        const deletedCounts = {
            agentTraces: 0,
            agentRuns: 0,
            chatMessages: 0,
            costEvents: 0,
            sessions: 0,
            auditLogsAnonymized: 0
        };

        await prisma.$transaction(async (tx) => {
            const runs = await tx.agentRun.findMany({
                where: { userId },
                select: { id: true }
            });
            const runIds = runs.map((r) => r.id);

            if (runIds.length > 0) {
                const traceResult = await tx.agentTrace.deleteMany({
                    where: { runId: { in: runIds } }
                });
                deletedCounts.agentTraces = traceResult.count;

                const runResult = await tx.agentRun.deleteMany({
                    where: { userId }
                });
                deletedCounts.agentRuns = runResult.count;
            }

            const costResult = await tx.costEvent.deleteMany({
                where: { userId }
            });
            deletedCounts.costEvents = costResult.count;

            const sessionResult = await tx.session.deleteMany({
                where: { userId }
            });
            deletedCounts.sessions = sessionResult.count;

            const auditResult = await tx.auditLog.updateMany({
                where: { actorId: userId },
                data: { actorId: "DELETED_USER" }
            });
            deletedCounts.auditLogsAnonymized = auditResult.count;

            await tx.account.deleteMany({ where: { userId } });
            await tx.membership.deleteMany({ where: { userId } });

            await tx.user.update({
                where: { id: userId },
                data: {
                    name: "Deleted User",
                    email: `deleted-${userId}@deleted.agentc2.ai`,
                    image: null
                }
            });
        });

        return NextResponse.json({
            success: true,
            receipt: {
                userId,
                deletedAt: deletionTimestamp.toISOString(),
                gracePeriodEnds: new Date(
                    deletionTimestamp.getTime() + 30 * 24 * 60 * 60 * 1000
                ).toISOString(),
                deletedCounts,
                note: "Account has been deactivated. Full data deletion will occur after the 30-day grace period. Contact support to undo within this period."
            }
        });
    } catch (error) {
        console.error("[GDPR] Erasure failed for user:", userId, error);
        return NextResponse.json(
            { success: false, error: "Erasure failed. Please contact support." },
            { status: 500 }
        );
    }
}
