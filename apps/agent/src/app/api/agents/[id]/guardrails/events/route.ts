import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/guardrails/events
 *
 * List guardrail events for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const cursor = searchParams.get("cursor");

        // Default to last 7 days if no date range provided
        const startDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            agentId: agent.id,
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        };

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Get guardrail events
        const events = await prisma.guardrailEvent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            include: {
                run: {
                    select: {
                        id: true,
                        status: true,
                        inputText: true
                    }
                }
            }
        });

        // Check if there are more results
        const hasMore = events.length > limit;
        if (hasMore) {
            events.pop();
        }

        // Get event counts by type
        const eventCounts = await prisma.guardrailEvent.groupBy({
            by: ["type"],
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _count: true
        });

        const countsByType = eventCounts.reduce(
            (acc, e) => {
                acc[e.type] = e._count;
                return acc;
            },
            {} as Record<string, number>
        );

        return NextResponse.json({
            success: true,
            events: events.map((event) => ({
                id: event.id,
                type: event.type,
                guardrailKey: event.guardrailKey,
                reason: event.reason,
                inputSnippet: event.inputSnippet,
                outputSnippet: event.outputSnippet,
                createdAt: event.createdAt,
                run: event.run
                    ? {
                          id: event.run.id,
                          status: event.run.status,
                          inputPreview: event.run.inputText.slice(0, 100)
                      }
                    : null
            })),
            summary: {
                total: events.length,
                blocked: countsByType["BLOCKED"] || 0,
                modified: countsByType["MODIFIED"] || 0,
                flagged: countsByType["FLAGGED"] || 0
            },
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            },
            nextCursor: hasMore ? events[events.length - 1].id : null
        });
    } catch (error) {
        console.error("[Agent Guardrail Events] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get guardrail events"
            },
            { status: 500 }
        );
    }
}
