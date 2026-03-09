import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * GET /api/agents/[id]/budget
 *
 * Get budget policy for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        // Get budget policy
        const budgetPolicy = await prisma.budgetPolicy.findUnique({
            where: { agentId }
        });

        // Get current month's cost
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const costEvents = await prisma.costEvent.findMany({
            where: {
                agentId,
                createdAt: { gte: startOfMonth }
            },
            select: { costUsd: true }
        });

        const currentMonthCost = costEvents.reduce((sum, e) => sum + (e.costUsd || 0), 0);

        return NextResponse.json({
            success: true,
            budgetPolicy: budgetPolicy
                ? {
                      id: budgetPolicy.id,
                      enabled: budgetPolicy.enabled,
                      monthlyLimitUsd: budgetPolicy.monthlyLimitUsd,
                      alertAtPct: budgetPolicy.alertAtPct,
                      hardLimit: budgetPolicy.hardLimit,
                      createdAt: budgetPolicy.createdAt,
                      updatedAt: budgetPolicy.updatedAt
                  }
                : null,
            usage: {
                currentMonthCost: Math.round(currentMonthCost * 10000) / 10000,
                percentUsed: budgetPolicy?.monthlyLimitUsd
                    ? Math.round((currentMonthCost / budgetPolicy.monthlyLimitUsd) * 10000) / 100
                    : null,
                period: {
                    from: startOfMonth.toISOString(),
                    to: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error("[Agent Budget Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get budget"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/agents/[id]/budget
 *
 * Update budget policy for an agent
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const body = await request.json();

        const { enabled, monthlyLimitUsd, alertAtPct, hardLimit } = body;

        // If setting a budget amount, default hardLimit to true unless explicitly set to false
        const existingPolicy = await prisma.budgetPolicy.findUnique({
            where: { agentId }
        });
        const resolvedHardLimit =
            hardLimit !== undefined ? hardLimit : monthlyLimitUsd !== undefined ? true : undefined;

        // Upsert budget policy
        const budgetPolicy = await prisma.budgetPolicy.upsert({
            where: { agentId },
            update: {
                enabled: enabled ?? undefined,
                monthlyLimitUsd: monthlyLimitUsd ?? undefined,
                alertAtPct: alertAtPct ?? undefined,
                hardLimit: resolvedHardLimit ?? undefined
            },
            create: {
                agentId,
                enabled: enabled ?? false,
                monthlyLimitUsd: monthlyLimitUsd ?? null,
                alertAtPct: alertAtPct ?? 80,
                hardLimit: resolvedHardLimit ?? existingPolicy?.hardLimit ?? true
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "BUDGET_UPDATE",
                entityType: "BudgetPolicy",
                entityId: budgetPolicy.id,
                metadata: {
                    agentId,
                    enabled,
                    monthlyLimitUsd,
                    alertAtPct,
                    hardLimit
                }
            }
        });

        return NextResponse.json({
            success: true,
            budgetPolicy: {
                id: budgetPolicy.id,
                enabled: budgetPolicy.enabled,
                monthlyLimitUsd: budgetPolicy.monthlyLimitUsd,
                alertAtPct: budgetPolicy.alertAtPct,
                hardLimit: budgetPolicy.hardLimit,
                createdAt: budgetPolicy.createdAt,
                updatedAt: budgetPolicy.updatedAt
            }
        });
    } catch (error) {
        console.error("[Agent Budget Update] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update budget"
            },
            { status: 500 }
        );
    }
}
