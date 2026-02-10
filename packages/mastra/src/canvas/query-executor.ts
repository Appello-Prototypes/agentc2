/**
 * Canvas Data Query Executor
 *
 * Executes data queries defined in a canvas schema on the server side.
 * This keeps API keys, database credentials, and MCP tokens safe.
 */

import type { DataQuery } from "./schema";
import { prisma } from "@repo/database";
import { getMcpTools } from "../mcp/client";
import { queryRag } from "../rag/pipeline";

export interface QueryExecutionResult {
    id: string;
    data: unknown;
    error?: string;
    durationMs: number;
}

export interface QueryExecutionOptions {
    organizationId?: string | null;
    userId?: string | null;
    /** Override parameters (e.g., from filter interactions) */
    paramOverrides?: Record<string, Record<string, unknown>>;
    /** Timeout per query in ms */
    timeoutMs?: number;
}

/**
 * Execute all data queries for a canvas and return results keyed by query ID.
 */
export async function executeCanvasQueries(
    queries: DataQuery[],
    options: QueryExecutionOptions = {}
): Promise<Record<string, QueryExecutionResult>> {
    const results: Record<string, QueryExecutionResult> = {};
    const timeout = options.timeoutMs || 30000;

    await Promise.all(
        queries.map(async (query) => {
            const start = Date.now();
            try {
                // Merge any param overrides from filters
                const mergedParams = {
                    ...(query.params || {}),
                    ...(options.paramOverrides?.[query.id] || {})
                };

                const data = await executeQuery(query, mergedParams, options, timeout);
                results[query.id] = {
                    id: query.id,
                    data,
                    durationMs: Date.now() - start
                };
            } catch (error) {
                console.error(`[Canvas Query] Failed to execute query "${query.id}":`, error);
                results[query.id] = {
                    id: query.id,
                    data: null,
                    error: error instanceof Error ? error.message : String(error),
                    durationMs: Date.now() - start
                };
            }
        })
    );

    return results;
}

/**
 * Execute a single data query. Used by canvas-query-preview tool as well.
 */
export async function executeSingleQuery(
    query: DataQuery,
    options: QueryExecutionOptions = {}
): Promise<QueryExecutionResult> {
    const start = Date.now();
    try {
        const data = await executeQuery(
            query,
            query.params || {},
            options,
            options.timeoutMs || 30000
        );
        return {
            id: query.id,
            data,
            durationMs: Date.now() - start
        };
    } catch (error) {
        return {
            id: query.id,
            data: null,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal execution per source type
// ─────────────────────────────────────────────────────────────────────────────

async function executeQuery(
    query: DataQuery,
    params: Record<string, unknown>,
    options: QueryExecutionOptions,
    _timeoutMs: number
): Promise<unknown> {
    switch (query.source) {
        case "mcp":
            return executeMcpQuery(query, params, options);
        case "sql":
            return executeSqlQuery(query);
        case "rag":
            return executeRagQuery(query, params);
        case "static":
            return query.data;
        case "agent":
            return executeAgentQuery(query);
        case "api":
            return executeApiQuery(query, params);
        default:
            throw new Error(`Unknown query source: ${query.source}`);
    }
}

async function executeMcpQuery(
    query: DataQuery,
    params: Record<string, unknown>,
    options: QueryExecutionOptions
): Promise<unknown> {
    if (!query.tool) {
        throw new Error("MCP query requires a 'tool' field");
    }

    // Use getMcpTools() which returns executable tool objects keyed by name
    // (e.g., "hubspot_hubspot-search-objects"). This is the same approach the
    // agent runtime uses and correctly handles tool resolution.
    const tools = await getMcpTools(options.organizationId);
    const tool = tools[query.tool];

    if (!tool) {
        const available = Object.keys(tools)
            .filter((n) => n.startsWith(query.tool!.split("_")[0]!))
            .slice(0, 10);
        throw new Error(
            `MCP tool "${query.tool}" not found. Available from this server: ${available.join(", ") || "none"}`
        );
    }

    // Execute the tool. Mastra MCP tools expect params directly (not wrapped in context).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResult = await (tool as any).execute(params);

    // MCP tools return results in the standard MCP content format:
    //   { content: [{ type: "text", text: "{ JSON string }" }] }
    // We need to unwrap this to get the actual data for the renderer.
    return unwrapMcpResult(rawResult);
}

async function executeSqlQuery(query: DataQuery): Promise<unknown> {
    if (!query.query) {
        throw new Error("SQL query requires a 'query' field");
    }

    // Safety: Only allow SELECT statements
    const trimmed = query.query.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT")) {
        throw new Error("Only SELECT queries are allowed for canvas data queries");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await prisma.$queryRawUnsafe(query.query)) as any[];
    return result;
}

async function executeRagQuery(
    query: DataQuery,
    params: Record<string, unknown>
): Promise<unknown> {
    const queryText = (params.query as string) || (query.prompt as string) || "";
    if (!queryText) {
        throw new Error("RAG query requires a query text in params.query or query.prompt");
    }

    const result = await queryRag(queryText, {
        topK: (params.topK as number) || 5,
        minScore: (params.minScore as number) || undefined
    });

    return result;
}

async function executeAgentQuery(query: DataQuery): Promise<unknown> {
    // Agent queries invoke an agent and return the text response
    // This is a simplified version; could be expanded to support streaming
    if (!query.agentSlug || !query.prompt) {
        throw new Error("Agent query requires 'agentSlug' and 'prompt' fields");
    }

    // Import dynamically to avoid circular dependency
    const { agentResolver } = await import("../agents/resolver");
    const hydrated = await agentResolver.resolve({ slug: query.agentSlug });
    if (!hydrated?.agent) {
        throw new Error(`Agent "${query.agentSlug}" not found`);
    }

    const result = await hydrated.agent.generate(query.prompt);
    return { text: result.text };
}

async function executeApiQuery(
    query: DataQuery,
    params: Record<string, unknown>
): Promise<unknown> {
    if (!query.url) {
        throw new Error("API query requires a 'url' field");
    }

    const method = (query.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(query.headers || {})
    };

    const fetchOptions: RequestInit = {
        method,
        headers
    };

    if (method !== "GET" && method !== "HEAD") {
        fetchOptions.body = JSON.stringify(query.body || params);
    }

    const response = await fetch(query.url, fetchOptions);
    if (!response.ok) {
        throw new Error(`API query failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Result Unwrapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MCP tools return results in the standard content format:
 *   { content: [{ type: "text", text: "{ ...JSON string... }" }] }
 *
 * This function unwraps the content to extract usable data for the renderer.
 * It also handles the common HubSpot/Jira pattern where the JSON contains
 * a { results: [...] } wrapper.
 */
function unwrapMcpResult(raw: unknown): unknown {
    if (raw == null) return raw;

    // Check for MCP content format: { content: [{ type: "text", text: "..." }] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = raw as any;
    if (obj.content && Array.isArray(obj.content)) {
        // Concatenate all text content parts
        const textParts = obj.content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((c: any) => c.type === "text" && typeof c.text === "string")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((c: any) => c.text);

        if (textParts.length > 0) {
            const combined = textParts.join("");
            try {
                const parsed = JSON.parse(combined);

                // HubSpot/Jira pattern: { results: [...], paging: {...} }
                // Extract the results array for easier consumption
                if (parsed && typeof parsed === "object" && Array.isArray(parsed.results)) {
                    // Flatten properties for HubSpot objects
                    // HubSpot returns: { id, properties: { dealname, amount, ... } }
                    // We want: { id, dealname, amount, ... }
                    return parsed.results.map((item: Record<string, unknown>) => {
                        if (item.properties && typeof item.properties === "object") {
                            return {
                                ...(item.properties as Record<string, unknown>),
                                id: item.id,
                                createdAt: item.createdAt,
                                updatedAt: item.updatedAt
                            };
                        }
                        return item;
                    });
                }

                // Jira pattern: { issues: [...] }
                if (parsed && typeof parsed === "object" && Array.isArray(parsed.issues)) {
                    return parsed.issues.map((issue: Record<string, unknown>) => {
                        const fields = issue.fields as Record<string, unknown> | undefined;
                        return {
                            key: issue.key,
                            id: issue.id,
                            ...(fields || {})
                        };
                    });
                }

                return parsed;
            } catch {
                // Not valid JSON, return as plain text
                return combined;
            }
        }
    }

    // Not MCP content format, return as-is
    return raw;
}
