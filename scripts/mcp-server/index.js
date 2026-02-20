#!/usr/bin/env node

/**
 * AgentC2 MCP Server
 *
 * Exposes all AgentC2 agents as MCP tools that can be called from Cursor.
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   AGENTC2_API_URL - Base URL for the AgentC2 API (default: production)
 */

import crypto from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Default to production URL
const API_URL = process.env.AGENTC2_API_URL || "https://agentc2.ai";
const API_KEY = process.env.AGENTC2_API_KEY;
const ORGANIZATION_SLUG =
    process.env.AGENTC2_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;

// Cache for tools
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

// Per-agent conversation thread tracking (30-minute timeout)
const THREAD_TIMEOUT_MS = 30 * 60 * 1000;
const agentThreads = new Map(); // agentSlug -> { threadId, lastActivity }

function getOrCreateThreadId(agentSlug) {
    const existing = agentThreads.get(agentSlug);
    const now = Date.now();
    if (existing && now - existing.lastActivity < THREAD_TIMEOUT_MS) {
        existing.lastActivity = now;
        return existing.threadId;
    }
    const threadId = `mcp-${crypto.randomUUID()}`;
    agentThreads.set(agentSlug, { threadId, lastActivity: now });
    return threadId;
}

/**
 * Fetch available tools from the AgentC2 API
 */
async function fetchTools() {
    const now = Date.now();
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const headers = {
            "Content-Type": "application/json"
        };
        if (API_KEY) {
            headers["X-API-Key"] = API_KEY;
        }
        if (ORGANIZATION_SLUG) {
            headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
        }
        const response = await fetch(`${API_URL}/api/mcp`, { headers });
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
 * Invoke a tool via the AgentC2 MCP gateway
 */
async function invokeTool(toolName, params) {
    const headers = {
        "Content-Type": "application/json"
    };
    if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
    }
    if (ORGANIZATION_SLUG) {
        headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
    }
    const response = await fetch(`${API_URL}/api/mcp`, {
        method: "POST",
        headers,
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
        name: "agentc2-agents",
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
                }
                // Note: outputSchema removed - MCP SDK requires structured content when outputSchema is defined,
                // but we return text content for flexibility
            };
        })
    };
});

// Handle tool call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const originalName = toolNameMap.get(name) || name;

    try {
        // Inject threadId for agent tools to enable conversation grouping
        let enrichedArgs = args || {};
        if (originalName.startsWith("agent.")) {
            const agentSlug = originalName.slice(6);
            const threadId = getOrCreateThreadId(agentSlug);
            enrichedArgs = {
                ...enrichedArgs,
                context: {
                    ...(enrichedArgs.context || {}),
                    threadId
                }
            };
        }
        const result = await invokeTool(originalName, enrichedArgs);

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
    console.error("AgentC2 MCP Server started");
}

main().catch(console.error);
