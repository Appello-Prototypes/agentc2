import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/costs/summary
 *
 * Get cost summary for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        // Default to last 30 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

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

        // Get cost events
        const costEvents = await prisma.costEvent.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Calculate totals
        const totalCostUsd = costEvents.reduce((sum, e) => sum + (e.costUsd || 0), 0);
        const totalPromptTokens = costEvents.reduce((sum, e) => sum + (e.promptTokens || 0), 0);
        const totalCompletionTokens = costEvents.reduce(
            (sum, e) => sum + (e.completionTokens || 0),
            0
        );
        const totalTokens = costEvents.reduce((sum, e) => sum + (e.totalTokens || 0), 0);

        // Group by model
        const byModel = new Map<string, { cost: number; tokens: number; runs: number }>();
        for (const event of costEvents) {
            const key = `${event.provider}/${event.modelName}`;
            const existing = byModel.get(key) || { cost: 0, tokens: 0, runs: 0 };
            byModel.set(key, {
                cost: existing.cost + (event.costUsd || 0),
                tokens: existing.tokens + (event.totalTokens || 0),
                runs: existing.runs + 1
            });
        }

        // Group by day
        const byDay = new Map<string, number>();
        for (const event of costEvents) {
            const day = event.createdAt.toISOString().split("T")[0];
            byDay.set(day, (byDay.get(day) || 0) + (event.costUsd || 0));
        }

        // Get budget for context
        const budget = await prisma.budgetPolicy.findUnique({
            where: { agentId: agent.id }
        });

        return NextResponse.json({
            success: true,
            summary: {
                totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
                totalTokens,
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                runCount: costEvents.length
            },
            tokenBreakdown: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalTokens,
                promptPercentage:
                    totalTokens > 0 ? Math.round((totalPromptTokens / totalTokens) * 100) : 0
            },
            byModel: Array.from(byModel.entries()).map(([model, data]) => ({
                model,
                costUsd: Math.round(data.cost * 10000) / 10000,
                tokens: data.tokens,
                runs: data.runs,
                percentage: totalCostUsd > 0 ? Math.round((data.cost / totalCostUsd) * 100) : 0
            })),
            byDay: Array.from(byDay.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, cost]) => ({
                    date,
                    costUsd: Math.round(cost * 10000) / 10000
                })),
            budget: budget
                ? {
                      enabled: budget.enabled,
                      monthlyLimitUsd: budget.monthlyLimitUsd,
                      currentUsagePercent: budget.monthlyLimitUsd
                          ? Math.round((totalCostUsd / budget.monthlyLimitUsd) * 100)
                          : null
                  }
                : null,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Agent Costs Summary] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get costs"
            },
            { status: 500 }
        );
    }
}
