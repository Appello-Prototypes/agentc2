#!/usr/bin/env node

/**
 * Mastra Agent MCP Server
 *
 * Exposes all Mastra agents as MCP tools that can be called from Cursor.
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   MASTRA_API_URL - Base URL for the Mastra API (default: http://localhost:3001)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.MASTRA_API_URL || "http://localhost:3001";

// Cache for tools
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch available agents from the Mastra API
 */
async function fetchAgents() {
    const now = Date.now();
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const response = await fetch(`${API_URL}/api/mcp`);
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch agents:", data.error);
            return [];
        }

        toolsCache = data.tools;
        toolsCacheTime = now;
        return data.tools;
    } catch (error) {
        console.error("Error fetching agents:", error.message);
        return toolsCache || [];
    }
}

/**
 * Invoke an agent via the Mastra API
 */
async function invokeAgent(agentSlug, input, context) {
    const response = await fetch(`${API_URL}/api/agents/${agentSlug}/invoke`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            input,
            context,
            mode: "sync"
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || "Agent invocation failed");
    }

    return data;
}

// Create server
const server = new Server(
    {
        name: "mastra-agents",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const agents = await fetchAgents();

    return {
        tools: agents.map((agent) => ({
            // Replace hyphens with underscores - Cursor has a bug where it ignores tools with hyphens
            name: agent.name.replace(/-/g, "_"),
            description:
                agent.description || `Invoke the ${agent.metadata?.agent_name || agent.name} agent`,
            inputSchema: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: "The message or task to send to the agent"
                    },
                    context: {
                        type: "object",
                        description: "Optional context variables",
                        additionalProperties: true
                    }
                },
                required: ["input"]
            }
        }))
    };
});

// Handle tool call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Extract agent slug from tool name (format: agent.slug)
    // Convert underscores back to hyphens since we replaced them for Cursor compatibility
    const rawSlug = name.startsWith("agent.") ? name.slice(6) : name;
    const agentSlug = rawSlug.replace(/_/g, "-");

    try {
        const result = await invokeAgent(agentSlug, args.input, args.context);

        // Format response with metadata
        const content = [
            {
                type: "text",
                text: result.output
            }
        ];

        // Add usage info as additional context
        if (result.usage || result.cost_usd || result.duration_ms) {
            content.push({
                type: "text",
                text: `\n---\nRun ID: ${result.run_id}\nModel: ${result.model}\nTokens: ${result.usage?.total_tokens || 0}\nCost: $${result.cost_usd?.toFixed(5) || 0}\nDuration: ${result.duration_ms}ms`
            });
        }

        return { content };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error invoking agent: ${error.message}`
                }
            ],
            isError: true
        };
    }
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Mastra Agent MCP Server started");
}

main().catch(console.error);
