import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const orgSlugCache = new Map<string, string>();

const resolveOrgSlug = async (organizationId: string): Promise<string | undefined> => {
    const cached = orgSlugCache.get(organizationId);
    if (cached) return cached;
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true }
    });
    if (org?.slug) {
        orgSlugCache.set(organizationId, org.slug);
        return org.slug;
    }
    return undefined;
};

const buildHeaders = (orgSlugOverride?: string) => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug =
        orgSlugOverride ||
        process.env.MASTRA_ORGANIZATION_SLUG ||
        process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        organizationId?: string;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const orgSlug = options?.organizationId
        ? await resolveOrgSlug(options.organizationId)
        : undefined;

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(orgSlug),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
};

export const skillCreateTool = createTool({
    id: "skill-create",
    description: "Create a skill (composable competency bundle).",
    inputSchema: z.object({
        slug: z.string(),
        name: z.string(),
        instructions: z.string().describe("Procedural knowledge for this skill"),
        description: z.string().optional(),
        examples: z.string().optional().describe("Reference outputs"),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
        organizationId: z.string().optional(),
        workspaceId: z.string().optional(),
        type: z.literal("USER").optional(),
        createdBy: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        slug,
        name,
        instructions,
        description,
        examples,
        category,
        tags,
        metadata,
        organizationId,
        workspaceId,
        type,
        createdBy
    }) => {
        return callInternalApi("/api/skills", {
            method: "POST",
            body: {
                slug,
                name,
                instructions,
                description,
                examples,
                category,
                tags,
                metadata,
                workspaceId,
                type,
                createdBy
            },
            organizationId
        });
    }
});

export const skillReadTool = createTool({
    id: "skill-read",
    description: "Read a skill by ID or slug with its documents and tools.",
    inputSchema: z.object({
        skillId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`, { organizationId });
    }
});

export const skillUpdateTool = createTool({
    id: "skill-update",
    description: "Update a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        name: z.string().optional(),
        instructions: z.string().optional(),
        description: z.string().optional(),
        examples: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        changeSummary: z.string().optional(),
        metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
        organizationId: z.string().optional(),
        createdBy: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, organizationId, ...body }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`, {
            method: "PUT",
            body,
            organizationId
        });
    }
});

export const skillDeleteTool = createTool({
    id: "skill-delete",
    description: "Delete a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`, {
            method: "DELETE",
            organizationId
        });
    }
});

export const skillListTool = createTool({
    id: "skill-list",
    description: "List skills with filters.",
    inputSchema: z.object({
        category: z.string().optional(),
        tags: z.string().optional(),
        type: z.literal("USER").optional(),
        organizationId: z.string().optional(),
        workspaceId: z.string().optional(),
        skip: z.number().optional().describe("Pagination offset"),
        take: z.number().optional().describe("Page size")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category, tags, type, organizationId, workspaceId, skip, take }) => {
        return callInternalApi("/api/skills", {
            query: { category, tags, type, workspaceId, skip, take },
            organizationId
        });
    }
});

export const skillAttachDocumentTool = createTool({
    id: "skill-attach-document",
    description: "Attach a document to a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        documentId: z.string(),
        role: z.string().optional().describe("reference, procedure, example, or context"),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, documentId, role, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/documents`, {
            method: "POST",
            body: { documentId, role },
            organizationId
        });
    }
});

export const skillDetachDocumentTool = createTool({
    id: "skill-detach-document",
    description: "Detach a document from a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        documentId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, documentId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/documents`, {
            method: "DELETE",
            body: { documentId },
            organizationId
        });
    }
});

export const skillAttachToolTool = createTool({
    id: "skill-attach-tool",
    description: "Attach a tool to a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        toolId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, toolId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/tools`, {
            method: "POST",
            body: { toolId },
            organizationId
        });
    }
});

export const skillDetachToolTool = createTool({
    id: "skill-detach-tool",
    description: "Detach a tool from a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        toolId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, toolId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/tools`, {
            method: "DELETE",
            body: { toolId },
            organizationId
        });
    }
});

export const agentAttachSkillTool = createTool({
    id: "agent-attach-skill",
    description:
        "Attach a skill to an agent. Skills are pinned by default (tools injected directly). Set pinned=false for discoverable via meta-tools.",
    inputSchema: z.object({
        agentId: z.string(),
        skillId: z.string(),
        pinned: z
            .boolean()
            .optional()
            .describe(
                "Pin the skill (tools injected directly) vs discoverable (via meta-tools). Default: true."
            ),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, skillId, pinned, organizationId }) => {
        return callInternalApi(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
            method: "POST",
            body: { skillId, ...(pinned !== undefined ? { pinned } : {}) },
            organizationId
        });
    }
});

export const agentSkillUpdateTool = createTool({
    id: "agent-skill-update",
    description:
        "Update a skill's attachment state on an agent (e.g. toggle pinned). skillId accepts ID or slug.",
    inputSchema: z.object({
        agentId: z.string(),
        skillId: z.string(),
        pinned: z
            .boolean()
            .describe("Pin the skill (tools injected directly) vs discoverable (via meta-tools)."),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, skillId, pinned, organizationId }) => {
        return callInternalApi(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
            method: "PATCH",
            body: { skillId, pinned },
            organizationId
        });
    }
});

export const agentDetachSkillTool = createTool({
    id: "agent-detach-skill",
    description: "Detach a skill from an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        skillId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, skillId, organizationId }) => {
        return callInternalApi(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
            method: "DELETE",
            body: { skillId },
            organizationId
        });
    }
});

export const skillGetVersionsTool = createTool({
    id: "skill-get-versions",
    description: "Get version history for a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, organizationId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/versions`, {
            organizationId
        });
    }
});
