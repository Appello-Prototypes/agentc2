import { prisma } from "@repo/database";

/**
 * Request approval for a financial action. Thin wrapper around
 * the existing ApprovalRequest system with financial-specific metadata.
 *
 * In the full integration, this calls createApprovalRequest() from
 * apps/agent/src/lib/approvals.ts which handles Slack notification
 * and audit logging.
 */
export async function requestFinancialApproval(params: {
    organizationId: string;
    workspaceId?: string;
    agentId: string;
    toolId: string;
    amountUsd: number;
    currency?: string;
    description: string;
    requestedBy?: string;
}) {
    return prisma.approvalRequest.create({
        data: {
            organizationId: params.organizationId,
            workspaceId: params.workspaceId,
            agentId: params.agentId,
            sourceType: "financial_action",
            sourceId: params.toolId,
            requestedBy: params.requestedBy,
            payloadJson: {
                toolId: params.toolId,
                amountUsd: params.amountUsd,
                currency: params.currency ?? "USD",
                description: params.description
            },
            metadata: {
                type: "financial_action",
                title: `Financial approval: ${params.toolId}`,
                summary: params.description,
                amountUsd: params.amountUsd,
                toolId: params.toolId
            }
        }
    });
}

export async function getFinancialApprovals(agentId: string, status?: string) {
    return prisma.approvalRequest.findMany({
        where: {
            agentId,
            sourceType: "financial_action",
            ...(status ? { status } : {})
        },
        orderBy: { createdAt: "desc" }
    });
}

const FINANCIAL_TOOL_PATTERNS = [
    /^stripe-acs-/,
    /^coinbase\./,
    /payment/i,
    /transfer/i,
    /checkout/i,
    /purchase/i
];

export function isFinancialTool(toolId: string): boolean {
    return FINANCIAL_TOOL_PATTERNS.some((p) => p.test(toolId));
}
