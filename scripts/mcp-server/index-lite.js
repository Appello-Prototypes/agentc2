#!/usr/bin/env node

/**
 * AgentC2 MCP Server — Lite Edition (for Claude Code)
 *
 * Same as index.js but filters tools to a smaller set to work within
 * Claude Code's MCP tool limits. Cursor uses the full index.js directly.
 *
 * Keeps: agent invocations, key management tools, workflows, networks
 * Drops: CRUD operations, admin tools, platform internals
 */

import crypto from "node:crypto"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

const API_URL = process.env.AGENTC2_API_URL || "https://agentc2.ai"
const API_KEY = process.env.AGENTC2_API_KEY
const ORGANIZATION_SLUG =
    process.env.AGENTC2_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG

// Tools to ALWAYS include (exact name match)
const INCLUDE_EXACT = new Set([
    "agent-list",
    "agent-overview",
    "agent-analytics",
    "agent-costs",
    "agent-discover",
    "agent-invoke-dynamic",
    "agent-runs-list",
    "agent-runs-get",
    "agent-run-trace",
    "live-runs",
    "live-metrics",
    "live-stats",
    "org-list",
    "org-get",
    "org-members-list",
    "rag-query",
    "rag-documents-list",
    "workflow-list",
    "workflow-read",
    "network-list",
    "network-read",
    "goal-list",
    "goal-get",
    "conversation-list",
    "conversation-get",
    "integration-tools-list",
    "platform-docs",
    "platform-context",
    "cursor-launch-agent",
    "cursor-get-status",
    "cursor-poll-until-done",
    "dispatch-coding-pipeline",
    "execute-code",
])

// Tool name prefixes to include (all agent.* invocations, workflow-*, network-*)
const INCLUDE_PREFIXES = ["agent.", "workflow.", "network."]

function shouldInclude(toolName) {
    if (INCLUDE_EXACT.has(toolName)) return true
    return INCLUDE_PREFIXES.some((prefix) => toolName.startsWith(prefix))
}

let toolsCache = null
let toolsCacheTime = 0
const CACHE_TTL = 60000

const THREAD_TIMEOUT_MS = 30 * 60 * 1000
const agentThreads = new Map()

function getOrCreateThreadId(agentSlug) {
    const existing = agentThreads.get(agentSlug)
    const now = Date.now()
    if (existing && now - existing.lastActivity < THREAD_TIMEOUT_MS) {
        existing.lastActivity = now
        return existing.threadId
    }
    const threadId = `mcp-${crypto.randomUUID()}`
    agentThreads.set(agentSlug, { threadId, lastActivity: now })
    return threadId
}

async function fetchTools() {
    const now = Date.now()
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache
    }

    try {
        const headers = { "Content-Type": "application/json" }
        if (API_KEY) headers["X-API-Key"] = API_KEY
        if (ORGANIZATION_SLUG) headers["X-Organization-Slug"] = ORGANIZATION_SLUG
        const response = await fetch(`${API_URL}/api/mcp`, { headers })
        const data = await response.json()

        if (!data.success) {
            console.error("Failed to fetch tools:", data.error)
            return []
        }

        // Filter to lite set
        const allTools = data.tools
        const filtered = allTools.filter((tool) => shouldInclude(tool.name))
        console.error(
            `AgentC2 Lite: ${filtered.length}/${allTools.length} tools loaded for ${ORGANIZATION_SLUG}`
        )

        toolsCache = filtered
        toolsCacheTime = now
        return filtered
    } catch (error) {
        console.error("Error fetching tools:", error.message)
        return toolsCache || []
    }
}

async function invokeTool(toolName, params) {
    const headers = { "Content-Type": "application/json" }
    if (API_KEY) headers["X-API-Key"] = API_KEY
    if (ORGANIZATION_SLUG) headers["X-Organization-Slug"] = ORGANIZATION_SLUG
    const response = await fetch(`${API_URL}/api/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ method: "tools/call", tool: toolName, params }),
    })

    const data = await response.json()
    if (!data.success) throw new Error(data.error || "Tool invocation failed")
    return data.result
}

const server = new Server(
    { name: "agentc2-agents-lite", version: "1.0.0" },
    { capabilities: { tools: {} } }
)

const toolNameMap = new Map()

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await fetchTools()
    toolNameMap.clear()

    return {
        tools: tools.map((tool) => {
            const safeName = tool.name.replace(/[.-]/g, "_")
            toolNameMap.set(safeName, tool.name)

            return {
                name: safeName,
                description: tool.description || `Invoke ${tool.name}`,
                inputSchema: tool.inputSchema || {
                    type: "object",
                    properties: {},
                    required: [],
                },
            }
        }),
    }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const originalName = toolNameMap.get(name) || name

    try {
        let enrichedArgs = args || {}
        if (originalName.startsWith("agent.")) {
            const agentSlug = originalName.slice(6)
            const threadId = getOrCreateThreadId(agentSlug)
            enrichedArgs = {
                ...enrichedArgs,
                context: { ...(enrichedArgs.context || {}), threadId },
            }
        }
        const result = await invokeTool(originalName, enrichedArgs)

        let outputText = ""
        if (typeof result === "string") {
            outputText = result
        } else if (result?.output) {
            outputText =
                typeof result.output === "string"
                    ? result.output
                    : JSON.stringify(result.output, null, 2)
        } else if (result?.outputText) {
            outputText = result.outputText
        } else {
            outputText = JSON.stringify(result, null, 2)
        }

        const content = [{ type: "text", text: outputText }]

        const runId = result?.runId || result?.run_id
        if (runId || result?.status || result?.duration_ms || result?.durationMs) {
            content.push({
                type: "text",
                text: `\n---\nRun ID: ${runId || "n/a"}\nStatus: ${result?.status || "n/a"}`,
            })
        }

        return { content }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error invoking tool: ${error.message}` }],
            isError: true,
        }
    }
})

async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("AgentC2 MCP Server (Lite) started")
}

main().catch(console.error)
