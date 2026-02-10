/**
 * MCPServer Factory for Claude CoWork (Remote Streamable HTTP)
 *
 * Creates an MCPServer instance that exposes Mastra agents, workflows, and networks
 * as MCP tools accessible via the Streamable HTTP transport. This allows Claude CoWork
 * and other remote MCP clients to connect directly via a public URL.
 *
 * The tools delegate execution to the existing /api/mcp gateway internally,
 * reusing the same authentication and invocation logic that the Cursor stdio
 * MCP server uses.
 */

import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";
import { prisma } from "@repo/database";

/**
 * Internal base URL for calling the /api/mcp gateway.
 * In production we use localhost to avoid DNS/SSL round-trips.
 */
function getInternalBaseUrl(): string {
    if (process.env.NODE_ENV === "production") {
        return "http://localhost:3001";
    }
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
}

/**
 * Invoke a tool via the existing /api/mcp gateway.
 * This reuses the same pattern as scripts/mcp-server/index.js but server-side.
 */
async function invokeMcpGatewayTool(
    toolName: string,
    params: Record<string, unknown>,
    authHeaders: Record<string, string>
): Promise<unknown> {
    const response = await fetch(`${getInternalBaseUrl()}/api/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders
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

/**
 * Format a tool result into a human-readable string.
 * Same logic as the Cursor stdio MCP server.
 */
function formatResult(result: unknown): string {
    if (typeof result === "string") {
        return result;
    }
    const r = result as Record<string, unknown>;
    if (r?.output) {
        return typeof r.output === "string" ? r.output : JSON.stringify(r.output, null, 2);
    }
    if (r?.outputText) {
        return String(r.outputText);
    }
    return JSON.stringify(result, null, 2);
}

interface AgentRecord {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    modelProvider: string;
    modelName: string;
}

interface WorkflowRecord {
    id: string;
    slug: string;
    name: string;
    description: string | null;
}

interface NetworkRecord {
    id: string;
    slug: string;
    name: string;
    description: string | null;
}

/**
 * Build an MCPServer instance that exposes all agents, workflows, and networks
 * for a given organization as MCP tools.
 *
 * @param organizationId - The organization to load primitives for
 * @param authHeaders - Headers to forward to the internal /api/mcp gateway
 */
export async function buildMcpServer(
    organizationId: string,
    authHeaders: Record<string, string>
): Promise<MCPServer> {
    // Load agents from database
    const agents: AgentRecord[] = await prisma.agent.findMany({
        where: {
            isActive: true,
            workspace: { organizationId }
        },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            modelProvider: true,
            modelName: true
        },
        orderBy: { name: "asc" }
    });

    // Load workflows
    const workflows: WorkflowRecord[] = await prisma.workflow.findMany({
        where: {
            isActive: true,
            workspace: { organizationId }
        },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true
        },
        orderBy: { name: "asc" }
    });

    // Load networks
    const networks: NetworkRecord[] = await prisma.network.findMany({
        where: {
            isActive: true,
            workspace: { organizationId }
        },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true
        },
        orderBy: { name: "asc" }
    });

    // Build tool definitions for each agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    for (const agent of agents) {
        const toolId = `ask_${agent.slug.replace(/-/g, "_")}`;
        const agentSlug = agent.slug;
        tools[toolId] = createTool({
            id: toolId,
            description:
                agent.description ||
                `Ask agent ${agent.name} a question (${agent.modelProvider}/${agent.modelName})`,
            inputSchema: z.object({
                input: z.string().describe("The input message or task for the agent"),
                context: z.record(z.unknown()).optional().describe("Optional context variables"),
                maxSteps: z.number().optional().describe("Maximum tool-use steps (optional)")
            }),
            execute: async (inputData) => {
                const result = await invokeMcpGatewayTool(
                    `agent.${agentSlug}`,
                    inputData as Record<string, unknown>,
                    authHeaders
                );
                return formatResult(result);
            }
        });
    }

    // Build tool definitions for each workflow
    for (const workflow of workflows) {
        const toolId = `run_workflow_${workflow.slug.replace(/-/g, "_")}`;
        const workflowSlug = workflow.slug;
        tools[toolId] = createTool({
            id: toolId,
            description: workflow.description || `Execute workflow: ${workflow.name}`,
            inputSchema: z.object({
                input: z.record(z.unknown()).describe("Workflow input payload"),
                source: z.string().optional().describe("Source channel"),
                environment: z.string().optional().describe("Environment"),
                triggerType: z.string().optional().describe("Trigger type")
            }),
            execute: async (inputData) => {
                const result = await invokeMcpGatewayTool(
                    `workflow-${workflowSlug}`,
                    inputData as Record<string, unknown>,
                    authHeaders
                );
                return formatResult(result);
            }
        });
    }

    // Build tool definitions for each network
    for (const network of networks) {
        const toolId = `route_network_${network.slug.replace(/-/g, "_")}`;
        const networkSlug = network.slug;
        tools[toolId] = createTool({
            id: toolId,
            description: network.description || `Route message through network: ${network.name}`,
            inputSchema: z.object({
                message: z.string().describe("Message to route through the network"),
                source: z.string().optional().describe("Source channel"),
                environment: z.string().optional().describe("Environment"),
                threadId: z.string().optional().describe("Optional thread ID"),
                resourceId: z.string().optional().describe("Optional resource ID")
            }),
            execute: async (inputData) => {
                const result = await invokeMcpGatewayTool(
                    `network-${networkSlug}`,
                    inputData as Record<string, unknown>,
                    authHeaders
                );
                return formatResult(result);
            }
        });
    }

    // Create the MCPServer
    const server = new MCPServer({
        id: "mastra-remote-mcp",
        name: "Mastra Agents",
        version: "1.0.0",
        description:
            "Mastra AI Agent platform - exposes agents, workflows, and networks as MCP tools",
        tools
    });

    return server;
}
