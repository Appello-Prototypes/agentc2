import { McpToolDefinition, McpToolRoute } from "./types";

export const canvasToolDefinitions: McpToolDefinition[] = [
    {
        name: "canvas-create",
        description:
            "Create a new canvas (dashboard, report, or interactive UI) with components and data bindings. " +
            "The canvas is stored in the database and immediately viewable at /canvas/{slug}. " +
            "Use canvas-list-blocks to see available component types and canvas-query-preview to test data queries before building.",
        inputSchema: {
            type: "object",
            properties: {
                slug: {
                    type: "string",
                    description:
                        "URL-safe identifier for the canvas (e.g., 'deal-pipeline-dashboard')"
                },
                title: { type: "string", description: "Display title for the canvas" },
                description: {
                    type: "string",
                    description: "Brief description of what this canvas shows"
                },
                schemaJson: {
                    type: "object",
                    description:
                        "The full canvas schema with layout, data queries, and components. " +
                        "Must include title, components array. May include layout, dataQueries, theme.",
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        layout: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["grid", "stack"] },
                                columns: { type: "number" },
                                gap: { type: "number" }
                            }
                        },
                        dataQueries: {
                            type: "array",
                            items: { type: "object" },
                            description: "Data query definitions (mcp, sql, rag, static, agent, api)"
                        },
                        components: {
                            type: "array",
                            items: { type: "object" },
                            description: "UI component definitions (use canvas-list-blocks to see types)"
                        },
                        theme: {
                            type: "object",
                            description: "Optional theme overrides (primaryColor, chartColors, etc.)"
                        }
                    },
                    required: ["title", "components"]
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags for categorization"
                },
                category: {
                    type: "string",
                    description: "Category (e.g., 'dashboard', 'report', 'form')"
                },
                metadata: {
                    type: "object",
                    description: "Additional metadata as key-value pairs"
                }
            },
            required: ["slug", "title", "schemaJson"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-read",
        description:
            "Read a canvas schema and metadata by slug. Returns the full canvas object including schemaJson, versions, tags, and publish status.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Canvas slug" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-update",
        description:
            "Update an existing canvas. Can update title, description, schema, tags, or publish status. " +
            "When updating the schema (schemaJson), a new version is automatically created.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Canvas slug to update" },
                title: { type: "string", description: "New title" },
                description: { type: "string", description: "New description" },
                schemaJson: {
                    type: "object",
                    description:
                        "Updated canvas schema (creates a new version). Must include title and components.",
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        layout: { type: "object" },
                        dataQueries: { type: "array", items: { type: "object" } },
                        components: { type: "array", items: { type: "object" } },
                        theme: { type: "object" }
                    },
                    required: ["title", "components"]
                },
                changelog: {
                    type: "string",
                    description: "Description of what changed (used in version history)"
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "New tags"
                },
                category: { type: "string", description: "New category" },
                metadata: { type: "object", description: "Updated metadata" },
                isPublished: {
                    type: "boolean",
                    description: "Set publish status"
                },
                isPublic: {
                    type: "boolean",
                    description:
                        "Make canvas publicly accessible via token URL (generates publicToken on first enable)"
                }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-delete",
        description: "Delete a canvas permanently. This also deletes all version history.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Canvas slug to delete" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-list",
        description:
            "List all canvases with optional filtering by category or tags. Returns paginated results.",
        inputSchema: {
            type: "object",
            properties: {
                category: { type: "string", description: "Filter by category" },
                tags: {
                    type: "string",
                    description: "Comma-separated tags to filter by"
                },
                skip: { type: "number", description: "Pagination offset (default: 0)" },
                take: { type: "number", description: "Page size (default: 20)" }
            }
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-query-preview",
        description:
            "Preview the results of a data query before adding it to a canvas. " +
            "Use this to inspect data shape, available fields, and sample values. " +
            "Supports MCP tool queries, SQL, RAG, static data, and external APIs.",
        inputSchema: {
            type: "object",
            properties: {
                source: {
                    type: "string",
                    enum: ["mcp", "sql", "rag", "static", "api"],
                    description: "Data source type"
                },
                tool: {
                    type: "string",
                    description:
                        "MCP tool name for mcp source (e.g., 'hubspot_hubspot-search-objects')"
                },
                params: {
                    type: "object",
                    description: "Query parameters to pass to the data source"
                },
                query: {
                    type: "string",
                    description: "SQL query (for sql source) or RAG query text (for rag source)"
                },
                data: {
                    description: "Static data payload (for static source)"
                },
                url: {
                    type: "string",
                    description: "API URL (for api source)"
                },
                method: {
                    type: "string",
                    description: "HTTP method (for api source, default: GET)"
                },
                headers: {
                    type: "object",
                    description: "HTTP headers (for api source)"
                },
                body: {
                    description: "Request body (for api source)"
                }
            },
            required: ["source"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-list-blocks",
        description:
            "List all available canvas block types with their descriptions and categories. " +
            "Use this to understand what UI components can be used in a canvas schema.",
        inputSchema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    enum: ["data", "chart", "kpi", "text", "filter", "interactive", "layout"],
                    description: "Filter by block category"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    },
    {
        name: "canvas-execute-queries",
        description:
            "Execute all data queries for a canvas and return the results. " +
            "This runs the canvas's dataQueries server-side (MCP tools, SQL, RAG, APIs, etc.) " +
            "and returns the results keyed by query ID. Use after creating a canvas to verify data flows.",
        inputSchema: {
            type: "object",
            properties: {
                slug: {
                    type: "string",
                    description: "Canvas slug to execute queries for"
                }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "canvas"
    }
];

export const canvasToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "canvas-create" },
    { kind: "registry", name: "canvas-read" },
    { kind: "registry", name: "canvas-update" },
    { kind: "registry", name: "canvas-delete" },
    { kind: "registry", name: "canvas-list" },
    { kind: "registry", name: "canvas-query-preview" },
    { kind: "registry", name: "canvas-list-blocks" },
    { kind: "registry", name: "canvas-execute-queries" }
];
