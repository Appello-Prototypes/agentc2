/**
 * Infrastructure Tracking Tools
 *
 * Tools for agents to record, list, and manage provisioned infrastructure
 * resources (droplets, databases, domains, etc.) created via the sandbox.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";

const resourceSchema = z.object({
    id: z.string(),
    provider: z.string(),
    resourceType: z.string(),
    externalId: z.string(),
    name: z.string(),
    status: z.string(),
    monthlyCostUsd: z.number().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.string(),
    destroyedAt: z.string().nullable()
});

// ─── track-resource ──────────────────────────────────────────────────────────

export const trackResourceTool = createTool({
    id: "track-resource",
    description:
        "Record a provisioned infrastructure resource. Call this after creating " +
        "a droplet, database, domain, or other cloud resource so the platform " +
        "can track it for cost monitoring and lifecycle management.",
    inputSchema: z.object({
        provider: z
            .string()
            .describe("Cloud provider (e.g., 'digitalocean', 'supabase', 'custom')"),
        resourceType: z
            .string()
            .describe("Resource type (e.g., 'droplet', 'database', 'domain', 'ssh-key', 'app')"),
        externalId: z.string().describe("The provider's resource ID"),
        name: z.string().describe("Human-readable name for the resource"),
        metadata: z
            .record(z.unknown())
            .optional()
            .describe("Additional metadata (IP address, connection string, region, specs, etc.)"),
        monthlyCostUsd: z.number().optional().describe("Estimated monthly cost in USD"),
        agentId: z.string().optional().describe("Agent that created this resource"),
        runId: z.string().optional().describe("Run ID that created this resource"),
        organizationId: z.string().optional().describe("Organization ID (auto-detected if omitted)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        resourceId: z.string()
    }),
    execute: async ({
        provider,
        resourceType,
        externalId,
        name,
        metadata,
        monthlyCostUsd,
        agentId,
        runId,
        organizationId
    }) => {
        const orgId = organizationId || (await getDefaultOrgId());

        const resource = await prisma.provisionedResource.create({
            data: {
                organizationId: orgId,
                agentId: agentId || null,
                runId: runId || null,
                provider,
                resourceType,
                externalId,
                name,
                metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
                monthlyCostUsd: monthlyCostUsd ?? null,
                status: "active"
            }
        });

        return { success: true, resourceId: resource.id };
    }
});

// ─── list-resources ──────────────────────────────────────────────────────────

export const listResourcesTool = createTool({
    id: "list-resources",
    description:
        "List all provisioned infrastructure resources. Optionally filter by " +
        "provider, type, or status. Shows what infrastructure agents have created.",
    inputSchema: z.object({
        provider: z.string().optional().describe("Filter by provider (e.g., 'digitalocean')"),
        resourceType: z.string().optional().describe("Filter by type (e.g., 'droplet')"),
        status: z
            .enum(["active", "destroyed", "error"])
            .optional()
            .describe("Filter by status. Default: active"),
        organizationId: z.string().optional()
    }),
    outputSchema: z.object({
        count: z.number(),
        resources: z.array(resourceSchema),
        totalMonthlyCost: z.number().nullable()
    }),
    execute: async ({ provider, resourceType, status, organizationId }) => {
        const orgId = organizationId || (await getDefaultOrgId());

        const resources = await prisma.provisionedResource.findMany({
            where: {
                organizationId: orgId,
                ...(provider ? { provider } : {}),
                ...(resourceType ? { resourceType } : {}),
                status: status ?? "active"
            },
            orderBy: { createdAt: "desc" }
        });

        const totalMonthlyCost = resources.reduce((sum, r) => sum + (r.monthlyCostUsd ?? 0), 0);

        return {
            count: resources.length,
            resources: resources.map((r) => ({
                id: r.id,
                provider: r.provider,
                resourceType: r.resourceType,
                externalId: r.externalId,
                name: r.name,
                status: r.status,
                monthlyCostUsd: r.monthlyCostUsd,
                metadata: r.metadata,
                createdAt: r.createdAt.toISOString(),
                destroyedAt: r.destroyedAt?.toISOString() ?? null
            })),
            totalMonthlyCost: totalMonthlyCost || null
        };
    }
});

// ─── destroy-resource ────────────────────────────────────────────────────────

export const destroyResourceTool = createTool({
    id: "destroy-resource",
    description:
        "Mark a provisioned resource as destroyed. Call this AFTER tearing down " +
        "the resource via the cloud provider CLI (e.g., doctl compute droplet delete). " +
        "This updates the platform's tracking record.",
    inputSchema: z.object({
        resourceId: z.string().describe("The platform resource ID (from list-resources)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        name: z.string(),
        provider: z.string()
    }),
    execute: async ({ resourceId }) => {
        const resource = await prisma.provisionedResource.update({
            where: { id: resourceId },
            data: {
                status: "destroyed",
                destroyedAt: new Date()
            }
        });

        return {
            success: true,
            name: resource.name,
            provider: resource.provider
        };
    }
});

async function getDefaultOrgId(): Promise<string> {
    const org = await prisma.organization.findFirst({
        where: { status: "active" },
        select: { id: true },
        orderBy: { createdAt: "asc" }
    });
    if (!org) throw new Error("No active organization found");
    return org.id;
}
