#!/usr/bin/env node

/**
 * Twilio MCP Server
 *
 * Exposes outbound call initiation via the Mastra API.
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const API_URL =
    process.env.TWILIO_MCP_API_URL ||
    process.env.MASTRA_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3001";
const API_KEY = process.env.MASTRA_API_KEY;
const ORGANIZATION_SLUG =
    process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
const MAX_TOOL_TEXT_CHARS = Number(process.env.TWILIO_MCP_MAX_CHARS || 20000);

function formatToolResponse(payload) {
    const text = JSON.stringify(payload, null, 2);
    if (text.length <= MAX_TOOL_TEXT_CHARS) {
        return text;
    }
    return `${text.slice(0, MAX_TOOL_TEXT_CHARS)}\n... (truncated)`;
}

async function callMastraApi(endpoint, body) {
    const headers = {
        "Content-Type": "application/json"
    };
    if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
    }
    if (ORGANIZATION_SLUG) {
        headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || "Mastra API request failed");
    }
    return data;
}

const server = new McpServer({
    name: "twilio-mcp",
    version: "1.0.0"
});

server.tool(
    "outbound_call",
    "Initiate an outbound Twilio voice call (stream mode supported).",
    {
        to: z.string().describe("Phone number to call in E.164 format (e.g., +15551234567)"),
        greeting: z.string().optional().describe("Initial greeting to speak on the call"),
        maxDuration: z.number().optional().describe("Maximum call duration in seconds"),
        mode: z.enum(["gather", "stream"]).optional().describe("Call mode (default: stream)"),
        elevenlabsAgentId: z.string().optional().describe("ElevenLabs agent ID for stream mode"),
        agentSlug: z.string().optional().describe("Mastra agent slug for logging")
    },
    async ({ to, greeting, maxDuration, mode, elevenlabsAgentId, agentSlug }) => {
        try {
            const payload = await callMastraApi("/api/channels/voice/call", {
                to,
                greeting,
                maxDuration,
                mode: mode || "stream",
                elevenlabsAgentId,
                agentSlug
            });

            return {
                content: [
                    {
                        type: "text",
                        text: formatToolResponse(payload)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Twilio MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
