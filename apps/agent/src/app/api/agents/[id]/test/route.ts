import { NextRequest, NextResponse } from "next/server";
import { agentResolver, resolveModelOverride } from "@repo/agentc2/agents";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * POST /api/agents/[id]/test
 *
 * Test an agent with a prompt
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

        const { prompt, requestContext } = body;
        if (!prompt) {
            return NextResponse.json(
                { success: false, error: "Missing required field: prompt" },
                { status: 400 }
            );
        }

        // Model routing (pre-resolve)
        const { modelOverride: routedModelOverride } = await resolveModelOverride(id, prompt);

        // Use AgentResolver to get agent (supports both slug and id)
        // MCP-enabled agents automatically receive all MCP tools via the resolver
        const { agent, record, source } = await agentResolver.resolve({
            slug: id,
            requestContext,
            modelOverride: routedModelOverride
        });

        // Generate response with maxSteps from database or default (matches production channels)
        const startTime = Date.now();
        const response = await agent.generate(prompt, {
            maxSteps: record?.maxSteps ?? 5
        });
        const durationMs = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            response: {
                text: response.text,
                durationMs,
                model: record ? `${record.modelProvider}/${record.modelName}` : "unknown",
                toolCalls: response.toolCalls?.length || 0
            },
            source
        });
    } catch (error) {
        console.error("[Agent Test] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test agent"
            },
            { status: 500 }
        );
    }
}
