import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { calculateCostBreakdown, calculateCost } from "@/lib/cost-calculator";

/**
 * GET /api/agents/[id]/costs/summary
 *
 * Get cost summary for an agent
 * Uses AgentRun data directly to ensure all runs are included,
 * calculating costs from token usage when costUsd is not stored.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const source = searchParams.get("source"); // "production", "simulation", "all"

        // If no dates provided, show all time (no date filter)
        // Otherwise use the provided range
        const startDate = from ? new Date(from) : null;
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

        // Build source filter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let sourceFilter: any = undefined;
        if (source === "production") {
            sourceFilter = { source: { not: "simulation" } };
        } else if (source === "simulation") {
            sourceFilter = { source: "simulation" };
        }
        // "all" or undefined means no filter

        // Get runs directly (not cost events) to ensure all runs are included
        const runs = await prisma.agentRun.findMany({
            where: {
                agentId: agent.id,
                status: "COMPLETED",
                // Only add date filter if dates are provided
                ...(startDate || endDate
                    ? {
                          createdAt: {
                              ...(startDate && { gte: startDate }),
                              ...(endDate && { lte: endDate })
                          }
                      }
                    : {}),
                ...sourceFilter
            },
            select: {
                id: true,
                modelProvider: true,
                modelName: true,
                promptTokens: true,
                completionTokens: true,
                totalTokens: true,
                costUsd: true,
                createdAt: true
            },
            orderBy: { createdAt: "desc" }
        });

        // Calculate totals with cost calculation for runs missing costUsd
        let totalCostUsd = 0;
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalTokens = 0;
        let promptCostUsd = 0;
        let completionCostUsd = 0;

        // Group by model and day, and collect per-run costs
        const byModel = new Map<string, { cost: number; tokens: number; runs: number }>();
        const byDay = new Map<string, number>();
        const byRun: Array<{ id: string; costUsd: number; createdAt: string }> = [];

        for (const run of runs) {
            const promptToks = run.promptTokens || 0;
            const completionToks = run.completionTokens || 0;
            const runTotalTokens = run.totalTokens || promptToks + completionToks;

            totalPromptTokens += promptToks;
            totalCompletionTokens += completionToks;
            totalTokens += runTotalTokens;

            // Calculate cost - use stored costUsd if available, otherwise calculate
            let runCost = run.costUsd || 0;
            if (!run.costUsd && run.modelName && (promptToks > 0 || completionToks > 0)) {
                runCost = calculateCost(
                    run.modelName,
                    run.modelProvider || undefined,
                    promptToks,
                    completionToks
                );
            }
            totalCostUsd += runCost;

            // Collect per-run cost data
            byRun.push({
                id: run.id,
                costUsd: Math.round(runCost * 1000000) / 1000000,
                createdAt: run.createdAt.toISOString()
            });

            // Calculate breakdown
            const breakdown = calculateCostBreakdown(
                run.modelName || "unknown",
                run.modelProvider || undefined,
                promptToks,
                completionToks
            );
            promptCostUsd += breakdown.inputCost;
            completionCostUsd += breakdown.outputCost;

            // Group by model
            const modelKey = `${run.modelProvider || "unknown"}/${run.modelName || "unknown"}`;
            const existing = byModel.get(modelKey) || { cost: 0, tokens: 0, runs: 0 };
            byModel.set(modelKey, {
                cost: existing.cost + runCost,
                tokens: existing.tokens + runTotalTokens,
                runs: existing.runs + 1
            });

            // Group by day
            const day = run.createdAt.toISOString().split("T")[0];
            byDay.set(day, (byDay.get(day) || 0) + runCost);
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
                runCount: runs.length
            },
            tokenBreakdown: {
                prompt: totalPromptTokens,
                completion: totalCompletionTokens,
                total: totalTokens,
                promptCostUsd: Math.round(promptCostUsd * 1000000) / 1000000,
                completionCostUsd: Math.round(completionCostUsd * 1000000) / 1000000,
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
            byRun: byRun.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ),
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
                from: startDate ? startDate.toISOString() : "all-time",
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
