import { NextRequest, NextResponse } from "next/server";
import { mastra, listMcpToolDefinitions } from "@repo/mastra";

/**
 * GET /api/demos/agents/[id]/config
 *
 * Get detailed configuration for a specific agent.
 * The [id] parameter is the registration key used in Mastra.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: registrationKey } = await params;

        // Handle MCP agent specially (dynamically created)
        if (registrationKey === "mcp-agent") {
            const mcpTools = await listMcpToolDefinitions();
            return NextResponse.json({
                success: true,
                agent: {
                    registrationKey: "mcp-agent",
                    id: "mcp-agent",
                    name: "MCP-Enabled Agent",
                    instructions: `You are an intelligent assistant with access to business tools.

You have access to tools from multiple MCP servers:
- HubSpot (CRM, contacts, deals, companies)
- Jira (issues, projects)
- JustCall (calls, SMS)
- Gmail, Google Calendar, Google Workspace
- Slack, GitHub
- And more...

When a user asks a question:
1. Identify which tool(s) can help
2. Call the appropriate tool(s)
3. Synthesize the results into a helpful response`,
                    model: {
                        provider: "openai",
                        name: "gpt-4o-mini"
                    },
                    memory: null,
                    tools: mcpTools.map((t) => ({
                        name: t.name,
                        description: t.description || ""
                    })),
                    scorers: null,
                    isDynamic: true
                }
            });
        }

        // Get agent from Mastra using registration key
        const agent = mastra.getAgent(registrationKey);

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${registrationKey}' not found` },
                { status: 404 }
            );
        }

        // Extract full configuration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentAny = agent as any;

        const config = {
            registrationKey,
            id: agentAny.id || registrationKey,
            name: agentAny.name || registrationKey,
            instructions: agentAny.instructions || "(instructions not accessible)",
            model:
                typeof agentAny.model === "string"
                    ? parseModelString(agentAny.model)
                    : agentAny.model || { provider: "unknown", name: "unknown" },
            memory: agentAny.memory
                ? {
                      enabled: true,
                      type: "Memory instance"
                  }
                : null,
            tools: agentAny.tools
                ? Object.entries(agentAny.tools).map(([name, tool]) => ({
                      name,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      description: (tool as any).description || ""
                  }))
                : [],
            scorers: agentAny.scorers ? Object.keys(agentAny.scorers) : null,
            hasVoice: !!agentAny.voice
        };

        return NextResponse.json({
            success: true,
            agent: config
        });
    } catch (error) {
        console.error("[Agent Config] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get agent config"
            },
            { status: 500 }
        );
    }
}

/**
 * Parse model string like "openai/gpt-4o-mini" into object
 */
function parseModelString(model: string): { provider: string; name: string } {
    const parts = model.split("/");
    if (parts.length === 2) {
        return { provider: parts[0], name: parts[1] };
    }
    return { provider: "unknown", name: model };
}
