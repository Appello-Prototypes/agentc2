/**
 * Agent Resolution API
 *
 * POST /api/agents/resolve
 *
 * Resolves an agent by slug with optional RequestContext.
 * Used for testing the AgentResolver and dynamic instructions.
 */

import { NextRequest, NextResponse } from "next/server";
import { agentResolver, type RequestContext } from "@repo/agentc2/agents";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { slug, requestContext } = body as {
            slug: string;
            requestContext?: RequestContext;
        };

        if (!slug) {
            return NextResponse.json({ error: "slug is required" }, { status: 400 });
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
                      scorers: record.scorers,
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
