import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean() }).passthrough();

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
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

export const orgListTool = createTool({
    id: "org-list",
    description: "List organizations.",
    inputSchema: z.object({}),
    outputSchema: baseOutputSchema,
    execute: async () => {
        return callInternalApi("/api/organizations");
    }
});

export const orgGetTool = createTool({
    id: "org-get",
    description: "Get a single organization.",
    inputSchema: z.object({
        orgId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ orgId }) => {
        return callInternalApi(`/api/organizations/${orgId}`);
    }
});

export const orgMembersListTool = createTool({
    id: "org-members-list",
    description: "List members of an organization.",
    inputSchema: z.object({
        orgId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ orgId }) => {
        return callInternalApi(`/api/organizations/${orgId}/members`);
    }
});

export const orgMemberAddTool = createTool({
    id: "org-member-add",
    description: "Add a member to an organization.",
    inputSchema: z.object({
        orgId: z.string(),
        userId: z.string(),
        role: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ orgId, userId, role }) => {
        return callInternalApi(`/api/organizations/${orgId}/members`, {
            method: "POST",
            body: { userId, role }
        });
    }
});

export const orgWorkspacesListTool = createTool({
    id: "org-workspaces-list",
    description: "List workspaces for an organization.",
    inputSchema: z.object({
        orgId: z.string()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ orgId }) => {
        return callInternalApi(`/api/organizations/${orgId}/workspaces`);
    }
});

export const orgWorkspaceCreateTool = createTool({
    id: "org-workspace-create",
    description: "Create a new workspace in an organization.",
    inputSchema: z.object({
        orgId: z.string(),
        name: z.string(),
        slug: z.string().optional(),
        environment: z.string().optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ orgId, name, slug, environment, description, isDefault }) => {
        return callInternalApi(`/api/organizations/${orgId}/workspaces`, {
            method: "POST",
            body: { name, slug, environment, description, isDefault }
        });
    }
});
