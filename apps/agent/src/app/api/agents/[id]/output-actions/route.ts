import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * GET /api/agents/[id]/output-actions
 *
 * List all output actions for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const outputActions = await prisma.outputAction.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            outputActions: outputActions.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                configJson: a.configJson,
                isActive: a.isActive,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
                createdBy: a.createdBy
            })),
            total: outputActions.length
        });
    } catch (error) {
        console.error("[OutputActions] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list output actions"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/output-actions
 *
 * Create a new output action for an agent
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const body = await request.json();

        const { name, type, configJson, isActive } = body;

        if (!name || !type || configJson === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: name, type, configJson"
                },
                { status: 400 }
            );
        }

        const validTypes = ["WEBHOOK", "CHAIN_AGENT"];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid type '${type}'. Must be one of: ${validTypes.join(", ")}`
                },
                { status: 400 }
            );
        }

        const outputAction = await prisma.outputAction.create({
            data: {
                agentId,
                tenantId: context.organizationId,
                name,
                type,
                configJson,
                isActive: isActive ?? true
            }
        });

        return NextResponse.json({
            success: true,
            outputAction: {
                id: outputAction.id,
                name: outputAction.name,
                type: outputAction.type,
                configJson: outputAction.configJson,
                isActive: outputAction.isActive,
                createdAt: outputAction.createdAt,
                updatedAt: outputAction.updatedAt
            }
        });
    } catch (error) {
        console.error("[OutputActions] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create output action"
            },
            { status: 500 }
        );
    }
}
