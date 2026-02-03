import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { createAgentFromConfig, agentResolver } from "@repo/mastra";

// Feature flag for using new Agent model vs legacy StoredAgent
// Default to true for the new database-driven agents
const USE_DB_AGENTS = process.env.FEATURE_DB_AGENTS !== "false";

/**
 * POST /api/agents/[id]/test
 *
 * Test an agent with a prompt
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { prompt, requestContext } = body;
        if (!prompt) {
            return NextResponse.json(
                { success: false, error: "Missing required field: prompt" },
                { status: 400 }
            );
        }

        if (USE_DB_AGENTS) {
            // Use AgentResolver to get agent (supports both slug and id)
            // MCP-enabled agents automatically receive all MCP tools via the resolver
            const { agent, record, source } = await agentResolver.resolve({
                slug: id,
                requestContext
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
        }

        // Legacy: Use StoredAgent model
        const storedAgent = await prisma.storedAgent.findUnique({
            where: { id }
        });

        if (!storedAgent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Create agent instance from config
        const agent = createAgentFromConfig({
            id: storedAgent.id,
            name: storedAgent.name,
            description: storedAgent.description,
            instructions: storedAgent.instructions,
            modelProvider: storedAgent.modelProvider,
            modelName: storedAgent.modelName,
            temperature: storedAgent.temperature,
            tools: storedAgent.tools,
            memory: storedAgent.memory,
            metadata: storedAgent.metadata as Record<string, unknown> | null,
            isActive: storedAgent.isActive
        });

        // Generate response
        const startTime = Date.now();
        const response = await agent.generate(prompt, {
            maxSteps: 5
        });
        const durationMs = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            response: {
                text: response.text,
                durationMs,
                model: `${storedAgent.modelProvider}/${storedAgent.modelName}`,
                toolCalls: response.toolCalls?.length || 0
            },
            source: "legacy"
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
