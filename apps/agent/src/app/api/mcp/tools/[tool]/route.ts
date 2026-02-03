import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/mcp/tools/[tool]
 *
 * Get detailed information about a specific agent tool.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
    try {
        const { tool } = await params;

        // Parse tool name (format: agent.slug or just slug)
        const agentSlug = tool.startsWith("agent.") ? tool.slice(6) : tool;

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: agentSlug }, { id: agentSlug }]
            },
            include: {
                tools: true,
                workspace: {
                    include: {
                        organization: {
                            select: { slug: true, name: true }
                        }
                    }
                }
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Tool not found: ${tool}` },
                { status: 404 }
            );
        }

        // Build tool definition
        const toolDef = {
            name: `agent.${agent.slug}`,
            description: agent.description || `Agent: ${agent.name}`,
            version: agent.version.toString(),
            metadata: {
                agent_id: agent.id,
                agent_slug: agent.slug,
                agent_name: agent.name,
                model: `${agent.modelProvider}/${agent.modelName}`,
                temperature: agent.temperature,
                is_active: agent.isActive,
                is_public: agent.isPublic,
                requires_approval: agent.requiresApproval,
                max_steps: agent.maxSteps,
                memory_enabled: agent.memoryEnabled,
                scorers: agent.scorers,
                workspace: agent.workspace?.slug,
                environment: agent.workspace?.environment,
                organization: agent.workspace?.organization?.slug,
                tools_count: agent.tools.length,
                tool_ids: agent.tools.map((t) => t.toolId)
            },
            inputSchema: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: "The input message or task for the agent"
                    },
                    context: {
                        type: "object",
                        description: "Optional context variables",
                        additionalProperties: true,
                        properties: {
                            userId: {
                                type: "string",
                                description: "User ID for memory and personalization"
                            },
                            threadId: {
                                type: "string",
                                description: "Thread ID for conversation context"
                            },
                            sessionId: {
                                type: "string",
                                description: "Session ID for channel tracking"
                            }
                        }
                    },
                    maxSteps: {
                        type: "number",
                        description: `Maximum tool-use steps (default: ${agent.maxSteps || 5})`
                    },
                    mode: {
                        type: "string",
                        enum: ["sync", "async"],
                        description: "Execution mode (default: sync)"
                    }
                },
                required: ["input"]
            },
            invoke_url: `/api/agents/${agent.slug}/invoke`,
            created_at: agent.createdAt,
            updated_at: agent.updatedAt
        };

        return NextResponse.json({
            success: true,
            tool: toolDef
        });
    } catch (error) {
        console.error("[MCP Gateway] Error getting tool:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get tool"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mcp/tools/[tool]
 *
 * Invoke a specific agent tool directly.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ tool: string }> }
) {
    try {
        const { tool } = await params;
        const body = await request.json();

        // Parse tool name
        const agentSlug = tool.startsWith("agent.") ? tool.slice(6) : tool;

        // Forward to invoke endpoint
        const invokeUrl = new URL(`/api/agents/${agentSlug}/invoke`, request.url);

        const invokeResponse = await fetch(invokeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(request.headers.get("authorization")
                    ? { Authorization: request.headers.get("authorization")! }
                    : {})
            },
            body: JSON.stringify({
                input: body.input,
                context: body.context,
                maxSteps: body.maxSteps,
                mode: body.mode || "sync"
            })
        });

        const result = await invokeResponse.json();
        return NextResponse.json(result, { status: invokeResponse.status });
    } catch (error) {
        console.error("[MCP Gateway] Error invoking tool:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to invoke tool"
            },
            { status: 500 }
        );
    }
}
