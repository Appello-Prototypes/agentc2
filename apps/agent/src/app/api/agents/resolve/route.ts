/**
 * Agent Resolution API
 *
 * POST /api/agents/resolve
 *
 * Resolves an agent by slug with optional RequestContext.
 * Used for testing the AgentResolver and dynamic instructions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { agentResolver, type RequestContext } from "@repo/agentc2/agents";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { slug, requestContext } = body as {
            slug: string;
            requestContext?: RequestContext;
        };

        if (!slug) {
            return NextResponse.json({ error: "slug is required" }, { status: 400 });
        }

        const orgAgent = await prisma.agent.findFirst({
            where: { slug, workspace: { organizationId: authContext.organizationId } },
            select: { id: true }
        });
        if (!orgAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const { agent, record, source } = await agentResolver.resolve({
            slug,
            requestContext
        });

        return NextResponse.json({
            success: true,
            source,
            agent: {
                id: agent.id,
                name: agent.name
            },
            record: record
                ? {
                      id: record.id,
                      slug: record.slug,
                      name: record.name,
                      type: record.type,
                      description: record.description,
                      modelProvider: record.modelProvider,
                      modelName: record.modelName,
                      memoryEnabled: record.memoryEnabled,
                      toolCount: record.tools.length
                  }
                : null
        });
    } catch (error) {
        console.error("[AgentResolver] Error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 404 }
        );
    }
}
