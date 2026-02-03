import { NextRequest, NextResponse } from "next/server";
import { agentResolver, listMcpToolDefinitions, MCP_SERVER_CONFIGS } from "@repo/mastra";

/** Default agent slug for ElevenLabs requests */
const DEFAULT_AGENT_SLUG = process.env.ELEVENLABS_DEFAULT_AGENT_SLUG || "mcp-agent";

/**
 * Validate webhook secret for ElevenLabs requests
 */
function validateWebhookSecret(request: NextRequest): boolean {
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    // If no secret configured, allow all requests (development mode)
    if (!webhookSecret) {
        console.warn(
            "ELEVENLABS_WEBHOOK_SECRET not configured - allowing unauthenticated requests"
        );
        return true;
    }

    // Check Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
        return false;
    }

    // Support both "Bearer <token>" and raw token formats
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    return token === webhookSecret;
}

/**
 * GET /api/demos/live-agent-mcp/tools
 *
 * Returns list of available MCP tools with their schemas.
 * Use this to configure tools in the ElevenLabs dashboard.
 *
 * Query params:
 * - format: "elevenlabs" returns ElevenLabs-compatible tool definitions
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    try {
        const tools = await listMcpToolDefinitions();

        // Get server availability info
        const serverStatus = MCP_SERVER_CONFIGS.map((config) => ({
            id: config.id,
            name: config.name,
            description: config.description,
            category: config.category,
            available: config.envVars
                ? config.envVars.every((envVar) => !!process.env[envVar])
                : true
        }));

        if (format === "elevenlabs") {
            // Return ElevenLabs-compatible tool configuration
            const webhookUrl = `${request.headers.get("origin") || ""}/api/demos/live-agent-mcp/tools`;

            const elevenlabsTools = tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                type: "webhook",
                webhook: {
                    url: webhookUrl,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer YOUR_WEBHOOK_SECRET"
                    },
                    body: {
                        tool: tool.name,
                        parameters: "{{parameters}}"
                    }
                },
                parameters: tool.parameters
            }));

            return NextResponse.json({
                tools: elevenlabsTools,
                webhookUrl,
                servers: serverStatus,
                instructions:
                    "Configure these tools in your ElevenLabs agent dashboard. Replace YOUR_WEBHOOK_SECRET with your ELEVENLABS_WEBHOOK_SECRET value."
            });
        }

        // Default format - raw tool definitions
        return NextResponse.json({
            tools,
            servers: serverStatus,
            total: tools.length
        });
    } catch (error) {
        console.error("Error listing MCP tools:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list tools" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/demos/live-agent-mcp/tools
 *
 * Execute an MCP tool via agent. Called by ElevenLabs webhook when the voice agent
 * needs to use a tool.
 *
 * Query Parameters:
 * - agent: Agent slug to use (default: env ELEVENLABS_DEFAULT_AGENT_SLUG or "mcp-agent")
 *
 * Request body:
 * - tool: The namespaced tool name (e.g., "hubspot_hubspot-get-user-details")
 * - parameters: Object with tool parameters
 *
 * Authentication:
 * - Requires Authorization header with ELEVENLABS_WEBHOOK_SECRET
 */
export async function POST(request: NextRequest) {
    // Validate webhook authentication
    if (!validateWebhookSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get agent slug from query parameter
    const { searchParams } = new URL(request.url);
    const agentSlug = searchParams.get("agent") || DEFAULT_AGENT_SLUG;

    const startTime = Date.now();

    try {
        const body = await request.json();
        const { tool, parameters } = body;

        // Detailed logging for debugging
        console.log(`\n${"=".repeat(60)}`);
        console.log(`[Live Agent MCP] Incoming request at ${new Date().toISOString()}`);
        console.log(`[Live Agent MCP] Agent: ${agentSlug}`);
        console.log(`[Live Agent MCP] Tool: ${tool}`);
        console.log(`[Live Agent MCP] Parameters:`, JSON.stringify(parameters, null, 2));
        console.log(`[Live Agent MCP] Raw body:`, JSON.stringify(body, null, 2));

        if (!tool) {
            console.log(`[Live Agent MCP] ERROR: Missing tool field`);
            return NextResponse.json({ error: "Missing required field: tool" }, { status: 400 });
        }

        // Resolve agent from database
        const { agent, record, source } = await agentResolver.resolve({ slug: agentSlug });
        console.log(`[Live Agent MCP] Resolved agent "${agentSlug}" from ${source}`);

        // Construct a prompt that will trigger the specific tool
        const paramStr = parameters ? JSON.stringify(parameters, null, 2) : "no parameters";
        const prompt = `Execute the tool "${tool}" with these parameters: ${paramStr}. 
Return ONLY the raw result from the tool, no additional commentary.`;

        // Execute via agent with database-configured maxSteps
        const maxSteps = record?.maxSteps || 3;
        const response = await agent.generate(prompt, {
            maxSteps
        });

        // Extract tool results if any
        const toolResults = response.toolResults || [];
        const toolCalls = response.toolCalls || [];

        console.log(`[Live Agent MCP] Tool executed successfully: ${tool}`);
        console.log(`[Live Agent MCP] Tool calls made:`, toolCalls.length);
        console.log(`[Live Agent MCP] Tool results:`, toolResults.length);

        // Extract text content from tool results for voice response
        let rawResult = "";

        // If we have tool results, try to extract readable content
        if (toolResults.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResult = toolResults[0] as any;
            // Handle nested result structure from MCP tools
            if (toolResult?.payload?.result?.content) {
                const content = toolResult.payload.result.content;
                if (Array.isArray(content)) {
                    // Extract text from content array
                    const texts = content
                        .filter((c: { type: string }) => c.type === "text")
                        .map((c: { text: string }) => c.text);
                    rawResult = texts.join("\n\n");
                }
            } else if (typeof toolResult === "string") {
                rawResult = toolResult;
            } else if (toolResult?.result) {
                rawResult = JSON.stringify(toolResult.result, null, 2);
            }
        }

        // If still no result, use the agent's text
        if (!rawResult && response.text) {
            rawResult = response.text;
        }

        // Summarize the result for voice - use the agent to create a speakable summary
        let spokenResponse = rawResult;
        if (rawResult && rawResult.length > 200) {
            try {
                const summaryResponse = await agent.generate(
                    `Summarize this data in 2-3 short sentences for a voice response. Be concise and conversational:\n\n${rawResult.substring(0, 2000)}`,
                    { maxSteps: 1 }
                );
                spokenResponse = summaryResponse.text || rawResult;
            } catch {
                console.log(`[Live Agent MCP] Summary failed, using raw result`);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[Live Agent MCP] Response preview:`, spokenResponse.substring(0, 300));
        console.log(`[Live Agent MCP] Duration: ${duration}ms`);
        console.log(`${"=".repeat(60)}\n`);

        // Return result in ElevenLabs-compatible format
        // ElevenLabs uses the "text" field for the voice response
        return NextResponse.json({
            success: true,
            tool: tool,
            result: toolResults.length > 0 ? toolResults[0] : response.text,
            text: spokenResponse
        });
    } catch (error) {
        console.error("[Live Agent MCP] Error executing tool:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Tool execution failed" },
            { status: 500 }
        );
    }
}
