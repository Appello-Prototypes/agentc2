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
 *   MASTRA_API_URL - Base URL for the Mastra API (default: production)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Default to production URL
const API_URL = process.env.MASTRA_API_URL || "https://mastra.useappello.app";

// Cache for tools
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch available tools from the Mastra API
 */
async function fetchTools() {
    const now = Date.now();
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const response = await fetch(`${API_URL}/api/mcp`);
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch tools:", data.error);
            return [];
        }

        toolsCache = data.tools;
        toolsCacheTime = now;
        return data.tools;
    } catch (error) {
        console.error("Error fetching tools:", error.message);
        return toolsCache || [];
    }
}

/**
 * Invoke a tool via the Mastra MCP gateway
 */
async function invokeTool(toolName, params) {
    const response = await fetch(`${API_URL}/api/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            method: "tools/call",
            tool: toolName,
            params
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || "Tool invocation failed");
    }

    return data.result;
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
const toolNameMap = new Map();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await fetchTools();
    toolNameMap.clear();

    return {
        tools: tools.map((tool) => {
            const safeName = tool.name.replace(/[.-]/g, "_");
            toolNameMap.set(safeName, tool.name);

            return {
                name: safeName,
                description: tool.description || `Invoke ${tool.name}`,
                inputSchema: tool.inputSchema || {
                    type: "object",
                    properties: {},
                    required: []
                },
                outputSchema: tool.outputSchema
            };
        })
    };
});

// Handle tool call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const originalName = toolNameMap.get(name) || name;

    try {
        const result = await invokeTool(originalName, args || {});

        let outputText = "";
        if (typeof result === "string") {
            outputText = result;
        } else if (result?.output) {
            outputText =
                typeof result.output === "string"
                    ? result.output
                    : JSON.stringify(result.output, null, 2);
        } else if (result?.outputText) {
            outputText = result.outputText;
        } else {
            outputText = JSON.stringify(result, null, 2);
        }

        const content = [
            {
                type: "text",
                text: outputText
            }
        ];

        const runId = result?.runId || result?.run_id;
        if (runId || result?.status || result?.duration_ms || result?.durationMs) {
            content.push({
                type: "text",
                text: `\n---\nRun ID: ${runId || "n/a"}\nStatus: ${result?.status || "n/a"}`
            });
        }

        return { content };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error invoking tool: ${error.message}`
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
