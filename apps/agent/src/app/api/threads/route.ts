import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/threads
 *
 * List conversation threads grouped by threadId.
 * Returns thread-level aggregates: run count, turn count, tokens, cost, time range.
 *
 * Query Parameters:
 * - agentId: Filter by agent ID
 * - agentSlug: Filter by agent slug
 * - source: Filter by source channel
 * - from/to: Date range (ISO strings)
 * - search: Search within thread input/output text
 * - limit: Max threads (default 30, max 100)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get("agentId");
        const agentSlug = searchParams.get("agentSlug");
        const source = searchParams.get("source");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const search = searchParams.get("search");
        const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            threadId: { not: null },
            agent: { workspace: { organizationId: authContext.organizationId } }
        };

        if (agentId) where.agentId = agentId;
        if (agentSlug) where.agent = { ...where.agent, slug: agentSlug };
        if (source && source !== "all") where.source = source;
        if (from) where.startedAt = { ...where.startedAt, gte: new Date(from) };
        if (to) where.startedAt = { ...where.startedAt, lte: new Date(to) };
        if (search) {
            where.OR = [
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
            ];
        }

        const grouped = await prisma.agentRun.groupBy({
            by: ["threadId"],
            where,
            _count: { id: true },
            _sum: { totalTokens: true, costUsd: true, durationMs: true, turnCount: true },
            _min: { startedAt: true },
            _max: { startedAt: true, completedAt: true },
            orderBy: { _max: { startedAt: "desc" } },
            take: limit,
            skip: offset
        });

        const totalThreads = await prisma.agentRun.groupBy({
            by: ["threadId"],
            where,
            _count: { id: true }
        });

        // Fetch first run per thread for agent name, input preview, and source
        const threadIds = grouped.map((g) => g.threadId).filter(Boolean) as string[];
        const firstRuns =
            threadIds.length > 0
                ? await prisma.agentRun.findMany({
                      where: {
                          threadId: { in: threadIds },
                          agent: { workspace: { organizationId: authContext.organizationId } }
                      },
                      orderBy: { startedAt: "asc" },
                      distinct: ["threadId"],
                      select: {
                          threadId: true,
                          inputText: true,
                          source: true,
                          agentId: true,
                          agent: { select: { slug: true, name: true } }
                      }
                  })
                : [];

        const firstRunMap = new Map(firstRuns.map((r) => [r.threadId, r]));

        // Fetch last run per thread for the latest output
        const lastRuns =
            threadIds.length > 0
                ? await prisma.agentRun.findMany({
                      where: {
                          threadId: { in: threadIds },
                          agent: { workspace: { organizationId: authContext.organizationId } }
                      },
                      orderBy: { startedAt: "desc" },
                      distinct: ["threadId"],
                      select: {
                          threadId: true,
                          inputText: true,
                          outputText: true,
                          status: true
                      }
                  })
                : [];

        const lastRunMap = new Map(lastRuns.map((r) => [r.threadId, r]));

        const threads = grouped.map((g) => {
            const first = firstRunMap.get(g.threadId!);
            const last = lastRunMap.get(g.threadId!);
            return {
                threadId: g.threadId,
                agentId: first?.agentId ?? null,
                agentSlug: first?.agent?.slug ?? null,
                agentName: first?.agent?.name ?? null,
                source: first?.source ?? null,
                runCount: g._count.id,
                totalTurns: g._sum.turnCount ?? g._count.id,
                totalTokens: g._sum.totalTokens ?? 0,
                totalCostUsd: g._sum.costUsd ? Math.round(g._sum.costUsd * 10000) / 10000 : 0,
                totalDurationMs: g._sum.durationMs ?? 0,
                firstMessageAt: g._min.startedAt,
                lastMessageAt: g._max.startedAt,
                lastCompletedAt: g._max.completedAt,
                firstInput: first?.inputText?.slice(0, 200) ?? null,
                lastInput: last?.inputText?.slice(0, 200) ?? null,
                lastOutput: last?.outputText?.slice(0, 200) ?? null,
                lastStatus: last?.status ?? null
            };
        });

        return NextResponse.json({
            success: true,
            threads,
            total: totalThreads.length,
            pagination: { limit, offset, hasMore: offset + threads.length < totalThreads.length }
        });
    } catch (error) {
        console.error("[Threads List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list threads" },
            { status: 500 }
        );
    }
}
