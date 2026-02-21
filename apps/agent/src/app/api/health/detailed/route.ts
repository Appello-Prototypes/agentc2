import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { NextRequest } from "next/server";

const startTime = Date.now();

/**
 * GET /api/health/detailed
 * Admin-only detailed health check — requires authentication.
 * Returns subsystem statuses, memory usage, uptime, and version info.
 */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const checks: Record<string, { status: string; latencyMs?: number; details?: unknown }> = {};

    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
    } catch (error) {
        checks.database = {
            status: "error",
            latencyMs: Date.now() - dbStart,
            details: error instanceof Error ? error.message : "Unknown error"
        };
    }

    const memUsage = process.memoryUsage();
    const allHealthy = Object.values(checks).every((c) => c.status === "ok");

    return NextResponse.json(
        {
            status: allHealthy ? "healthy" : "degraded",
            checks,
            system: {
                uptime: Math.floor((Date.now() - startTime) / 1000),
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024),
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memUsage.external / 1024 / 1024)
                },
                nodeVersion: process.version,
                pid: process.pid
            },
            timestamp: new Date().toISOString()
        },
        { status: allHealthy ? 200 : 503 }
    );
}
