import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { BLOCK_TYPES } from "../canvas/schema";

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

// ─────────────────────────────────────────────────────────────────────────────
// Canvas CRUD Tools
// ─────────────────────────────────────────────────────────────────────────────

export const canvasCreateTool = createTool({
    id: "canvas-create",
    description:
        "Create a new canvas (dashboard, report, or interactive UI) with components and data bindings. " +
        "The canvas is stored in the database and immediately viewable at /canvas/{slug}. " +
        "Use canvas-list-blocks to see available component types and canvas-query-preview to test data queries before building.",
    inputSchema: z.object({
        slug: z
            .string()
            .describe("URL-safe identifier for the canvas (e.g., 'deal-pipeline-dashboard')"),
        title: z.string().describe("Display title for the canvas"),
        description: z.string().optional().describe("Brief description of what this canvas shows"),
        schemaJson: z
            .object({
                title: z.string(),
                description: z.string().optional(),
                layout: z
                    .object({
                        type: z.enum(["grid", "stack"]).optional(),
                        columns: z.number().optional(),
                        gap: z.number().optional()
                    })
                    .optional(),
                dataQueries: z.array(z.record(z.unknown())).optional(),
                components: z.array(z.record(z.unknown()))
            })
            .describe("The full canvas schema with layout, data queries, and components"),
        tags: z.array(z.string()).optional().describe("Tags for categorization"),
        category: z.string().optional().describe("Category (e.g., 'dashboard', 'report', 'form')")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, title, description, schemaJson, tags, category }) => {
        const result = await callInternalApi("/api/canvases", {
            method: "POST",
            body: { slug, title, description, schemaJson, tags, category }
        });
        return {
            ...result,
            success: true,
            message: `Canvas "${title}" created successfully. View it at /canvas/${slug}`,
            url: `/canvas/${slug}`
        };
    }
});

export const canvasReadTool = createTool({
    id: "canvas-read",
    description: "Read a canvas schema and metadata by slug.",
    inputSchema: z.object({
        slug: z.string().describe("Canvas slug")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        return callInternalApi(`/api/canvases/${slug}`);
    }
});

export const canvasUpdateTool = createTool({
    id: "canvas-update",
    description:
        "Update an existing canvas. Can update title, description, schema, tags, or publish status. " +
        "When updating the schema, a new version is automatically created.",
    inputSchema: z.object({
        slug: z.string().describe("Canvas slug to update"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        schemaJson: z
            .object({
                title: z.string(),
                description: z.string().optional(),
                layout: z.record(z.unknown()).optional(),
                dataQueries: z.array(z.record(z.unknown())).optional(),
                components: z.array(z.record(z.unknown()))
            })
            .optional()
            .describe("Updated canvas schema (creates a new version)"),
        changelog: z.string().optional().describe("Description of what changed"),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
        isPublished: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, ...updates }) => {
        return callInternalApi(`/api/canvases/${slug}`, {
            method: "PATCH",
            body: updates
        });
    }
});

export const canvasDeleteTool = createTool({
    id: "canvas-delete",
    description: "Delete a canvas permanently.",
    inputSchema: z.object({
        slug: z.string().describe("Canvas slug to delete")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        return callInternalApi(`/api/canvases/${slug}`, { method: "DELETE" });
    }
});

export const canvasListTool = createTool({
    id: "canvas-list",
    description: "List all canvases with optional filtering by category or tags.",
    inputSchema: z.object({
        category: z.string().optional().describe("Filter by category"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
        skip: z.number().optional().default(0),
        take: z.number().optional().default(20)
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category, tags, skip, take }) => {
        return callInternalApi("/api/canvases", {
            query: {
                category,
                tags: tags?.join(","),
                skip,
                take
            }
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Data Tools
// ─────────────────────────────────────────────────────────────────────────────

export const canvasQueryPreviewTool = createTool({
    id: "canvas-query-preview",
    description:
        "Preview the results of a data query before adding it to a canvas. " +
        "Use this to inspect data shape, available fields, and sample values. " +
        "Supports MCP tool queries, SQL, RAG, and static data.",
    inputSchema: z.object({
        source: z.enum(["mcp", "sql", "rag", "static", "api"]).describe("Data source type"),
        tool: z.string().optional().describe("MCP tool name (for mcp source)"),
        params: z.record(z.unknown()).optional().describe("Query parameters"),
        query: z.string().optional().describe("SQL query (for sql source) or RAG query text")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ source, tool, params, query }) => {
        // Build a temporary query and execute it via the data endpoint
        // For preview, we use a direct internal call
        const queryDef = {
            id: "preview",
            source,
            tool,
            params,
            query,
            prompt: source === "rag" ? query : undefined
        };

        // Use executeSingleQuery directly
        const { executeSingleQuery } = await import("../canvas/query-executor");
        const result = await executeSingleQuery(queryDef);

        return {
            success: !result.error,
            data: result.data,
            error: result.error,
            durationMs: result.durationMs,
            // Add helpful metadata about the data shape
            dataType: Array.isArray(result.data) ? "array" : typeof result.data,
            rowCount: Array.isArray(result.data) ? result.data.length : undefined,
            sampleFields:
                Array.isArray(result.data) && result.data.length > 0
                    ? Object.keys(result.data[0] as Record<string, unknown>)
                    : undefined
        };
    }
});

export const canvasExecuteQueriesTool = createTool({
    id: "canvas-execute-queries",
    description:
        "Execute all data queries for a canvas and return the results. " +
        "Runs the canvas's dataQueries server-side (MCP tools, SQL, RAG, APIs, etc.) " +
        "and returns results keyed by query ID.",
    inputSchema: z.object({
        slug: z.string().describe("Canvas slug to execute queries for")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug }) => {
        return callInternalApi(`/api/canvases/${slug}/data`);
    }
});

export const canvasListBlocksTool = createTool({
    id: "canvas-list-blocks",
    description:
        "List all available canvas block types with their descriptions and categories. " +
        "Use this to understand what UI components can be used in a canvas.",
    inputSchema: z.object({
        category: z
            .enum(["data", "chart", "kpi", "text", "filter", "interactive", "layout"])
            .optional()
            .describe("Filter by block category")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ category }) => {
        let blocks = BLOCK_TYPES;
        if (category) {
            blocks = blocks.filter((b) => b.category === category);
        }
        return {
            success: true,
            blocks,
            totalCount: blocks.length
        };
    }
});
