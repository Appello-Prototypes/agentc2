import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
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

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
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
        tags: z.array(z.string()).optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, name, instructions, description, examples, category, tags }) => {
        return callInternalApi("/api/skills", {
            method: "POST",
            body: { slug, name, instructions, description, examples, category, tags }
        });
    }
});

export const skillReadTool = createTool({
    id: "skill-read",
    description: "Read a skill by ID or slug with its documents and tools.",
    inputSchema: z.object({
        skillId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`);
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
        changeSummary: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, ...body }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`, {
            method: "PUT",
            body
        });
    }
});

export const skillDeleteTool = createTool({
    id: "skill-delete",
    description: "Delete a skill.",
    inputSchema: z.object({
        skillId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}`, {
            method: "DELETE"
        });
    }
});

export const skillListTool = createTool({
    id: "skill-list",
    description: "List skills with filters.",
    inputSchema: z.object({
        category: z.string().optional(),
        tags: z.string().optional(),
        type: z.enum(["USER", "SYSTEM"]).optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category, tags, type }) => {
        return callInternalApi("/api/skills", { query: { category, tags, type } });
    }
});

export const skillAttachDocumentTool = createTool({
    id: "skill-attach-document",
    description: "Attach a document to a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        documentId: z.string(),
        role: z.string().optional().describe("reference, procedure, example, or context")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, documentId, role }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/documents`, {
            method: "POST",
            body: { documentId, role }
        });
    }
});

export const skillDetachDocumentTool = createTool({
    id: "skill-detach-document",
    description: "Detach a document from a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        documentId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, documentId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/documents`, {
            method: "DELETE",
            body: { documentId }
        });
    }
});

export const skillAttachToolTool = createTool({
    id: "skill-attach-tool",
    description: "Attach a tool to a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        toolId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, toolId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/tools`, {
            method: "POST",
            body: { toolId }
        });
    }
});

export const skillDetachToolTool = createTool({
    id: "skill-detach-tool",
    description: "Detach a tool from a skill.",
    inputSchema: z.object({
        skillId: z.string(),
        toolId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ skillId, toolId }) => {
        return callInternalApi(`/api/skills/${encodeURIComponent(skillId)}/tools`, {
            method: "DELETE",
            body: { toolId }
        });
    }
});

export const agentAttachSkillTool = createTool({
    id: "agent-attach-skill",
    description: "Attach a skill to an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        skillId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, skillId }) => {
        return callInternalApi(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
            method: "POST",
            body: { skillId }
        });
    }
});

export const agentDetachSkillTool = createTool({
    id: "agent-detach-skill",
    description: "Detach a skill from an agent.",
    inputSchema: z.object({
        agentId: z.string(),
        skillId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ agentId, skillId }) => {
        return callInternalApi(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
            method: "DELETE",
            body: { skillId }
        });
    }
});
