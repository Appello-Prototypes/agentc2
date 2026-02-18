import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "federation:list");

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const orgId = url.searchParams.get("orgId") || undefined;
        const agentSlug = url.searchParams.get("agentSlug") || undefined;
        const from = url.searchParams.get("from") || undefined;
        const to = url.searchParams.get("to") || undefined;
        const policyResult = url.searchParams.get("policyResult") || undefined;

        const where: Prisma.FederationMessageWhereInput = {};

        if (orgId) {
            where.OR = [{ sourceOrgId: orgId }, { targetOrgId: orgId }];
        }
        if (agentSlug) {
            const agentFilter = [{ sourceAgentSlug: agentSlug }, { targetAgentSlug: agentSlug }];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: agentFilter }];
                delete where.OR;
            } else {
                where.OR = agentFilter;
            }
        }
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }
        if (policyResult) {
            where.policyResult = policyResult;
        }

        const [messages, total] = await Promise.all([
            prisma.federationMessage.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                include: {
                    agreement: {
                        include: {
                            initiatorOrg: { select: { id: true, name: true, slug: true } },
                            responderOrg: { select: { id: true, name: true, slug: true } }
                        }
                    }
                }
            }),
            prisma.federationMessage.count({ where })
        ]);

        const data = messages.map((msg) => ({
            id: msg.id,
            agreementId: msg.agreementId,
            conversationId: msg.conversationId,
            direction: msg.direction,
            sourceOrgId: msg.sourceOrgId,
            sourceAgentSlug: msg.sourceAgentSlug,
            targetOrgId: msg.targetOrgId,
            targetAgentSlug: msg.targetAgentSlug,
            latencyMs: msg.latencyMs,
            inputTokens: msg.inputTokens,
            outputTokens: msg.outputTokens,
            costUsd: msg.costUsd,
            policyResult: msg.policyResult,
            runId: msg.runId,
            createdAt: msg.createdAt,
            agreement: {
                initiatorOrg: msg.agreement.initiatorOrg,
                responderOrg: msg.agreement.responderOrg
            }
        }));

        return NextResponse.json({ messages: data, total, limit, offset });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Federation Messages] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
