import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Liveness probe — returns 200 if the process is running.
 * Use for load balancer health checks and kubernetes liveness probes.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
}
