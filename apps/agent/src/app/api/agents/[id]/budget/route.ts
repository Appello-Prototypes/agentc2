import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/budget
 *
 * Get budget policy for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get budget policy
        const budgetPolicy = await prisma.budgetPolicy.findUnique({
            where: { agentId: agent.id }
        });

        // Get current month's cost
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const costEvents = await prisma.costEvent.findMany({
            where: {
                agentId: agent.id,
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
        const body = await request.json();

        const { enabled, monthlyLimitUsd, alertAtPct, hardLimit } = body;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Upsert budget policy
        const budgetPolicy = await prisma.budgetPolicy.upsert({
            where: { agentId: agent.id },
            update: {
                enabled: enabled ?? undefined,
                monthlyLimitUsd: monthlyLimitUsd ?? undefined,
                alertAtPct: alertAtPct ?? undefined,
                hardLimit: hardLimit ?? undefined
            },
            create: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                enabled: enabled ?? false,
                monthlyLimitUsd: monthlyLimitUsd ?? null,
                alertAtPct: alertAtPct ?? 80,
                hardLimit: hardLimit ?? false
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                tenantId: agent.tenantId,
                action: "BUDGET_UPDATE",
                entityType: "BudgetPolicy",
                entityId: budgetPolicy.id,
                metadata: {
                    agentId: agent.id,
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
