/**
 * Federation tool loader.
 *
 * Makes federated agents appear as regular tools in the tool registry.
 * Follows the same caching pattern as MCP tools.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { discoverFederatedAgents } from "./agent-cards";
import type { AgentCard } from "./types";

const FEDERATION_CACHE_TTL = 60_000; // 1 minute, same as MCP tools

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const federatedToolsCache = new Map<string, { tools: Record<string, any>; loadedAt: number }>();

/**
 * Build a Mastra tool from an Agent Card.
 * The tool wraps the federation gateway invocation.
 */
function buildFederatedTool(card: AgentCard) {
    const toolId = `federation:${card.provider.orgSlug}:${card.agentc2.agentSlug}`;

    return createTool({
        id: toolId,
        description:
            `[Federation: ${card.provider.organization}] ${card.name}` +
            (card.description ? ` -- ${card.description}` : ""),
        inputSchema: z.object({
            message: z.string().describe("The message or query to send to the federated agent"),
            conversationId: z
                .string()
                .optional()
                .describe("Optional conversation thread ID for multi-turn conversations")
        }),
        outputSchema: z.object({
            success: z.boolean(),
            response: z.string(),
            conversationId: z.string(),
            latencyMs: z.number(),
            error: z.string().optional()
        }),
        execute: async () => {
            // The actual invocation goes through the Federation Gateway.
            // This is a placeholder -- the real execution is wired up in the
            // API route layer where we have access to the gateway and org context.
            // The tool registry returns these tools with metadata; the agent resolver
            // intercepts federation:* tools and routes them through the gateway.
            return {
                success: false,
                response: "",
                conversationId: "",
                latencyMs: 0,
                error: "Federation tool must be invoked through the Federation Gateway"
            };
        }
    });
}

/**
 * Get all federated tools available to an organization.
 * Cached with the same TTL as MCP tools.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFederatedTools(organizationId: string): Promise<Record<string, any>> {
    const cacheKey = organizationId;
    const now = Date.now();
    const cached = federatedToolsCache.get(cacheKey);

    if (cached && now - cached.loadedAt < FEDERATION_CACHE_TTL) {
        return cached.tools;
    }

    try {
        const cards = await discoverFederatedAgents(organizationId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: Record<string, any> = {};

        for (const card of cards) {
            const toolId = `federation:${card.provider.orgSlug}:${card.agentc2.agentSlug}`;
            tools[toolId] = buildFederatedTool(card);
        }

        federatedToolsCache.set(cacheKey, { tools, loadedAt: now });
        return tools;
    } catch (error) {
        console.warn("[Federation] Failed to load federated tools:", error);
        return {};
    }
}

/**
 * Invalidate the federation tool cache for an org.
 * Called when a federation agreement is created/approved/revoked.
 */
export function invalidateFederationToolsCache(organizationId: string): void {
    federatedToolsCache.delete(organizationId);
}

/**
 * Invalidate all federation tool caches.
 */
export function invalidateAllFederationToolsCaches(): void {
    federatedToolsCache.clear();
}

/**
 * Check if a tool ID represents a federated tool.
 */
export function isFederatedToolId(toolId: string): boolean {
    return toolId.startsWith("federation:");
}

/**
 * Parse a federation tool ID into its components.
 */
export function parseFederatedToolId(toolId: string): {
    orgSlug: string;
    agentSlug: string;
} | null {
    const parts = toolId.split(":");
    if (parts.length !== 3 || parts[0] !== "federation") return null;
    return { orgSlug: parts[1]!, agentSlug: parts[2]! };
}
