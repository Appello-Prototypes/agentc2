/**
 * Platform-wide append-only audit logging.
 *
 * Used by federation, agent invocations, tool executions, admin actions,
 * and any security-relevant event across the platform.
 */

import { prisma } from "@repo/database";

export interface AuditEntry {
    organizationId: string;
    actorType: "user" | "agent" | "system" | "federation_agent";
    actorId: string;
    actorOrgId?: string;
    action: string;
    resource: string;
    outcome: "success" | "denied" | "error";
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Write an audit log entry. Fire-and-forget by default to avoid
 * slowing down the hot path.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<string> {
    const record = await prisma.federationAuditLog.create({
        data: {
            organizationId: entry.organizationId,
            actorType: entry.actorType,
            actorId: entry.actorId,
            actorOrgId: entry.actorOrgId,
            action: entry.action,
            resource: entry.resource,
            outcome: entry.outcome,
            metadata: entry.metadata
                ? (entry.metadata as Record<string, string | number | boolean | null>)
                : undefined,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent
        }
    });
    return record.id;
}

/**
 * Non-blocking audit log write. Catches and logs errors without throwing.
 */
export function writeAuditLogAsync(entry: AuditEntry): void {
    writeAuditLog(entry).catch((error) => {
        console.error("[Audit] Failed to write audit log:", error);
    });
}

/**
 * Write audit entries for both orgs in a federation interaction.
 */
export function writeFederationAuditPair(
    sourceOrgId: string,
    targetOrgId: string,
    action: string,
    resource: string,
    outcome: "success" | "denied" | "error",
    metadata?: Record<string, unknown>
): void {
    writeAuditLogAsync({
        organizationId: sourceOrgId,
        actorType: "federation_agent",
        actorId: `org:${sourceOrgId}`,
        actorOrgId: sourceOrgId,
        action,
        resource,
        outcome,
        metadata
    });
    writeAuditLogAsync({
        organizationId: targetOrgId,
        actorType: "federation_agent",
        actorId: `org:${sourceOrgId}`,
        actorOrgId: sourceOrgId,
        action,
        resource,
        outcome,
        metadata
    });
}

export interface AuditQueryOptions {
    organizationId: string;
    action?: string;
    actorId?: string;
    outcome?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}

/**
 * Query audit logs for an organization.
 */
export async function queryAuditLogs(options: AuditQueryOptions) {
    const { organizationId, action, actorId, outcome, from, to, limit = 50, offset = 0 } = options;

    const where: Record<string, unknown> = { organizationId };
    if (action) where.action = { startsWith: action };
    if (actorId) where.actorId = actorId;
    if (outcome) where.outcome = outcome;
    if (from || to) {
        const createdAt: Record<string, Date> = {};
        if (from) createdAt.gte = from;
        if (to) createdAt.lte = to;
        where.createdAt = createdAt;
    }

    const [entries, total] = await Promise.all([
        prisma.federationAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset
        }),
        prisma.federationAuditLog.count({ where })
    ]);

    return { entries, total };
}
