import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { requireUser } from "@/lib/authz/require-auth";

const DELETED_SENTINEL = "[DELETED]";

/**
 * DELETE /api/user/account
 *
 * Delete the current user's account (GDPR Art. 17 / CCPA right-to-delete).
 *
 * Strategy:
 *   1. Guard: sole-owner check
 *   2. Delete owned data (runs cascade via Prisma onDelete)
 *   3. Anonymize createdBy / userId references to preserve audit trail integrity
 *   4. Delete auth records (sessions, accounts, memberships)
 *   5. Delete user-specific policies and budget data
 *   6. Anonymize the User record
 *   7. Create audit entry and DSR record
 */
export async function DELETE() {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const memberships = await prisma.membership.findMany({
            where: { userId },
            select: { organizationId: true, role: true }
        });

        for (const m of memberships) {
            if (m.role === "owner") {
                const otherOwners = await prisma.membership.count({
                    where: {
                        organizationId: m.organizationId,
                        role: "owner",
                        userId: { not: userId }
                    }
                });
                if (otherOwners === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: "You are the sole owner of an organization. Transfer ownership before deleting your account."
                        },
                        { status: 400 }
                    );
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Delete user-owned data that should be fully removed
            await tx.userBudgetPolicy.deleteMany({ where: { userId } });
            await tx.budgetAlert.deleteMany({ where: { userId } });
            await tx.consentRecord.deleteMany({ where: { userId } });

            // 2. Delete auth and membership records
            await tx.membership.deleteMany({ where: { userId } });
            await tx.integrationConnection.deleteMany({ where: { userId } });
            await tx.session.deleteMany({ where: { userId } });
            await tx.account.deleteMany({ where: { userId } });

            // 3. Anonymize userId references (nullable fields — preserve records)
            await tx.agentRun.updateMany({
                where: { userId },
                data: { userId: DELETED_SENTINEL }
            });

            await tx.costEvent.updateMany({
                where: { userId },
                data: { userId: DELETED_SENTINEL }
            });

            await tx.supportTicket.updateMany({
                where: { submittedById: userId },
                data: { submittedById: DELETED_SENTINEL }
            });

            // 4. Anonymize createdBy references across content models
            const createdByModels = [
                "agent",
                "agent_version",
                "workflow",
                "workflow_version",
                "network",
                "network_version",
                "document",
                "document_version",
                "guardrail_config",
                "org_guardrail_policy",
                "learning_experiment",
                "skill",
                "skill_version",
                "agent_test_case",
                "agent_feedback",
                "campaign",
                "trigger",
                "schedule",
                "backlog_task",
                "invite",
                "api_key"
            ] as const;

            for (const table of createdByModels) {
                await tx.$executeRawUnsafe(
                    `UPDATE "${table}" SET "createdBy" = $1 WHERE "createdBy" = $2`,
                    DELETED_SENTINEL,
                    userId
                );
            }

            // 5. Anonymize actorId in audit logs
            await tx.auditLog.updateMany({
                where: { actorId: userId },
                data: { actorId: DELETED_SENTINEL }
            });

            // 6. Anonymize user record
            const deletedEmail = `deleted-${userId}@redacted.local`;
            await tx.user.update({
                where: { id: userId },
                data: {
                    name: "Deleted User",
                    email: deletedEmail,
                    image: null,
                    timezone: null,
                    termsAcceptedAt: null,
                    privacyConsentAt: null,
                    marketingConsent: false
                }
            });

            // 7. Create audit entry
            await tx.auditLog.create({
                data: {
                    action: "USER_DELETE",
                    entityType: "User",
                    entityId: userId,
                    actorId: DELETED_SENTINEL,
                    metadata: {
                        type: "user-self-deletion",
                        organizationsRemoved: memberships.map((m) => m.organizationId)
                    }
                }
            });

            // 8. Create DSR record for compliance tracking
            await tx.dataSubjectRequest.create({
                data: {
                    type: "ERASURE",
                    status: "COMPLETED",
                    jurisdiction: null,
                    requestorEmail: deletedEmail,
                    requestorUserId: userId,
                    notes: "Self-service account deletion via API",
                    completedAt: new Date()
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[User Account Deletion] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete account"
            },
            { status: 500 }
        );
    }
}
