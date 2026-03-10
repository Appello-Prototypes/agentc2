#!/usr/bin/env node

/**
 * AgentC2 MCP Server v2
 *
 * Exposes all AgentC2 platform capabilities as MCP tools to AI clients
 * (Claude Code, Cursor, ChatGPT, Claude CoWork).
 *
 * Uses the high-level McpServer API with:
 * - Tool annotations (readOnly, destructive, idempotent, openWorld)
 * - Resources for lightweight entity discovery
 * - Server instructions for AI client onboarding
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   AGENTC2_API_URL - Base URL for the AgentC2 API (default: production)
 *   AGENTC2_API_KEY - API key for authentication
 *   AGENTC2_ORGANIZATION_SLUG - Organization slug for scoping
 */

import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Configuration
const API_URL = process.env.AGENTC2_API_URL || "https://agentc2.ai";
const API_KEY = process.env.AGENTC2_API_KEY;
const ORGANIZATION_SLUG =
    process.env.AGENTC2_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;

// Cache for tools (5 minutes)
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

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

function getApiHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    if (ORGANIZATION_SLUG) headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
    return headers;
}

/**
 * Fetch available tools from the AgentC2 API
 */
async function fetchTools(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const response = await fetch(`${API_URL}/api/mcp`, { headers: getApiHeaders() });
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch tools:", data.error);
            return toolsCache || [];
        }

        toolsCache = data.tools;
        toolsCacheTime = now;
        console.error(
            `AgentC2: ${data.tools.length} tools loaded for ${ORGANIZATION_SLUG || "default"}`
        );
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
    const response = await fetch(`${API_URL}/api/mcp`, {
        method: "POST",
        headers: getApiHeaders(),
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

/**
 * Convert JSON Schema to a Zod shape for McpServer tool registration.
 * McpServer requires Zod schemas; we convert the JSON Schema properties.
 */
function jsonSchemaToZodShape(inputSchema) {
    if (!inputSchema || !inputSchema.properties) {
        return {};
    }

    const shape = {};
    const required = new Set(inputSchema.required || []);

    for (const [key, prop] of Object.entries(inputSchema.properties)) {
        let zodType;

        switch (prop.type) {
            case "string":
                zodType = z.string();
                break;
            case "number":
            case "integer":
                zodType = z.number();
                break;
            case "boolean":
                zodType = z.boolean();
                break;
            case "array":
                zodType = z.array(z.any());
                break;
            case "object":
                zodType = z.record(z.any());
                break;
            default:
                zodType = z.any();
        }

        if (prop.description) {
            zodType = zodType.describe(prop.description);
        }

        if (!required.has(key)) {
            zodType = zodType.optional();
        }

        shape[key] = zodType;
    }

    return shape;
}

/**
 * Format tool result for MCP response
 */
function formatResult(result) {
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

    const content = [{ type: "text", text: outputText }];

    const runId = result?.runId || result?.run_id;
    if (runId || result?.status || result?.duration_ms || result?.durationMs) {
        content.push({
            type: "text",
            text: `\n---\nRun ID: ${runId || "n/a"}\nStatus: ${result?.status || "n/a"}`
        });
    }

    return { content };
}

// Server instructions for AI clients
const SERVER_INSTRUCTIONS = `# AgentC2 Platform
An AI agent orchestration platform. Key capabilities:
- **Agent Management**: Create, update, invoke, and monitor AI agents
- **Workflows**: Multi-step orchestration pipelines
- **Networks**: Multi-agent collaboration networks
- **Integrations**: 15+ connected services (Slack, HubSpot, Jira, etc.)

## Quick Start
- Use \`platform-docs\` with topic="overview" for full capabilities
- Use \`agent-discover\` to find agents by capability
- Use \`agent-invoke-dynamic\` to run any agent by slug
- Use \`workflow-execute\` to run any workflow by slug
- Use \`network-execute\` to run any network by slug

## Tool Annotations
Tools include annotations indicating their behavior:
- \`readOnlyHint\`: Safe to call, no side effects
- \`destructiveHint\`: Deletes or destroys resources permanently
- \`idempotentHint\`: Safe to retry, same result on repeated calls
- \`openWorldHint\`: Calls external APIs or executes arbitrary code
`;

// Create server
const server = new McpServer(
    { name: "agentc2", version: "2.0.0" },
    {
        capabilities: { tools: {}, resources: {} },
        instructions: SERVER_INSTRUCTIONS
    }
);

// Map safe names back to original tool names
const toolNameMap = new Map();

/**
 * Register all tools from the API with the McpServer
 */
async function registerTools() {
    const tools = await fetchTools();

    for (const tool of tools) {
        // Normalize name: replace dots/hyphens with underscores for MCP wire format
        const safeName = tool.name.replace(/[.-]/g, "_");
        toolNameMap.set(safeName, tool.name);

        const zodShape = jsonSchemaToZodShape(tool.inputSchema);

        // Build annotations from the API response
        const annotations = {};
        if (tool.annotations) {
            if (tool.annotations.readOnlyHint !== undefined)
                annotations.readOnlyHint = tool.annotations.readOnlyHint;
            if (tool.annotations.destructiveHint !== undefined)
                annotations.destructiveHint = tool.annotations.destructiveHint;
            if (tool.annotations.idempotentHint !== undefined)
                annotations.idempotentHint = tool.annotations.idempotentHint;
            if (tool.annotations.openWorldHint !== undefined)
                annotations.openWorldHint = tool.annotations.openWorldHint;
        }

        const callback = async (args) => {
            const originalName = toolNameMap.get(safeName) || tool.name;

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
                return formatResult(result);
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Error invoking tool: ${error.message}` }],
                    isError: true
                };
            }
        };

        const hasAnnotations = Object.keys(annotations).length > 0;
        if (hasAnnotations) {
            server.tool(
                safeName,
                tool.description || `Invoke ${tool.name}`,
                zodShape,
                annotations,
                callback
            );
        } else {
            server.tool(safeName, tool.description || `Invoke ${tool.name}`, zodShape, callback);
        }
    }
}

/**
 * Register MCP resources for entity discovery
 */
function registerResources() {
    // Agents resource
    server.resource("agents", "agentc2://agents", async () => {
        try {
            const response = await fetch(`${API_URL}/api/mcp?legacy=true`, {
                headers: getApiHeaders()
            });
            const data = await response.json();
            if (!data.success) {
                return {
                    contents: [
                        {
                            uri: "agentc2://agents",
                            mimeType: "application/json",
                            text: JSON.stringify({ error: data.error })
                        }
                    ]
                };
            }

            const agents = data.tools
                .filter((t) => t.name.startsWith("agent."))
                .map((t) => ({
                    slug: t.name.slice(6),
                    name: t.metadata?.agent_name || t.name,
                    description: t.description,
                    model: t.metadata?.model,
                    isActive: t.metadata?.is_active
                }));

            return {
                contents: [
                    {
                        uri: "agentc2://agents",
                        mimeType: "application/json",
                        text: JSON.stringify(agents, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: "agentc2://agents",
                        mimeType: "application/json",
                        text: JSON.stringify({ error: error.message })
                    }
                ]
            };
        }
    });

    // Workflows resource
    server.resource("workflows", "agentc2://workflows", async () => {
        try {
            const response = await fetch(`${API_URL}/api/mcp?legacy=true`, {
                headers: getApiHeaders()
            });
            const data = await response.json();
            if (!data.success) {
                return {
                    contents: [
                        {
                            uri: "agentc2://workflows",
                            mimeType: "application/json",
                            text: JSON.stringify({ error: data.error })
                        }
                    ]
                };
            }

            const workflows = data.tools
                .filter((t) => t.name.startsWith("workflow-") && t.metadata?.workflow_slug)
                .map((t) => ({
                    slug: t.metadata.workflow_slug,
                    name: t.metadata.workflow_name || t.name,
                    description: t.description,
                    isActive: t.metadata.is_active,
                    isPublished: t.metadata.is_published
                }));

            return {
                contents: [
                    {
                        uri: "agentc2://workflows",
                        mimeType: "application/json",
                        text: JSON.stringify(workflows, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: "agentc2://workflows",
                        mimeType: "application/json",
                        text: JSON.stringify({ error: error.message })
                    }
                ]
            };
        }
    });

    // Networks resource
    server.resource("networks", "agentc2://networks", async () => {
        try {
            const response = await fetch(`${API_URL}/api/mcp?legacy=true`, {
                headers: getApiHeaders()
            });
            const data = await response.json();
            if (!data.success) {
                return {
                    contents: [
                        {
                            uri: "agentc2://networks",
                            mimeType: "application/json",
                            text: JSON.stringify({ error: data.error })
                        }
                    ]
                };
            }

            const networks = data.tools
                .filter((t) => t.name.startsWith("network-") && t.metadata?.network_slug)
                .map((t) => ({
                    slug: t.metadata.network_slug,
                    name: t.metadata.network_name || t.name,
                    description: t.description,
                    isActive: t.metadata.is_active,
                    isPublished: t.metadata.is_published
                }));

            return {
                contents: [
                    {
                        uri: "agentc2://networks",
                        mimeType: "application/json",
                        text: JSON.stringify(networks, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: "agentc2://networks",
                        mimeType: "application/json",
                        text: JSON.stringify({ error: error.message })
                    }
                ]
            };
        }
    });

    // Platform docs resource
    server.resource("platform-docs", "agentc2://docs", async () => {
        try {
            const result = await invokeTool("platform-docs", { topic: "overview" });
            const text =
                typeof result === "string"
                    ? result
                    : result?.output || JSON.stringify(result, null, 2);

            return {
                contents: [
                    {
                        uri: "agentc2://docs",
                        mimeType: "text/markdown",
                        text
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: "agentc2://docs",
                        mimeType: "text/plain",
                        text: `Error fetching docs: ${error.message}`
                    }
                ]
            };
        }
    });
}

// Start server
async function main() {
    // Register resources (static, always available)
    registerResources();

    // Register tools from API
    await registerTools();

    // Connect via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AgentC2 MCP Server v2 started");
}

main().catch(console.error);
