import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        version: "1.0.0",
        status: "stable",
        documentation: "/api/docs",
        endpoints: {
            agents: "/api/v1/agents",
            workflows: "/api/v1/workflows",
            networks: "/api/v1/networks",
            health: "/api/health",
            metrics: "/api/metrics"
        },
        deprecation: {
            notice: "This is the current stable API version.",
            policy: "Deprecated versions are supported for 6 months after deprecation notice."
        },
        headers: {
            Sunset: "Not applicable — current version",
            Deprecation: "Not applicable — current version"
        }
    });
}
