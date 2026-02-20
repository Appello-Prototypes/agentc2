/**
 * Agent Instance Management Tools
 *
 * MCP-exposed tools for creating, managing, and binding agent instances
 * to communication channels. Enables per-customer/per-deal agent deployments
 * with isolated memory, instruction overrides, and channel bindings.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const channelTypeSchema = z.enum(["slack", "email", "whatsapp", "web", "voice"]);

export const instanceListTool = createTool({
    id: "instance-list",
    description:
        "List agent instances for the organization. Optionally filter by agent, " +
        "context type, or active status.",
    inputSchema: z.object({
        organizationId: z.string().describe("Organization ID"),
        agentId: z.string().optional().describe("Filter by parent agent ID"),
        agentSlug: z
            .string()
            .optional()
            .describe("Filter by parent agent slug (alternative to agentId)"),
        contextType: z
            .string()
            .optional()
            .describe("Filter by context type (deal, customer, project)"),
        isActive: z.boolean().optional().describe("Filter by active status")
    }),
    outputSchema: z.object({
        instances: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                agentId: z.string(),
                agentSlug: z.string().nullable(),
                agentName: z.string().nullable(),
                contextType: z.string().nullable(),
                contextId: z.string().nullable(),
                memoryNamespace: z.string(),
                isActive: z.boolean(),
                channelBindingCount: z.number(),
                createdAt: z.string()
            })
        ),
        total: z.number()
    }),
    execute: async ({ organizationId, agentId, agentSlug, contextType, isActive }) => {
        const { prisma } = await import("@repo/database");

        let resolvedAgentId = agentId;
        if (!resolvedAgentId && agentSlug) {
            const agent = await prisma.agent.findFirst({
                where: { slug: agentSlug, workspace: { organizationId } },
                select: { id: true }
            });
            resolvedAgentId = agent?.id || undefined;
        }

        const instances = await prisma.agentInstance.findMany({
            where: {
                organizationId,
                ...(resolvedAgentId ? { agentId: resolvedAgentId } : {}),
                ...(contextType ? { contextType } : {}),
                ...(isActive !== undefined ? { isActive } : {})
            },
            include: {
                agent: { select: { slug: true, name: true } },
                channelBindings: { select: { id: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        return {
            instances: instances.map((i) => ({
                id: i.id,
                name: i.name,
                slug: i.slug,
                agentId: i.agentId,
                agentSlug: i.agent.slug,
                agentName: i.agent.name,
                contextType: i.contextType,
                contextId: i.contextId,
                memoryNamespace: i.memoryNamespace,
                isActive: i.isActive,
                channelBindingCount: i.channelBindings.length,
                createdAt: i.createdAt.toISOString()
            })),
            total: instances.length
        };
    }
});

export const instanceGetTool = createTool({
    id: "instance-get",
    description:
        "Get full details of an agent instance including channel bindings, " +
        "instruction overrides, context data, and memory namespace.",
    inputSchema: z.object({
        instanceId: z.string().optional().describe("Instance ID"),
        instanceSlug: z.string().optional().describe("Instance slug (alternative to instanceId)"),
        organizationId: z.string().optional().describe("Organization ID (required with slug)")
    }),
    outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        agentId: z.string(),
        agentSlug: z.string().nullable(),
        agentName: z.string().nullable(),
        organizationId: z.string(),
        contextType: z.string().nullable(),
        contextId: z.string().nullable(),
        contextData: z.unknown().nullable(),
        instructionOverrides: z.string().nullable(),
        memoryNamespace: z.string(),
        ragCollectionId: z.string().nullable(),
        temperatureOverride: z.number().nullable(),
        maxStepsOverride: z.number().nullable(),
        isActive: z.boolean(),
        version: z.number(),
        metadata: z.unknown().nullable(),
        channelBindings: z.array(
            z.object({
                id: z.string(),
                channelType: z.string(),
                channelIdentifier: z.string(),
                channelName: z.string().nullable(),
                triggerOnAllMessages: z.boolean(),
                triggerKeywords: z.array(z.string()),
                isActive: z.boolean()
            })
        ),
        createdAt: z.string()
    }),
    execute: async ({ instanceId, instanceSlug, organizationId }) => {
        const { prisma } = await import("@repo/database");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = instanceId
            ? { id: instanceId }
            : instanceSlug && organizationId
              ? { organizationId_slug: { organizationId, slug: instanceSlug } }
              : null;

        if (!where) {
            throw new Error("Provide either instanceId or instanceSlug + organizationId");
        }

        const instance = await prisma.agentInstance.findUniqueOrThrow({
            where,
            include: {
                agent: { select: { slug: true, name: true } },
                channelBindings: true
            }
        });

        return {
            id: instance.id,
            name: instance.name,
            slug: instance.slug,
            agentId: instance.agentId,
            agentSlug: instance.agent.slug,
            agentName: instance.agent.name,
            organizationId: instance.organizationId,
            contextType: instance.contextType,
            contextId: instance.contextId,
            contextData: instance.contextData,
            instructionOverrides: instance.instructionOverrides,
            memoryNamespace: instance.memoryNamespace,
            ragCollectionId: instance.ragCollectionId,
            temperatureOverride: instance.temperatureOverride,
            maxStepsOverride: instance.maxStepsOverride,
            isActive: instance.isActive,
            version: instance.version,
            metadata: instance.metadata,
            channelBindings: instance.channelBindings.map((b) => ({
                id: b.id,
                channelType: b.channelType,
                channelIdentifier: b.channelIdentifier,
                channelName: b.channelName,
                triggerOnAllMessages: b.triggerOnAllMessages,
                triggerKeywords: b.triggerKeywords,
                isActive: b.isActive
            })),
            createdAt: instance.createdAt.toISOString()
        };
    }
});

export const instanceCreateTool = createTool({
    id: "instance-create",
    description:
        "Create a new agent instance with isolated memory and optional instruction overrides. " +
        "Each instance gets its own memory namespace for conversation isolation.",
    inputSchema: z.object({
        agentId: z.string().optional().describe("Parent agent ID"),
        agentSlug: z.string().optional().describe("Parent agent slug (alternative to agentId)"),
        organizationId: z.string().describe("Organization ID"),
        name: z.string().describe("Human-readable name (e.g., 'Owens Insulation Bot')"),
        slug: z
            .string()
            .describe("URL-safe slug (e.g., 'owens-insulation'). Must be unique within the org."),
        contextType: z
            .string()
            .optional()
            .describe("Context type: deal, customer, project, or custom"),
        contextId: z
            .string()
            .optional()
            .describe("External ID for context (e.g., HubSpot deal ID)"),
        contextData: z
            .record(z.unknown())
            .optional()
            .describe("Cached context data (e.g., company name, deal stage)"),
        instructionOverrides: z
            .string()
            .optional()
            .describe("Additional instructions appended to the base agent's instructions"),
        temperatureOverride: z.number().optional().describe("Override the agent's temperature"),
        maxStepsOverride: z.number().optional().describe("Override the agent's maxSteps")
    }),
    outputSchema: z.object({
        id: z.string(),
        slug: z.string(),
        memoryNamespace: z.string(),
        message: z.string()
    }),
    execute: async ({
        agentId,
        agentSlug,
        organizationId,
        name,
        slug,
        contextType,
        contextId,
        contextData,
        instructionOverrides,
        temperatureOverride,
        maxStepsOverride
    }) => {
        const { prisma } = await import("@repo/database");

        let resolvedAgentId = agentId;
        if (!resolvedAgentId && agentSlug) {
            const agent = await prisma.agent.findFirst({
                where: { slug: agentSlug, workspace: { organizationId } },
                select: { id: true }
            });
            if (!agent) throw new Error(`Agent not found: ${agentSlug}`);
            resolvedAgentId = agent.id;
        }
        if (!resolvedAgentId) {
            throw new Error("Provide either agentId or agentSlug");
        }

        const memoryNamespace = `instance-${slug}-${Date.now().toString(36)}`;

        const instance = await prisma.agentInstance.create({
            data: {
                agentId: resolvedAgentId,
                organizationId,
                name,
                slug,
                contextType,
                contextId,
                contextData: contextData ? JSON.parse(JSON.stringify(contextData)) : undefined,
                instructionOverrides,
                memoryNamespace,
                temperatureOverride,
                maxStepsOverride
            }
        });

        return {
            id: instance.id,
            slug: instance.slug,
            memoryNamespace: instance.memoryNamespace,
            message: `Instance "${name}" created with memory namespace "${instance.memoryNamespace}"`
        };
    }
});

export const instanceUpdateTool = createTool({
    id: "instance-update",
    description:
        "Update an agent instance's configuration (name, context, instruction overrides, " +
        "temperature, maxSteps, active status).",
    inputSchema: z.object({
        instanceId: z.string().describe("Instance ID"),
        name: z.string().optional(),
        contextType: z.string().nullable().optional(),
        contextId: z.string().nullable().optional(),
        contextData: z.record(z.unknown()).nullable().optional(),
        instructionOverrides: z.string().nullable().optional(),
        temperatureOverride: z.number().nullable().optional(),
        maxStepsOverride: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        metadata: z.record(z.unknown()).nullable().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    execute: async ({ instanceId, ...data }) => {
        const { prisma } = await import("@repo/database");

        // Build update payload, only including provided fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.contextType !== undefined) updateData.contextType = data.contextType;
        if (data.contextId !== undefined) updateData.contextId = data.contextId;
        if (data.contextData !== undefined) updateData.contextData = data.contextData;
        if (data.instructionOverrides !== undefined)
            updateData.instructionOverrides = data.instructionOverrides;
        if (data.temperatureOverride !== undefined)
            updateData.temperatureOverride = data.temperatureOverride;
        if (data.maxStepsOverride !== undefined)
            updateData.maxStepsOverride = data.maxStepsOverride;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        await prisma.agentInstance.update({
            where: { id: instanceId },
            data: updateData
        });

        return { success: true, message: `Instance ${instanceId} updated` };
    }
});

export const instanceDeleteTool = createTool({
    id: "instance-delete",
    description:
        "Delete an agent instance and all its channel bindings. " +
        "This is irreversible — the memory namespace and conversation history remain " +
        "but the instance configuration is removed.",
    inputSchema: z.object({
        instanceId: z.string().describe("Instance ID to delete")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    execute: async ({ instanceId }) => {
        const { prisma } = await import("@repo/database");
        await prisma.agentInstance.delete({ where: { id: instanceId } });
        return { success: true, message: `Instance ${instanceId} deleted` };
    }
});

export const instanceBindChannelTool = createTool({
    id: "instance-bind-channel",
    description:
        "Bind an agent instance to a communication channel (Slack, email, WhatsApp, etc.). " +
        "Messages in this channel will be routed to the instance's agent with its " +
        "specific memory namespace and instruction overrides.",
    inputSchema: z.object({
        instanceId: z.string().describe("Instance ID"),
        channelType: channelTypeSchema.describe("Channel type"),
        channelIdentifier: z
            .string()
            .describe("Channel identifier (e.g., Slack channel ID like C0123456789)"),
        channelName: z
            .string()
            .optional()
            .describe("Human-readable channel name (e.g., '#big-jim-2')"),
        triggerOnAllMessages: z
            .boolean()
            .optional()
            .describe("Respond to all messages without requiring @mention (default: false)"),
        triggerKeywords: z
            .array(z.string())
            .optional()
            .describe("Keywords that trigger a response (case-insensitive)"),
        triggerOnFileUpload: z
            .boolean()
            .optional()
            .describe("Trigger on file uploads (default: false)"),
        allowedUserIds: z
            .array(z.string())
            .optional()
            .describe("Restrict to these user IDs (empty = allow all)"),
        blockedUserIds: z.array(z.string()).optional().describe("Block these user IDs")
    }),
    outputSchema: z.object({
        bindingId: z.string(),
        message: z.string()
    }),
    execute: async ({
        instanceId,
        channelType,
        channelIdentifier,
        channelName,
        triggerOnAllMessages,
        triggerKeywords,
        triggerOnFileUpload,
        allowedUserIds,
        blockedUserIds
    }) => {
        const { prisma } = await import("@repo/database");

        const binding = await prisma.instanceChannelBinding.create({
            data: {
                instanceId,
                channelType,
                channelIdentifier,
                channelName,
                triggerOnAllMessages,
                triggerKeywords,
                triggerOnFileUpload,
                allowedUserIds,
                blockedUserIds
            }
        });

        return {
            bindingId: binding.id,
            message: `Bound to ${channelType} channel "${channelName || channelIdentifier}"${triggerOnAllMessages ? " (responds to all messages)" : ""}`
        };
    }
});

export const instanceUnbindChannelTool = createTool({
    id: "instance-unbind-channel",
    description: "Remove a channel binding from an agent instance.",
    inputSchema: z.object({
        bindingId: z.string().describe("Channel binding ID to remove")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    execute: async ({ bindingId }) => {
        const { prisma } = await import("@repo/database");
        await prisma.instanceChannelBinding.delete({
            where: { id: bindingId }
        });
        return { success: true, message: `Binding ${bindingId} removed` };
    }
});
