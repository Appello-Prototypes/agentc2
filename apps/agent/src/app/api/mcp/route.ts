import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * MCP Server Gateway
 *
 * Exposes all agents as MCP tools that can be invoked by external MCP clients.
 * This implements the inbound MCP gateway pattern where each agent becomes
 * a callable service.
 *
 * Protocol: Simplified MCP-like JSON-RPC
 *
 * Endpoints:
 * - GET /api/mcp - List available tools (agents)
 * - POST /api/mcp - Invoke a tool (agent)
 */

/**
 * GET /api/mcp
 *
 * Lists all agents as MCP tools.
 * Returns tool definitions with metadata for discovery.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get("includeInactive") === "true";

        // Get all agents from database
        const agents = await prisma.agent.findMany({
            where: includeInactive ? {} : { isActive: true },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                modelProvider: true,
                modelName: true,
                isActive: true,
                isPublic: true,
                maxSteps: true,
                requiresApproval: true,
                version: true,
                workspace: {
                    select: {
                        slug: true,
                        environment: true,
                        organization: {
                            select: {
                                slug: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        // Transform agents to MCP tool definitions
        const tools = agents.map((agent) => ({
            name: `agent.${agent.slug}`,
            description: agent.description || `Agent: ${agent.name}`,
            version: agent.version.toString(),
            metadata: {
                agent_id: agent.id,
                agent_slug: agent.slug,
                agent_name: agent.name,
                model: `${agent.modelProvider}/${agent.modelName}`,
                is_active: agent.isActive,
                is_public: agent.isPublic,
                requires_approval: agent.requiresApproval,
                max_steps: agent.maxSteps,
                workspace: agent.workspace?.slug,
                environment: agent.workspace?.environment,
                organization: agent.workspace?.organization?.slug
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
                        additionalProperties: true
                    },
                    maxSteps: {
                        type: "number",
                        description: "Maximum tool-use steps (optional)"
                    }
                },
                required: ["input"]
            },
            invoke_url: `/api/agents/${agent.slug}/invoke`
        }));

        return NextResponse.json({
            success: true,
            protocol: "mcp-agent-gateway/1.0",
            server_info: {
                name: "mastra-agent-gateway",
                version: "1.0.0",
                capabilities: ["tools", "invoke"]
            },
            tools,
            total: tools.length
        });
    } catch (error) {
        console.error("[MCP Gateway] Error listing tools:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list tools"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mcp
 *
 * Invokes an agent tool using MCP-like JSON-RPC.
 *
 * Request body:
 * {
 *   "method": "invoke",
 *   "tool": "agent.mcp-agent",
 *   "params": {
 *     "input": "Your question here",
 *     "context": { ... }
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "result": {
 *     "run_id": "...",
 *     "output": "Agent response",
 *     "usage": { ... },
 *     "cost_usd": 0.05
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { method, tool, params } = body;

        // Validate request
        if (!method) {
            return NextResponse.json({ success: false, error: "Missing method" }, { status: 400 });
        }

        if (method !== "invoke" && method !== "tools/call") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unsupported method: ${method}. Supported: invoke, tools/call`
                },
                { status: 400 }
            );
        }

        if (!tool) {
            return NextResponse.json(
                { success: false, error: "Missing tool name" },
                { status: 400 }
            );
        }

        // Parse tool name (format: agent.slug or just slug)
        // "agent." is 6 characters
        const agentSlug = tool.startsWith("agent.") ? tool.slice(6) : tool;

        if (!params?.input) {
            return NextResponse.json(
                { success: false, error: "Missing params.input" },
                { status: 400 }
            );
        }

        // Forward to the invoke endpoint
        const invokeUrl = new URL(`/api/agents/${agentSlug}/invoke`, request.url);

        const invokeResponse = await fetch(invokeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Forward auth headers if present
                ...(request.headers.get("authorization")
                    ? { Authorization: request.headers.get("authorization")! }
                    : {})
            },
            body: JSON.stringify({
                input: params.input,
                context: params.context,
                maxSteps: params.maxSteps,
                mode: "sync"
            })
        });

        const result = await invokeResponse.json();

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    run_id: result.run_id
                },
                { status: invokeResponse.status }
            );
        }

        return NextResponse.json({
            success: true,
            result: {
                run_id: result.run_id,
                output: result.output,
                usage: result.usage,
                cost_usd: result.cost_usd,
                duration_ms: result.duration_ms,
                model: result.model
            }
        });
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
