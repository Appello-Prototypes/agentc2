/**
 * Audit Log Service
 *
 * Provides centralized audit logging for all write operations
 * and sensitive reads in the agent platform.
 *
 * Usage:
 * ```typescript
 * await auditLog.create({
 *   action: "AGENT_CREATE",
 *   entityType: "Agent",
 *   entityId: agent.id,
 *   actorId: userId,
 *   tenantId: tenantId,
 *   metadata: { name: agent.name, slug: agent.slug }
 * });
 * ```
 */

import { prisma, Prisma } from "@repo/database";

/**
 * Audit action types
 */
export type AuditAction =
    // Agent Registry
    | "AGENT_CREATE"
    | "AGENT_UPDATE"
    | "AGENT_DELETE"
    | "AGENT_ACTIVATE"
    | "AGENT_DEACTIVATE"
    // Agent Versions
    | "VERSION_CREATE"
    | "VERSION_ROLLBACK"
    // Configuration
    | "CONFIG_CHANGE"
    | "TOOL_ATTACH"
    | "TOOL_DETACH"
    | "SCORER_CHANGE"
    // Schedules & Triggers
    | "SCHEDULE_CREATE"
    | "SCHEDULE_UPDATE"
    | "SCHEDULE_DELETE"
    | "TRIGGER_CREATE"
    | "TRIGGER_UPDATE"
    | "TRIGGER_DELETE"
    // Credentials
    | "CREDENTIAL_CREATE"
    | "CREDENTIAL_UPDATE"
    | "CREDENTIAL_DELETE"
    | "CREDENTIAL_ACCESS"
    // Integrations
    | "INTEGRATION_CREATE"
    | "INTEGRATION_UPDATE"
    | "INTEGRATION_DELETE"
    | "WEBHOOK_CREATE"
    // Policies
    | "BUDGET_POLICY_UPDATE"
    | "GUARDRAIL_POLICY_UPDATE"
    | "LEARNING_POLICY_UPDATE"
    // Invocations
    | "AGENT_INVOKE"
    | "AGENT_INVOKE_ASYNC"
    // Organization
    | "ORG_CREATE"
    | "ORG_UPDATE"
    | "ORG_DELETE"
    | "WORKSPACE_CREATE"
    | "WORKSPACE_UPDATE"
    | "WORKSPACE_DELETE"
    | "MEMBERSHIP_CREATE"
    | "MEMBERSHIP_UPDATE"
    | "MEMBERSHIP_DELETE"
    // Member Management
    | "MEMBER_ROLE_UPDATE"
    | "MEMBER_PERMISSIONS_UPDATE"
    | "MEMBER_REMOVE"
    // Invites
    | "INVITE_CREATE"
    | "INVITE_REVOKE"
    // Domains
    | "DOMAIN_ADD"
    | "DOMAIN_REMOVE"
    // Authentication
    | "AUTH_LOGIN_SUCCESS"
    | "AUTH_LOGIN_FAILURE"
    | "AUTH_LOGOUT"
    | "AUTH_SESSION_CREATED"
    // Data Access
    | "DATA_ACCESS";

/**
 * Audit log entry options
 */
export interface AuditLogOptions {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId?: string;
    userId?: string; // Alias for actorId for convenience
    tenantId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(options: AuditLogOptions): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action: options.action,
                entityType: options.entityType,
                entityId: options.entityId,
                actorId: options.actorId || options.userId,
                tenantId: options.tenantId,
                metadata: options.metadata as Prisma.InputJsonValue
            }
        });
    } catch (error) {
        // Log but don't throw - audit logging should not block operations
        console.error("[AuditLog] Failed to create audit log:", error);
    }
}

/**
 * Convenience methods for common audit actions
 */
export const auditLog = {
    create: createAuditLog,

    // Agent Registry
    async agentCreate(
        agentId: string,
        actorId?: string,
        tenantId?: string,
        metadata?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "AGENT_CREATE",
            entityType: "Agent",
            entityId: agentId,
            actorId,
            tenantId,
            metadata
        });
    },

    async agentUpdate(
        agentId: string,
        actorId?: string,
        tenantId?: string,
        changes?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "AGENT_UPDATE",
            entityType: "Agent",
            entityId: agentId,
            actorId,
            tenantId,
            metadata: { changes }
        });
    },

    async agentDelete(agentId: string, actorId?: string, tenantId?: string) {
        await createAuditLog({
            action: "AGENT_DELETE",
            entityType: "Agent",
            entityId: agentId,
            actorId,
            tenantId
        });
    },

    // Version Management
    async versionCreate(
        versionId: string,
        agentId: string,
        version: number,
        actorId?: string,
        tenantId?: string
    ) {
        await createAuditLog({
            action: "VERSION_CREATE",
            entityType: "AgentVersion",
            entityId: versionId,
            actorId,
            tenantId,
            metadata: { agentId, version }
        });
    },

    async versionRollback(
        agentId: string,
        fromVersion: number,
        toVersion: number,
        actorId?: string,
        tenantId?: string
    ) {
        await createAuditLog({
            action: "VERSION_ROLLBACK",
            entityType: "Agent",
            entityId: agentId,
            actorId,
            tenantId,
            metadata: { fromVersion, toVersion }
        });
    },

    // Tool Management
    async toolAttach(agentId: string, toolId: string, actorId?: string, tenantId?: string) {
        await createAuditLog({
            action: "TOOL_ATTACH",
            entityType: "AgentTool",
            entityId: `${agentId}:${toolId}`,
            actorId,
            tenantId,
            metadata: { agentId, toolId }
        });
    },

    async toolDetach(agentId: string, toolId: string, actorId?: string, tenantId?: string) {
        await createAuditLog({
            action: "TOOL_DETACH",
            entityType: "AgentTool",
            entityId: `${agentId}:${toolId}`,
            actorId,
            tenantId,
            metadata: { agentId, toolId }
        });
    },

    // Credentials
    async credentialAccess(
        credentialId: string,
        toolId: string,
        actorId?: string,
        tenantId?: string
    ) {
        await createAuditLog({
            action: "CREDENTIAL_ACCESS",
            entityType: "ToolCredential",
            entityId: credentialId,
            actorId,
            tenantId,
            metadata: { toolId }
        });
    },

    // Integrations
    async integrationCreate(
        connectionId: string,
        actorId?: string,
        tenantId?: string,
        metadata?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "INTEGRATION_CREATE",
            entityType: "IntegrationConnection",
            entityId: connectionId,
            actorId,
            tenantId,
            metadata
        });
    },

    async integrationUpdate(
        connectionId: string,
        actorId?: string,
        tenantId?: string,
        changes?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "INTEGRATION_UPDATE",
            entityType: "IntegrationConnection",
            entityId: connectionId,
            actorId,
            tenantId,
            metadata: { changes }
        });
    },

    async integrationDelete(
        connectionId: string,
        actorId?: string,
        tenantId?: string,
        metadata?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "INTEGRATION_DELETE",
            entityType: "IntegrationConnection",
            entityId: connectionId,
            actorId,
            tenantId,
            metadata
        });
    },

    async webhookCreate(
        triggerId: string,
        actorId?: string,
        tenantId?: string,
        metadata?: Record<string, unknown>
    ) {
        await createAuditLog({
            action: "WEBHOOK_CREATE",
            entityType: "AgentTrigger",
            entityId: triggerId,
            actorId,
            tenantId,
            metadata
        });
    },

    // Invocations
    async agentInvoke(
        runId: string,
        agentId: string,
        source: string,
        actorId?: string,
        tenantId?: string
    ) {
        await createAuditLog({
            action: "AGENT_INVOKE",
            entityType: "AgentRun",
            entityId: runId,
            actorId,
            tenantId,
            metadata: { agentId, source }
        });
    },

    // Policies
    async policyUpdate(
        policyType: "budget" | "guardrail" | "learning",
        agentId: string,
        actorId?: string,
        tenantId?: string,
        changes?: Record<string, unknown>
    ) {
        const actionMap = {
            budget: "BUDGET_POLICY_UPDATE",
            guardrail: "GUARDRAIL_POLICY_UPDATE",
            learning: "LEARNING_POLICY_UPDATE"
        } as const;

        await createAuditLog({
            action: actionMap[policyType],
            entityType: `${policyType.charAt(0).toUpperCase() + policyType.slice(1)}Policy`,
            entityId: agentId,
            actorId,
            tenantId,
            metadata: { changes }
        });
    }
};

/**
 * Query audit logs with filtering
 */
export async function queryAuditLogs(options: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    tenantId?: string;
    action?: AuditAction;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}) {
    const where: Prisma.AuditLogWhereInput = {};

    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.actorId) where.actorId = options.actorId;
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.action) where.action = options.action;

    if (options.from || options.to) {
        where.createdAt = {};
        if (options.from) where.createdAt.gte = options.from;
        if (options.to) where.createdAt.lte = options.to;
    }

    if (options.cursor) {
        where.id = { lt: options.cursor };
    }

    const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: (options.limit || 50) + 1
    });

    const hasMore = logs.length > (options.limit || 50);
    if (hasMore) logs.pop();

    return {
        logs,
        hasMore,
        nextCursor: hasMore ? logs[logs.length - 1]?.id : null
    };
}
