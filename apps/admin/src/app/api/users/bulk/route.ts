import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import type { AdminAction } from "@repo/admin-auth";
import { adminAudit, getRequestContext, type AdminAuditAction } from "@/lib/admin-audit";

type BulkAction = "freeze" | "activate" | "delete" | "verify_email" | "unverify_email";

type StatusAction = {
    kind: "status";
    targetStatus: string;
    auditAction: AdminAuditAction;
    permission: AdminAction;
    revokeSessionsOnUpdate: boolean;
};

type EmailVerifyAction = {
    kind: "email_verify";
    targetValue: boolean;
    auditAction: AdminAuditAction;
    permission: AdminAction;
};

type ActionConfig = StatusAction | EmailVerifyAction;

const ACTION_CONFIG: Record<BulkAction, ActionConfig> = {
    freeze: {
        kind: "status",
        targetStatus: "frozen",
        auditAction: "USER_BULK_FREEZE",
        permission: "user:freeze",
        revokeSessionsOnUpdate: true
    },
    activate: {
        kind: "status",
        targetStatus: "active",
        auditAction: "USER_BULK_ACTIVATE",
        permission: "user:activate",
        revokeSessionsOnUpdate: false
    },
    delete: {
        kind: "status",
        targetStatus: "deleted",
        auditAction: "USER_BULK_DELETE",
        permission: "user:delete",
        revokeSessionsOnUpdate: true
    },
    verify_email: {
        kind: "email_verify",
        targetValue: true,
        auditAction: "USER_BULK_VERIFY_EMAIL",
        permission: "user:verify_email"
    },
    unverify_email: {
        kind: "email_verify",
        targetValue: false,
        auditAction: "USER_BULK_UNVERIFY_EMAIL",
        permission: "user:verify_email"
    }
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userIds, action, reason } = body as {
            userIds: string[];
            action: BulkAction;
            reason?: string;
        };

        if (!userIds?.length) {
            return NextResponse.json({ error: "No user IDs provided" }, { status: 400 });
        }
        if (!action || !ACTION_CONFIG[action]) {
            return NextResponse.json(
                {
                    error: "Invalid action. Must be: freeze, activate, delete, verify_email, or unverify_email"
                },
                { status: 400 }
            );
        }

        const config = ACTION_CONFIG[action];
        const admin = await requireAdminAction(request, config.permission);

        if (config.kind === "email_verify") {
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, emailVerified: true }
            });

            const eligible = users.filter((u) => u.emailVerified !== config.targetValue);
            if (eligible.length === 0) {
                return NextResponse.json(
                    {
                        error: `All selected users already have emailVerified = ${config.targetValue}`
                    },
                    { status: 400 }
                );
            }

            const eligibleIds = eligible.map((u) => u.id);

            const result = await prisma.user.updateMany({
                where: { id: { in: eligibleIds } },
                data: { emailVerified: config.targetValue }
            });

            const { ipAddress, userAgent } = getRequestContext(request);
            await adminAudit.log({
                adminUserId: admin.adminUserId,
                action: config.auditAction,
                entityType: "User",
                entityId: "bulk",
                afterJson: { emailVerified: config.targetValue },
                ipAddress,
                userAgent,
                metadata: {
                    userIds: eligibleIds,
                    count: result.count,
                    reason: reason || `Bulk ${action} by admin`
                }
            });

            return NextResponse.json({
                success: true,
                affected: result.count,
                total: userIds.length,
                skipped: userIds.length - eligible.length
            });
        }

        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, status: true }
        });

        const eligible = users.filter((u) => u.status !== config.targetStatus);
        if (eligible.length === 0) {
            return NextResponse.json(
                { error: `All selected users are already ${config.targetStatus}` },
                { status: 400 }
            );
        }

        const eligibleIds = eligible.map((u) => u.id);

        const result = await prisma.user.updateMany({
            where: { id: { in: eligibleIds } },
            data: { status: config.targetStatus }
        });

        if (config.revokeSessionsOnUpdate) {
            await prisma.session.deleteMany({
                where: { userId: { in: eligibleIds } }
            });
        }

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: config.auditAction,
            entityType: "User",
            entityId: "bulk",
            afterJson: { status: config.targetStatus },
            ipAddress,
            userAgent,
            metadata: {
                userIds: eligibleIds,
                count: result.count,
                reason: reason || `Bulk ${action} by admin`
            }
        });

        return NextResponse.json({
            success: true,
            affected: result.count,
            total: userIds.length,
            skipped: userIds.length - eligible.length
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
