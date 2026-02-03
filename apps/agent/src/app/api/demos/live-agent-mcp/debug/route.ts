import { NextResponse } from "next/server";
import { agentResolver } from "@repo/mastra";
import { getRecentCalls } from "./_webhook-log";

/** Default agent slug for ElevenLabs requests */
const DEFAULT_AGENT_SLUG = process.env.ELEVENLABS_DEFAULT_AGENT_SLUG || "mcp-agent";

/**
 * GET /api/demos/live-agent-mcp/debug
 *
 * Returns debug information about recent webhook calls
 */
export async function GET() {
    // Check ngrok status
    let ngrokStatus = { running: false, url: null as string | null };
    try {
        const ngrokRes = await fetch("http://127.0.0.1:4040/api/tunnels");
        if (ngrokRes.ok) {
            const data = await ngrokRes.json();
            ngrokStatus = {
                running: true,
                url: data.tunnels?.[0]?.public_url || null
            };
        }
    } catch {
        // ngrok not running
    }

    // Check ElevenLabs tool configuration
    let elevenlabsToolConfig = null;
    try {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const toolId = "tool_2901kgan0rgyf8zs48fc7r7m7b3f";
        if (apiKey) {
            const res = await fetch(`https://api.elevenlabs.io/v1/convai/tools/${toolId}`, {
                headers: { "xi-api-key": apiKey }
            });
            if (res.ok) {
                const data = await res.json();
                elevenlabsToolConfig = {
                    name: data.tool_config?.name,
                    url: data.tool_config?.api_schema?.url,
                    hasAuth: !!data.tool_config?.api_schema?.request_headers?.Authorization
                };
            }
        }
    } catch {
        // Failed to fetch tool config
    }

    // Check default agent availability
    let defaultAgentStatus = {
        slug: DEFAULT_AGENT_SLUG,
        available: false,
        name: null as string | null,
        model: null as string | null,
        source: null as string | null
    };
    try {
        const { record, source } = await agentResolver.resolve({ slug: DEFAULT_AGENT_SLUG });
        defaultAgentStatus = {
            slug: DEFAULT_AGENT_SLUG,
            available: true,
            name: record?.name || null,
            model: record ? `${record.modelProvider}/${record.modelName}` : null,
            source
        };
    } catch {
        // Agent not found
    }

    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        ngrok: ngrokStatus,
        elevenlabsTool: elevenlabsToolConfig,
        webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET ? "configured" : "NOT configured",
        defaultAgent: defaultAgentStatus,
        recentCalls: getRecentCalls(),
        instructions: {
            howToTest:
                "1. Go to http://localhost:3001/demos/live-agent-mcp, select an agent, and connect",
            whatToSay: "Ask: 'What is my HubSpot info?' or 'Search contacts for John'",
            agentSelection: `Webhook URLs support ?agent=<slug> parameter. Default: ${DEFAULT_AGENT_SLUG}`,
            manageAgents: "Configure agents at /demos/agents/manage",
            checkNgrok: "Visit http://127.0.0.1:4040 to see ngrok request inspector",
            checkLogs: "Look for [Live Agent MCP] in your terminal where bun run dev is running"
        }
    });
}
