/**
 * Admin Audit Log Service
 *
 * Provides audit logging for all admin portal actions.
 * Separate from the tenant-facing audit log in apps/agent.
 * Includes IP address, user agent, and before/after state diffs.
 *
 * Usage:
 * ```typescript
 * await adminAudit.log({
 *   adminUserId: admin.id,
 *   action: "TENANT_SUSPEND",
 *   entityType: "Organization",
 *   entityId: orgId,
 *   beforeJson: { status: "active" },
 *   afterJson: { status: "suspended" },
 *   ipAddress: "1.2.3.4",
 *   userAgent: "Mozilla/5.0 ...",
 *   metadata: { reason: "Non-payment" },
 * });
 * ```
 */

import { prisma, Prisma } from "@repo/database";

export type AdminAuditAction =
    // Tenant lifecycle
    | "TENANT_CREATE"
    | "TENANT_UPDATE"
    | "TENANT_SUSPEND"
    | "TENANT_REACTIVATE"
    | "TENANT_DELETE_REQUEST"
    | "TENANT_PURGE"
    // User management
    | "USER_RESET_PASSWORD"
    | "USER_FORCE_LOGOUT"
    | "USER_IMPERSONATE_START"
    | "USER_IMPERSONATE_END"
    // Feature flags
    | "FLAG_CREATE"
    | "FLAG_UPDATE"
    | "FLAG_DELETE"
    | "FLAG_OVERRIDE_SET"
    | "FLAG_OVERRIDE_REMOVE"
    // Billing
    | "PLAN_CREATE"
    | "PLAN_UPDATE"
    | "SUBSCRIPTION_CREATE"
    | "SUBSCRIPTION_UPDATE"
    | "SUBSCRIPTION_CANCEL"
    // Admin users
    | "ADMIN_USER_CREATE"
    | "ADMIN_USER_UPDATE"
    | "ADMIN_USER_DEACTIVATE"
    | "ADMIN_LOGIN"
    | "ADMIN_LOGOUT";

export interface AdminAuditLogOptions {
    adminUserId: string;
    action: AdminAuditAction;
    entityType: string;
    entityId: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    ipAddress: string;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
}

/**
 * Create an admin audit log entry.
 * Never throws - audit logging should not block operations.
 */
export async function createAdminAuditLog(options: AdminAuditLogOptions): Promise<void> {
    try {
        await prisma.adminAuditLog.create({
            data: {
                adminUserId: options.adminUserId,
                action: options.action,
                entityType: options.entityType,
                entityId: options.entityId,
                beforeJson: options.beforeJson as Prisma.InputJsonValue,
                afterJson: options.afterJson as Prisma.InputJsonValue,
                ipAddress: options.ipAddress,
                userAgent: options.userAgent?.substring(0, 512),
                metadata: options.metadata as Prisma.InputJsonValue
            }
        });
    } catch (error) {
        console.error("[AdminAuditLog] Failed to create audit log:", error);
    }
}

/**
 * Query admin audit logs with filtering and cursor pagination.
 */
export async function queryAdminAuditLogs(options: {
    adminUserId?: string;
    action?: AdminAuditAction;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}) {
    const where: Prisma.AdminAuditLogWhereInput = {};

    if (options.adminUserId) where.adminUserId = options.adminUserId;
    if (options.action) where.action = options.action;
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;

    if (options.from || options.to) {
        where.createdAt = {};
        if (options.from) where.createdAt.gte = options.from;
        if (options.to) where.createdAt.lte = options.to;
    }

    if (options.cursor) {
        where.id = { lt: options.cursor };
    }

    const limit = options.limit || 50;
    const logs = await prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        include: {
            adminUser: {
                select: { name: true, email: true, role: true }
            }
        }
    });

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    return {
        logs,
        hasMore,
        nextCursor: hasMore ? logs[logs.length - 1]?.id : null
    };
}

/**
 * Convenience helper to extract IP and user agent from a request.
 */
export function getRequestContext(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        userAgent: request.headers.get("user-agent")
    };
}

/**
 * Convenience object with shorthand methods.
 */
export const adminAudit = {
    log: createAdminAuditLog,
    query: queryAdminAuditLogs,

    async tenantSuspend(adminUserId: string, orgId: string, reason: string, request: Request) {
        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId,
            action: "TENANT_SUSPEND",
            entityType: "Organization",
            entityId: orgId,
            afterJson: { status: "suspended", reason },
            ipAddress,
            userAgent,
            metadata: { reason }
        });
    },

    async tenantReactivate(adminUserId: string, orgId: string, request: Request) {
        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId,
            action: "TENANT_REACTIVATE",
            entityType: "Organization",
            entityId: orgId,
            afterJson: { status: "active" },
            ipAddress,
            userAgent
        });
    },

    async userImpersonateStart(
        adminUserId: string,
        targetUserId: string,
        orgId: string,
        reason: string,
        request: Request
    ) {
        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId,
            action: "USER_IMPERSONATE_START",
            entityType: "User",
            entityId: targetUserId,
            ipAddress,
            userAgent,
            metadata: { orgId, reason }
        });
    },

    async flagToggle(
        adminUserId: string,
        flagId: string,
        before: unknown,
        after: unknown,
        request: Request
    ) {
        const { ipAddress, userAgent } = getRequestContext(request);
        await createAdminAuditLog({
            adminUserId,
            action: "FLAG_UPDATE",
            entityType: "FeatureFlag",
            entityId: flagId,
            beforeJson: before,
            afterJson: after,
            ipAddress,
            userAgent
        });
    }
};
