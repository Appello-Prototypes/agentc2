import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { requestConnection, listConnections } from "@repo/mastra/federation";

/**
 * GET /api/federation/connections
 *
 * List all federation connections for the authenticated user's organization.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const connections = await listConnections(authContext.organizationId);

        return NextResponse.json({ success: true, connections });
    } catch (error) {
        console.error("[Federation] List connections error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list connections"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/federation/connections
 *
 * Request a new federation connection with another organization.
 *
 * Body:
 * {
 *   "targetOrgSlug": "acme-corp",
 *   "exposedAgentIds": ["clx123", "clx456"],  // optional
 *   "message": "We'd like to connect..."       // optional
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.targetOrgSlug) {
            return NextResponse.json(
                { success: false, error: "targetOrgSlug is required" },
                { status: 400 }
            );
        }

        const result = await requestConnection(authContext.organizationId, authContext.userId, {
            targetOrgSlug: body.targetOrgSlug,
            exposedAgentIds: body.exposedAgentIds,
            message: body.message
        });

        if ("error" in result) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        console.error("[Federation] Request connection error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to request connection"
            },
            { status: 500 }
        );
    }
}
