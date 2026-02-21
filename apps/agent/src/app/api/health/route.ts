import { NextResponse } from "next/server";

const startTime = Date.now();

/**
 * GET /api/health
 * Liveness probe — returns 200 if the process is running.
 * Use for load balancer health checks and kubernetes liveness probes.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
    });
}
