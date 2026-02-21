import { writeAuditLog, type AuditEntry } from "../audit/index";
import { prisma } from "@repo/database";

export type FinancialActionType =
    | "financial.payment_initiated"
    | "financial.wallet_transfer"
    | "financial.purchase_completed"
    | "financial.checkout_created"
    | "financial.blocked"
    | "financial.approval_requested"
    | "financial.approval_granted"
    | "financial.approval_denied";

/**
 * Log a financial action to the audit trail.
 * Thin wrapper around writeAuditLog with financial-specific metadata.
 */
export async function logFinancialAction(params: {
    organizationId: string;
    agentId: string;
    action: FinancialActionType;
    toolId: string;
    amountUsd?: number;
    currency?: string;
    recipient?: string;
    outcome: "success" | "denied" | "error";
    metadata?: Record<string, unknown>;
}): Promise<string> {
    const entry: AuditEntry = {
        organizationId: params.organizationId,
        actorType: "agent",
        actorId: params.agentId,
        action: params.action,
        resource: params.toolId,
        outcome: params.outcome,
        metadata: {
            toolId: params.toolId,
            amountUsd: params.amountUsd,
            currency: params.currency ?? "USD",
            recipient: params.recipient,
            ...params.metadata
        }
    };

    return writeAuditLog(entry);
}

export async function getFinancialAuditLog(
    agentId: string,
    filters?: { action?: string; limit?: number }
) {
    return prisma.federationAuditLog.findMany({
        where: {
            actorId: agentId,
            action: filters?.action ? { startsWith: filters.action } : { startsWith: "financial." }
        },
        orderBy: { createdAt: "desc" },
        take: filters?.limit ?? 50
    });
}

export async function getAgentFinancialSummary(agentId: string) {
    const logs = await prisma.federationAuditLog.findMany({
        where: {
            actorId: agentId,
            action: { startsWith: "financial." }
        },
        select: {
            action: true,
            outcome: true,
            metadata: true
        }
    });

    const summary: Record<string, { count: number; totalUsd: number }> = {};
    for (const log of logs) {
        const action = log.action;
        if (!summary[action]) {
            summary[action] = { count: 0, totalUsd: 0 };
        }
        summary[action].count++;
        const meta = log.metadata as Record<string, unknown> | null;
        if (meta?.amountUsd && typeof meta.amountUsd === "number") {
            summary[action].totalUsd += meta.amountUsd;
        }
    }

    return summary;
}
