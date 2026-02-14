import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({}).passthrough();

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

export const campaignCreateTool = createTool({
    id: "campaign-create",
    description:
        "Create a new campaign using Mission Command principles. Define WHAT to achieve (intent + end state), and the platform autonomously decomposes into missions, assigns agents, executes, and generates After Action Reviews.",
    inputSchema: z.object({
        name: z.string().describe("Campaign name"),
        intent: z
            .string()
            .describe(
                "Commander's intent: WHAT to achieve, not HOW. The platform determines the approach autonomously."
            ),
        endState: z
            .string()
            .describe(
                "Observable conditions that define success — what the world looks like when the campaign is done."
            ),
        description: z.string().optional().describe("Additional context or background"),
        constraints: z
            .array(z.string())
            .optional()
            .describe("Restrictions on HOW (must/must not rules)"),
        restraints: z.array(z.string()).optional().describe("Limitations on resources or approach"),
        requireApproval: z
            .boolean()
            .optional()
            .describe("If true, pauses for human approval before execution. Default: false."),
        maxCostUsd: z.number().optional().describe("Maximum cost budget in USD"),
        timeoutMinutes: z.number().optional().describe("Maximum execution time in minutes")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        name,
        intent,
        endState,
        description,
        constraints,
        restraints,
        requireApproval,
        maxCostUsd,
        timeoutMinutes
    }) => {
        return callInternalApi("/api/campaigns", {
            method: "POST",
            body: {
                name,
                intent,
                endState,
                description,
                constraints,
                restraints,
                requireApproval,
                maxCostUsd,
                timeoutMinutes
            }
        });
    }
});

export const campaignListTool = createTool({
    id: "campaign-list",
    description:
        "List all campaigns with optional status filter and pagination. Returns campaigns with their missions summary.",
    inputSchema: z.object({
        status: z
            .enum([
                "PLANNING",
                "ANALYZING",
                "READY",
                "EXECUTING",
                "REVIEWING",
                "COMPLETE",
                "FAILED",
                "PAUSED"
            ])
            .optional()
            .describe("Filter by campaign status"),
        limit: z.number().optional().describe("Max results per page (default: 50)"),
        offset: z.number().optional().describe("Pagination offset (default: 0)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ status, limit, offset }) => {
        return callInternalApi("/api/campaigns", {
            query: { status, limit, offset }
        });
    }
});

export const campaignGetTool = createTool({
    id: "campaign-get",
    description:
        "Get full campaign details including missions, tasks, evaluations, After Action Reviews, and activity logs.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ campaignId }) => {
        return callInternalApi(`/api/campaigns/${campaignId}`);
    }
});

export const campaignUpdateTool = createTool({
    id: "campaign-update",
    description:
        "Update a campaign's configuration or perform lifecycle actions. Actions: 'approve' starts a READY campaign, 'cancel' stops a running campaign, 'resume' restarts a PAUSED campaign. Field updates only allowed in PLANNING or READY status.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID"),
        action: z
            .enum(["approve", "cancel", "resume"])
            .optional()
            .describe("Lifecycle action to perform"),
        name: z.string().optional().describe("Update campaign name"),
        intent: z.string().optional().describe("Update intent"),
        endState: z.string().optional().describe("Update end state"),
        description: z.string().optional().describe("Update description"),
        constraints: z.array(z.string()).optional().describe("Update constraints"),
        restraints: z.array(z.string()).optional().describe("Update restraints"),
        requireApproval: z.boolean().optional().describe("Update approval requirement"),
        maxCostUsd: z.number().optional().describe("Update cost budget"),
        timeoutMinutes: z.number().optional().describe("Update timeout")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        campaignId,
        action,
        name,
        intent,
        endState,
        description,
        constraints,
        restraints,
        requireApproval,
        maxCostUsd,
        timeoutMinutes
    }) => {
        const body: Record<string, unknown> = {};
        if (action) body.action = action;
        if (name !== undefined) body.name = name;
        if (intent !== undefined) body.intent = intent;
        if (endState !== undefined) body.endState = endState;
        if (description !== undefined) body.description = description;
        if (constraints !== undefined) body.constraints = constraints;
        if (restraints !== undefined) body.restraints = restraints;
        if (requireApproval !== undefined) body.requireApproval = requireApproval;
        if (maxCostUsd !== undefined) body.maxCostUsd = maxCostUsd;
        if (timeoutMinutes !== undefined) body.timeoutMinutes = timeoutMinutes;

        return callInternalApi(`/api/campaigns/${campaignId}`, {
            method: "PATCH",
            body
        });
    }
});

export const campaignDeleteTool = createTool({
    id: "campaign-delete",
    description:
        "Delete a campaign and all related data (missions, tasks, logs). Cannot delete campaigns in EXECUTING status — cancel first.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ campaignId }) => {
        return callInternalApi(`/api/campaigns/${campaignId}`, {
            method: "DELETE"
        });
    }
});
