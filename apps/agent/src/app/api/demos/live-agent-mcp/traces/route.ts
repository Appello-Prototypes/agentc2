import { NextRequest, NextResponse } from "next/server";
import { getTraces, getTraceById, clearTraces, getTraceStats } from "@/lib/trace-store";

/**
 * GET /api/demos/live-agent-mcp/traces
 *
 * Retrieves conversation traces with optional filtering and pagination.
 * Aligned with Mastra's Telemetry API interface.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - perPage: Items per page (default: 20)
 * - traceId: Filter by specific trace ID
 * - source: Filter by source (e.g., "elevenlabs-voice")
 *
 * @see https://mastra.ai/en/reference/client-js/telemetry
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    // Pagination params (aligned with Mastra API)
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "20", 10);

    // Filter params
    const traceId = searchParams.get("traceId");
    const source = searchParams.get("source");

    // Single trace lookup
    if (traceId) {
        const trace = await getTraceById(traceId);
        if (!trace) {
            return NextResponse.json({ error: "Trace not found" }, { status: 404 });
        }
        return NextResponse.json({ trace });
    }

    // Get all traces
    let filteredTraces = await getTraces();

    // Apply source filter
    if (source) {
        filteredTraces = filteredTraces.filter((t) => t.metadata.source === source);
    }

    // Paginate
    const startIndex = (page - 1) * perPage;
    const paginatedTraces = filteredTraces.slice(startIndex, startIndex + perPage);

    // Get aggregate stats
    const stats = await getTraceStats();

    return NextResponse.json({
        traces: paginatedTraces,
        stats,
        pagination: {
            page,
            perPage,
            total: filteredTraces.length,
            hasMore: startIndex + perPage < filteredTraces.length
        }
    });
}

/**
 * DELETE /api/demos/live-agent-mcp/traces
 *
 * Clear all traces (for testing/reset)
 */
export async function DELETE() {
    const count = await clearTraces();
    return NextResponse.json({ cleared: count });
}
