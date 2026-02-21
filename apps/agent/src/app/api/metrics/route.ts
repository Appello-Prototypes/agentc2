import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/metrics
 *
 * Prometheus-format metrics endpoint.
 * Returns key platform gauges and counters for monitoring.
 */
export async function GET() {
    const lines: string[] = [];
    const now = Date.now();

    try {
        // Agent counts
        const [totalAgents, activeAgents] = await Promise.all([
            prisma.agent.count(),
            prisma.agent.count({ where: { isActive: true } })
        ]);
        lines.push("# HELP agentc2_agents_total Total number of agents");
        lines.push("# TYPE agentc2_agents_total gauge");
        lines.push(`agentc2_agents_total ${totalAgents}`);
        lines.push("# HELP agentc2_agents_active Number of active agents");
        lines.push("# TYPE agentc2_agents_active gauge");
        lines.push(`agentc2_agents_active ${activeAgents}`);

        // Agent runs (last 24h)
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const runCounts = await prisma.agentRun.groupBy({
            by: ["status"],
            where: { createdAt: { gte: oneDayAgo } },
            _count: true
        });
        lines.push("# HELP agentc2_agent_runs_24h Agent runs in the last 24 hours by status");
        lines.push("# TYPE agentc2_agent_runs_24h gauge");
        for (const rc of runCounts) {
            lines.push(`agentc2_agent_runs_24h{status="${rc.status}"} ${rc._count}`);
        }

        // Cost events (last 24h)
        const recentCosts = await prisma.costEvent.aggregate({
            where: { createdAt: { gte: oneDayAgo }, status: "FINALIZED" },
            _sum: { billedCostUsd: true, costUsd: true },
            _count: true
        });
        lines.push("# HELP agentc2_cost_events_24h_total Cost events in last 24 hours");
        lines.push("# TYPE agentc2_cost_events_24h_total gauge");
        lines.push(`agentc2_cost_events_24h_total ${recentCosts._count}`);
        lines.push("# HELP agentc2_cost_usd_24h Total cost in USD (last 24h)");
        lines.push("# TYPE agentc2_cost_usd_24h gauge");
        lines.push(
            `agentc2_cost_usd_24h ${(recentCosts._sum.billedCostUsd ?? recentCosts._sum.costUsd ?? 0).toFixed(4)}`
        );

        // Token usage (last 24h)
        const tokenUsage = await prisma.costEvent.aggregate({
            where: { createdAt: { gte: oneDayAgo }, status: "FINALIZED" },
            _sum: { promptTokens: true, completionTokens: true, totalTokens: true }
        });
        lines.push("# HELP agentc2_tokens_24h Token usage in last 24 hours");
        lines.push("# TYPE agentc2_tokens_24h gauge");
        lines.push(`agentc2_tokens_24h{type="prompt"} ${tokenUsage._sum.promptTokens ?? 0}`);
        lines.push(
            `agentc2_tokens_24h{type="completion"} ${tokenUsage._sum.completionTokens ?? 0}`
        );
        lines.push(`agentc2_tokens_24h{type="total"} ${tokenUsage._sum.totalTokens ?? 0}`);

        // Guardrail blocks (last 24h)
        const guardrailBlocks = await prisma.guardrailEvent.count({
            where: { createdAt: { gte: oneDayAgo }, type: "BLOCKED" }
        });
        lines.push("# HELP agentc2_guardrail_blocks_24h Guardrail blocks in last 24 hours");
        lines.push("# TYPE agentc2_guardrail_blocks_24h gauge");
        lines.push(`agentc2_guardrail_blocks_24h ${guardrailBlocks}`);

        // Budget violations (last 24h)
        const budgetAlerts = await prisma.budgetAlert.count({
            where: { createdAt: { gte: oneDayAgo }, type: "limit_reached" }
        });
        lines.push("# HELP agentc2_budget_violations_24h Budget violations in last 24 hours");
        lines.push("# TYPE agentc2_budget_violations_24h gauge");
        lines.push(`agentc2_budget_violations_24h ${budgetAlerts}`);

        // Organizations
        const orgCount = await prisma.organization.count();
        lines.push("# HELP agentc2_organizations_total Total organizations");
        lines.push("# TYPE agentc2_organizations_total gauge");
        lines.push(`agentc2_organizations_total ${orgCount}`);

        // Process metrics
        const mem = process.memoryUsage();
        lines.push("# HELP agentc2_process_heap_bytes Process heap memory in bytes");
        lines.push("# TYPE agentc2_process_heap_bytes gauge");
        lines.push(`agentc2_process_heap_bytes ${mem.heapUsed}`);
        lines.push("# HELP agentc2_process_rss_bytes Process RSS memory in bytes");
        lines.push("# TYPE agentc2_process_rss_bytes gauge");
        lines.push(`agentc2_process_rss_bytes ${mem.rss}`);
    } catch (error) {
        lines.push(`# ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    return new NextResponse(lines.join("\n") + "\n", {
        status: 200,
        headers: {
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}
