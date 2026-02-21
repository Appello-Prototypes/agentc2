import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/health/ready
 * Readiness probe — verifies critical subsystems are operational.
 * Returns 200 when all checks pass, 503 if any fail.
 */
export async function GET() {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
    } catch {
        checks.database = { status: "error", latencyMs: Date.now() - dbStart };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === "ok");

    return NextResponse.json(
        {
            status: allHealthy ? "ready" : "not_ready",
            checks,
            timestamp: new Date().toISOString()
        },
        { status: allHealthy ? 200 : 503 }
    );
}
