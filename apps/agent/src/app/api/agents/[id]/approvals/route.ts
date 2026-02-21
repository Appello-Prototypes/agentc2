import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAgentAccess } from "@/lib/authz";
import {
    getFinancialApprovals,
    requestFinancialApproval
} from "@repo/agentc2/security/financial-approvals";

/**
 * GET /api/agents/[id]/approvals
 *
 * List financial approval requests for an agent.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        const url = new URL(request.url);
        const status = url.searchParams.get("status") ?? undefined;

        const approvals = await getFinancialApprovals(accessResult.agentId!, status);
        return NextResponse.json({ approvals });
    } catch (error) {
        console.error("[approvals] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/approvals
 *
 * Create a financial approval request.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        const body = await request.json();
        const approval = await requestFinancialApproval({
            organizationId: authResult.context.organizationId,
            agentId: accessResult.agentId!,
            toolId: body.toolId,
            amountUsd: body.amountUsd,
            currency: body.currency,
            description: body.description,
            requestedBy: authResult.context.userId
        });

        return NextResponse.json({ approval }, { status: 201 });
    } catch (error) {
        console.error("[approvals] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
