/**
 * Webhook Tools
 *
 * Tools for the webhook-wizard agent to list agents and create webhooks.
 * These tools are registered in the tool registry and attached to the
 * webhook-wizard SYSTEM agent via the database seed.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "../mcp/client";

/**
 * List Agents Tool - Lists all active agents in the system
 */
export const webhookListAgentsTool = createTool({
    id: "webhook-list-agents",
    description:
        "List all available active agents that can be wired to a webhook trigger. Returns agent slug, name, and description.",
    inputSchema: z.object({
        _unused: z.string().optional().describe("Unused parameter - call with empty object")
    }),
    outputSchema: z.object({
        agents: z
            .array(
                z.object({
                    id: z.string(),
                    slug: z.string(),
                    name: z.string(),
                    description: z.string().nullable()
                })
            )
            .describe("List of available agents")
    }),
    execute: async () => {
        const agents = await prisma.agent.findMany({
            where: { isActive: true },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true
            },
            orderBy: { name: "asc" }
        });

        return {
            agents: agents.map((a) => ({
                id: a.id,
                slug: a.slug,
                name: a.name,
                description: a.description?.slice(0, 120) || null
            }))
        };
    }
});

/**
 * Create Webhook Tool - Creates a webhook trigger wired to an agent
 *
 * Requires organizationId to be passed in (injected via the system prompt
 * from the authenticated user's session). This ensures webhooks are always
 * created under the correct tenant.
 */
export const webhookCreateTool = createTool({
    id: "webhook-create",
    description:
        "Create a new webhook trigger wired to an agent. Generates a unique URL and HMAC secret. You MUST pass the organizationId provided in your system context.",
    inputSchema: z.object({
        organizationId: z
            .string()
            .describe(
                "The organization ID of the current user. Use the value from your system context."
            ),
        agentSlug: z.string().describe("The slug of the agent to wire the webhook to"),
        name: z.string().describe("Short name for the webhook (2-5 words)"),
        description: z
            .string()
            .optional()
            .describe("One-sentence description of what this webhook does"),
        filterJson: z
            .string()
            .optional()
            .describe(
                "Stringified JSON filter conditions for matching incoming payloads. Use {} for no filtering."
            ),
        inputMappingJson: z
            .string()
            .optional()
            .describe(
                'Stringified JSON input mapping to extract agent input from payload. Supports "template", "field", or "jsonPath" keys.'
            )
    }),
    outputSchema: z.object({
        success: z.boolean(),
        webhookUrl: z.string().optional(),
        webhookSecret: z.string().optional(),
        agentName: z.string().optional(),
        agentSlug: z.string().optional(),
        webhookName: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({
        organizationId,
        agentSlug,
        name,
        description,
        filterJson,
        inputMappingJson
    }) => {
        try {
            if (!organizationId) {
                return {
                    success: false,
                    error: "organizationId is required. It should be provided in your system context."
                };
            }

            // Parse JSON strings
            let filter: Record<string, unknown> | null = null;
            let inputMapping: Record<string, unknown> | null = null;

            try {
                if (filterJson) {
                    filter = JSON.parse(filterJson);
                }
            } catch {
                return { success: false, error: "Invalid filter JSON" };
            }

            try {
                if (inputMappingJson) {
                    inputMapping = JSON.parse(inputMappingJson);
                }
            } catch {
                return {
                    success: false,
                    error: "Invalid input mapping JSON"
                };
            }

            // Find agent - scoped to the user's organization
            const agent = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: agentSlug }, { id: agentSlug }],
                    isActive: true
                },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    workspaceId: true
                }
            });

            if (!agent) {
                return {
                    success: false,
                    error: `Agent "${agentSlug}" not found or is inactive`
                };
            }

            // Validate input mapping structure if provided
            if (inputMapping) {
                const allowedKeys = ["template", "field", "jsonPath", "config"];
                const keys = Object.keys(inputMapping);
                const hasDisallowed = keys.some((key) => !allowedKeys.includes(key));
                if (hasDisallowed) {
                    return {
                        success: false,
                        error: "inputMapping must only contain: template, field, jsonPath, or config"
                    };
                }
            }

            // Ensure webhook provider exists
            await getIntegrationProviders();
            const webhookProvider = await prisma.integrationProvider.findUnique({
                where: { key: "webhook" }
            });
            if (!webhookProvider) {
                return {
                    success: false,
                    error: "Webhook provider not configured in the system"
                };
            }

            // Generate unique path and secret
            const webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
            const webhookSecret = randomBytes(32).toString("hex");

            // Create trigger
            const trigger = await prisma.agentTrigger.create({
                data: {
                    agentId: agent.id,
                    workspaceId: agent.workspaceId,
                    name,
                    description: description || null,
                    triggerType: "webhook",
                    webhookPath,
                    webhookSecret,
                    filterJson: filter ? JSON.parse(JSON.stringify(filter)) : null,
                    inputMapping: inputMapping ? JSON.parse(JSON.stringify(inputMapping)) : null,
                    isActive: true
                }
            });

            // Create connection under the user's organization
            await prisma.integrationConnection.create({
                data: {
                    providerId: webhookProvider.id,
                    organizationId,
                    scope: "org",
                    name,
                    isDefault: false,
                    isActive: true,
                    webhookPath,
                    webhookSecret,
                    agentTriggerId: trigger.id,
                    metadata: {
                        agentId: agent.id,
                        agentSlug: agent.slug,
                        triggerId: trigger.id
                    }
                }
            });

            return {
                success: true,
                webhookUrl: `/api/webhooks/${webhookPath}`,
                webhookSecret,
                agentName: agent.name,
                agentSlug: agent.slug,
                webhookName: name
            };
        } catch (error) {
            console.error("[Webhook Create Tool] Error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create webhook"
            };
        }
    }
});
