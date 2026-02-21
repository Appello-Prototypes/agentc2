import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

interface HealthCheck {
    status: "healthy" | "degraded" | "unhealthy";
    checks: Record<string, { status: string; latencyMs?: number; error?: string }>;
    version: string;
    uptime: number;
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthCheck>> {
    const checks: HealthCheck["checks"] = {};

    // Database connectivity
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
    } catch (err) {
        checks.database = {
            status: "error",
            latencyMs: Date.now() - dbStart,
            error: err instanceof Error ? err.message : "Database unreachable"
        };
    }

    // Memory usage
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    checks.memory = {
        status: heapPct > 90 ? "warning" : "ok",
        latencyMs: 0,
        ...(heapPct > 90 ? { error: `Heap usage at ${heapPct}%` } : {})
    };

    // Docker availability
    try {
        const { execSync } = await import("child_process");
        execSync("docker info", { stdio: "ignore", timeout: 3000 });
        checks.docker = { status: "ok" };
    } catch {
        checks.docker = { status: "unavailable", error: "Docker not running" };
    }

    const hasErrors = Object.values(checks).some((c) => c.status === "error");
    const hasWarnings = Object.values(checks).some(
        (c) => c.status === "warning" || c.status === "unavailable"
    );

    const overallStatus: HealthCheck["status"] = hasErrors
        ? "unhealthy"
        : hasWarnings
          ? "degraded"
          : "healthy";

    const result: HealthCheck = {
        status: overallStatus,
        checks,
        version: process.env.npm_package_version || "unknown",
        uptime: Math.round((Date.now() - startTime) / 1000)
    };

    return NextResponse.json(result, {
        status: overallStatus === "unhealthy" ? 503 : 200,
        headers: {
            "Cache-Control": "no-store",
            "X-Health-Memory-Heap": `${heapUsedMb}/${heapTotalMb}MB`
        }
    });
}
