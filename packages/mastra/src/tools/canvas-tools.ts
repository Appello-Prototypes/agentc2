import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma } from "@repo/database";
import { BLOCK_TYPES } from "../canvas/schema";

const baseOutputSchema = z.object({ success: z.boolean().optional() }).passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// Canvas CRUD Tools — Direct Prisma calls for reliability in agent runs
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
        const canvas = await prisma.canvas.create({
            data: {
                slug,
                title,
                description,
                schemaJson: schemaJson as Prisma.InputJsonValue,
                dataQueries: (schemaJson.dataQueries as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                tags: tags ?? [],
                category,
                version: 1,
                versions: {
                    create: {
                        version: 1,
                        schemaJson: schemaJson as Prisma.InputJsonValue,
                        changelog: "Initial version"
                    }
                }
            }
        });
        return {
            ...canvas,
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
        const canvas = await prisma.canvas.findUnique({
            where: { slug },
            include: {
                versions: {
                    orderBy: { version: "desc" as const },
                    take: 5,
                    select: {
                        id: true,
                        version: true,
                        changelog: true,
                        versionLabel: true,
                        createdAt: true,
                        createdBy: true
                    }
                }
            }
        });
        if (!canvas) {
            throw new Error(`Canvas "${slug}" not found`);
        }
        return canvas;
    }
});

export const canvasUpdateTool = createTool({
    id: "canvas-update",
    description:
        "Update an existing canvas. Can update title, description, schema, tags, or publish status. " +
        "When updating the schema (schemaJson), a new version is automatically created. " +
        "To update only data queries without touching layout/components, use canvas-update-data instead.",
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
        versionLabel: z
            .string()
            .optional()
            .describe(
                "Label for this version snapshot (e.g., 'Morning — Feb 17'). Only used when schemaJson is provided."
            ),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
        isPublished: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, schemaJson, changelog, versionLabel, ...rest }) => {
        const existing = await prisma.canvas.findUnique({ where: { slug } });
        if (!existing) {
            throw new Error(`Canvas "${slug}" not found`);
        }

        const updateData: Prisma.CanvasUpdateInput = {};
        if (rest.title !== undefined) updateData.title = rest.title;
        if (rest.description !== undefined) updateData.description = rest.description;
        if (rest.tags !== undefined) updateData.tags = rest.tags;
        if (rest.category !== undefined) updateData.category = rest.category;
        if (rest.isPublished !== undefined) updateData.isPublished = rest.isPublished;

        if (schemaJson) {
            const newVersion = existing.version + 1;
            updateData.schemaJson = schemaJson as Prisma.InputJsonValue;
            updateData.dataQueries =
                (schemaJson.dataQueries as Prisma.InputJsonValue) ??
                existing.dataQueries ??
                Prisma.JsonNull;
            updateData.version = newVersion;

            await prisma.canvasVersion.create({
                data: {
                    canvasId: existing.id,
                    version: newVersion,
                    schemaJson: schemaJson as Prisma.InputJsonValue,
                    changelog: changelog || `Updated to version ${newVersion}`,
                    versionLabel: versionLabel || null
                }
            });
        }

        const canvas = await prisma.canvas.update({
            where: { slug },
            data: updateData
        });
        return canvas;
    }
});

export const canvasUpdateDataTool = createTool({
    id: "canvas-update-data",
    description:
        "Update only the data queries on a canvas without touching layout or components. " +
        "This is the safe, efficient way for agents to refresh dashboard data. " +
        "Merges provided queries by ID — existing queries not in the payload are preserved. " +
        "Does NOT create a new schema version (data refreshes are not schema changes).",
    inputSchema: z.object({
        slug: z.string().describe("Canvas slug to update"),
        dataQueries: z
            .array(
                z.object({
                    id: z.string().describe("Query ID to update (must match existing query ID)"),
                    source: z.enum(["static", "mcp", "sql", "rag", "api"]).default("static"),
                    data: z.unknown().optional().describe("Static data payload"),
                    tool: z.string().optional().describe("MCP tool name"),
                    params: z.record(z.unknown()).optional().describe("Query parameters"),
                    query: z.string().optional().describe("SQL or RAG query string"),
                    url: z.string().optional().describe("API URL"),
                    method: z.string().optional().describe("HTTP method for API source"),
                    headers: z
                        .record(z.string())
                        .optional()
                        .describe("HTTP headers for API source"),
                    body: z.unknown().optional().describe("Request body for API source"),
                    refreshInterval: z
                        .number()
                        .optional()
                        .describe("Auto-refresh interval in ms (0 = no refresh)"),
                    transform: z.string().optional().describe("Expression to transform results")
                })
            )
            .describe("Data queries to update or add (merged by ID)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ slug, dataQueries }) => {
        const existing = await prisma.canvas.findUnique({ where: { slug } });
        if (!existing) {
            throw new Error(`Canvas "${slug}" not found`);
        }

        const existingSchema =
            existing.schemaJson && typeof existing.schemaJson === "object"
                ? (existing.schemaJson as Record<string, unknown>)
                : {};
        const existingQueries = Array.isArray(existingSchema.dataQueries)
            ? (existingSchema.dataQueries as Array<Record<string, unknown>>)
            : [];

        const incomingById = new Map<string, Record<string, unknown>>();
        for (const q of dataQueries) {
            incomingById.set(q.id, q as Record<string, unknown>);
        }

        const mergedQueries = existingQueries.map((eq) => {
            const replacement = incomingById.get(eq.id as string);
            if (replacement) {
                incomingById.delete(eq.id as string);
                return { ...eq, ...replacement };
            }
            return eq;
        });
        for (const newQ of incomingById.values()) {
            mergedQueries.push(newQ);
        }

        const patchedSchema = { ...existingSchema, dataQueries: mergedQueries };

        const canvas = await prisma.canvas.update({
            where: { slug },
            data: {
                schemaJson: patchedSchema as Prisma.InputJsonValue,
                dataQueries: mergedQueries as Prisma.InputJsonValue
            }
        });

        return {
            ...canvas,
            success: true,
            queriesUpdated: dataQueries.length,
            totalQueries: mergedQueries.length
        };
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
        await prisma.canvas.delete({ where: { slug } });
        return { success: true };
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
        const where: Prisma.CanvasWhereInput = { isActive: true };
        if (category) where.category = category;
        if (tags && tags.length > 0) where.tags = { hasSome: tags };

        const [canvases, total] = await Promise.all([
            prisma.canvas.findMany({
                where,
                skip: skip ?? 0,
                take: take ?? 20,
                orderBy: { updatedAt: "desc" as const },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    description: true,
                    category: true,
                    tags: true,
                    version: true,
                    isPublished: true,
                    isPublic: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.canvas.count({ where })
        ]);

        return { canvases, total, success: true };
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
    execute: async ({ source, tool, params, query }, context) => {
        const queryDef = {
            id: "preview",
            source,
            tool,
            params,
            query,
            prompt: source === "rag" ? query : undefined
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reqCtx = context?.requestContext as Record<string, any> | undefined;
        const organizationId = reqCtx?.organizationId || reqCtx?.tenantId || null;

        const { executeSingleQuery } = await import("../canvas/query-executor");
        const result = await executeSingleQuery(queryDef, { organizationId });

        return {
            success: !result.error,
            data: result.data,
            error: result.error,
            durationMs: result.durationMs,
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
        const canvas = await prisma.canvas.findUnique({
            where: { slug },
            select: { dataQueries: true }
        });
        if (!canvas) {
            throw new Error(`Canvas "${slug}" not found`);
        }
        const queries = Array.isArray(canvas.dataQueries) ? canvas.dataQueries : [];
        if (queries.length === 0) {
            return { success: true, results: {} };
        }

        const { executeCanvasQueries } = await import("../canvas/query-executor");
        type DataQuery = Parameters<typeof executeCanvasQueries>[0][number];
        const results = await executeCanvasQueries(queries as unknown as DataQuery[], {});
        return { success: true, results };
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
