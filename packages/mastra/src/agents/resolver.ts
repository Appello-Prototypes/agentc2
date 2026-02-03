/**
 * Agent Resolver
 *
 * Resolves agents from the database with fallback to code-defined agents.
 * Supports RequestContext for runtime context injection and dynamic instructions.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { prisma, Prisma } from "@repo/database";
import { mastra } from "../mastra";
import { storage } from "../storage";
import { vector } from "../vector";
import { getToolsByNamesAsync, getAllMcpTools } from "../tools/registry";
import { getScorersByNames } from "../scorers/registry";

// Use Prisma namespace for types
type AgentRecord = Prisma.AgentGetPayload<{ include: { tools: true } }>;
type AgentToolRecord = Prisma.AgentToolGetPayload<object>;

/**
 * ResourceContext - User/tenant identification following Mastra patterns
 */
export interface ResourceContext {
    userId?: string;
    userName?: string;
    tenantId?: string;
}

/**
 * ThreadContext - Conversation/session thread identification
 */
export interface ThreadContext {
    id?: string;
    sessionId?: string;
}

/**
 * RequestContext - Injected per-request for dynamic behavior
 *
 * Aligns with Mastra's reserved keys:
 * - `resource`: Contains user and tenant identifiers
 * - `thread`: Contains conversation/session identifiers
 * - `metadata`: Custom key-value pairs for additional context
 */
export interface RequestContext {
    resource?: ResourceContext;
    thread?: ThreadContext;
    metadata?: Record<string, unknown>;

    // Legacy flat properties for backwards compatibility
    /** @deprecated Use resource.userId instead */
    userId?: string;
    /** @deprecated Use resource.userName instead */
    userName?: string;
    /** @deprecated Use resource.tenantId instead */
    tenantId?: string;
    /** @deprecated Use thread.sessionId instead */
    sessionId?: string;
}

/**
 * Normalize RequestContext to use Mastra-aligned structure
 * Handles both legacy flat properties and new nested structure
 */
function normalizeRequestContext(context?: RequestContext): RequestContext {
    if (!context) return {};

    return {
        resource: {
            userId: context.resource?.userId || context.userId,
            userName: context.resource?.userName || context.userName,
            tenantId: context.resource?.tenantId || context.tenantId
        },
        thread: {
            id: context.thread?.id,
            sessionId: context.thread?.sessionId || context.sessionId
        },
        metadata: context.metadata
    };
}

/**
 * Options for resolving an agent
 */
export interface ResolveOptions {
    slug?: string;
    id?: string;
    requestContext?: RequestContext;
    fallbackToSystem?: boolean;
}

/**
 * Agent record with tools included
 */
export type AgentRecordWithTools = AgentRecord;

/**
 * Result of agent resolution
 */
export interface HydratedAgent {
    agent: Agent;
    record: AgentRecordWithTools | null;
    source: "database" | "fallback";
}

/**
 * Memory configuration from database
 */
interface MemoryConfig {
    lastMessages?: number;
    semanticRecall?:
        | {
              topK?: number;
              messageRange?: number;
          }
        | false;
    workingMemory?: {
        enabled?: boolean;
        template?: string;
    };
}

/**
 * AgentResolver class
 *
 * Provides database-first agent resolution with fallback to code-defined agents.
 */
export class AgentResolver {
    /**
     * Resolve an agent by slug or id
     *
     * @param options - Resolution options including slug, id, and requestContext
     * @returns Hydrated agent with metadata
     * @throws Error if agent not found
     */
    async resolve(options: ResolveOptions): Promise<HydratedAgent> {
        const { slug, id, requestContext, fallbackToSystem = true } = options;

        if (!slug && !id) {
            throw new Error("Either slug or id must be provided");
        }

        // Try database first
        const record = await prisma.agent.findFirst({
            where: slug ? { slug, isActive: true } : { id, isActive: true },
            include: { tools: true }
        });

        if (record) {
            const agent = await this.hydrate(record, requestContext);
            return { agent, record, source: "database" };
        }

        // Fallback to code-defined agents
        if (fallbackToSystem && slug) {
            try {
                const agent = mastra.getAgent(slug);
                if (agent) {
                    console.log(`[AgentResolver] Fallback to code-defined agent: ${slug}`);
                    return { agent, record: null, source: "fallback" };
                }
            } catch {
                // Agent not found in Mastra either
            }
        }

        throw new Error(`Agent not found: ${slug || id}`);
    }

    /**
     * Hydrate an Agent instance from a database record
     * Supports both static registry tools and MCP tools
     */
    private async hydrate(record: AgentRecordWithTools, context?: RequestContext): Promise<Agent> {
        // Interpolate instructions if template exists
        const instructions = record.instructionsTemplate
            ? this.interpolateInstructions(record.instructionsTemplate, context || {})
            : record.instructions;

        // Build memory if enabled
        const memory = record.memoryEnabled
            ? this.buildMemory(record.memoryConfig as MemoryConfig | null)
            : undefined;

        // Get tools from registry AND MCP (async)
        const toolNames = record.tools.map((t: { toolId: string }) => t.toolId);
        let tools = await getToolsByNamesAsync(toolNames);

        // If agent is MCP-enabled, merge in all available MCP tools
        const metadata = record.metadata as Record<string, unknown> | null;
        if (metadata?.mcpEnabled) {
            const mcpTools = await getAllMcpTools();

            // Filter out tools with invalid schemas to prevent agent creation errors
            // The error "tools.N.custom.input_schema.type: Field required" comes from
            // Anthropic's API when a tool's JSON schema doesn't have a 'type' field.
            //
            // Some MCP servers (like JustCall) return tools where inputSchema conversion
            // produces JSON without 'type'. We need to validate this before passing to Agent.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const validMcpTools: Record<string, any> = {};
            let skippedCount = 0;
            const skippedNames: string[] = [];

            for (const [name, tool] of Object.entries(mcpTools)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const t = tool as any;

                // Check multiple possible schema locations
                // 1. API fallback tools (marked with _apiClient) should work
                // 2. Tools with explicit JSON schema type
                // 3. Zod schemas that are proper ZodObjects with properties
                const isApiClient = t._apiClient === true;
                const hasDirectType = t.inputSchema?.type === "object";

                // For Zod schemas, check if it's a proper object schema
                const isZodSchema = t.inputSchema && typeof t.inputSchema.parse === "function";
                const zodTypeName = isZodSchema ? t.inputSchema._def?.typeName : null;
                const isZodObject = zodTypeName === "ZodObject";

                // Check if Zod object has any shape (empty objects can cause issues)
                // An empty shape {} is actually fine - it becomes { type: "object", properties: {} }
                // The issue is with schemas that aren't objects at all
                let hasValidShape = false;
                if (isZodObject) {
                    try {
                        // ZodObject should have a shape() method
                        const shape = t.inputSchema._def?.shape?.();
                        hasValidShape = shape !== undefined;
                    } catch {
                        hasValidShape = false;
                    }
                }

                // Accept if: API client, direct JSON schema, or valid ZodObject
                if (isApiClient || hasDirectType || (isZodObject && hasValidShape)) {
                    validMcpTools[name] = tool;
                } else {
                    skippedCount++;
                    skippedNames.push(`${name}(${zodTypeName || "no-zod"})`);
                }
            }

            // Merge valid MCP tools without overwriting already-resolved tools
            tools = { ...validMcpTools, ...tools };

            if (skippedCount > 0) {
                console.warn(
                    `[AgentResolver] Skipped ${skippedCount} tools with invalid schemas: ${skippedNames.slice(0, 5).join(", ")}${skippedCount > 5 ? "..." : ""}`
                );
            }
            console.log(
                `[AgentResolver] MCP-enabled agent "${record.slug}": loaded ${Object.keys(validMcpTools).length} MCP tools (skipped ${skippedCount} invalid)`
            );
        }

        // Get scorers from registry
        const scorers = getScorersByNames(record.scorers);

        // Build model string
        const model = `${record.modelProvider}/${record.modelName}`;

        // Create agent - using any to bypass strict typing issues with Mastra's Agent constructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentConfig: any = {
            id: record.id,
            name: record.name,
            instructions,
            model
        };

        // Add optional fields
        if (Object.keys(tools).length > 0) {
            agentConfig.tools = tools;
        }

        if (memory) {
            agentConfig.memory = memory;
        }

        if (Object.keys(scorers).length > 0) {
            agentConfig.scorers = scorers;
        }

        return new Agent(agentConfig);
    }

    /**
     * Interpolate instructions template with RequestContext values
     *
     * Replaces {{key}} placeholders with values from context.
     * Supports both nested keys (e.g., {{resource.userId}}) and flat keys (e.g., {{userId}}).
     * If a key is not found, the placeholder is kept as-is.
     */
    private interpolateInstructions(template: string, context: RequestContext): string {
        // Normalize the context to use Mastra-aligned structure
        const normalized = normalizeRequestContext(context);

        return template.replace(/\{\{([\w.]+)\}\}/g, (match, key: string) => {
            // Handle nested keys like resource.userId or thread.id
            const parts = key.split(".");
            if (parts.length === 2) {
                const [parent, child] = parts;
                if (parent === "resource" && normalized.resource) {
                    const value = normalized.resource[child as keyof ResourceContext];
                    if (value !== undefined) {
                        return String(value);
                    }
                }
                if (parent === "thread" && normalized.thread) {
                    const value = normalized.thread[child as keyof ThreadContext];
                    if (value !== undefined) {
                        return String(value);
                    }
                }
            }

            // Handle flat keys (backwards compatibility)
            // Map to resource context
            if (key === "userId" && normalized.resource?.userId) {
                return String(normalized.resource.userId);
            }
            if (key === "userName" && normalized.resource?.userName) {
                return String(normalized.resource.userName);
            }
            if (key === "tenantId" && normalized.resource?.tenantId) {
                return String(normalized.resource.tenantId);
            }
            if (key === "sessionId" && normalized.thread?.sessionId) {
                return String(normalized.thread.sessionId);
            }

            // Check metadata
            if (normalized.metadata && key in normalized.metadata) {
                const value = normalized.metadata[key];
                if (value !== undefined) {
                    return String(value);
                }
            }

            // Keep placeholder if not found
            return match;
        });
    }

    /**
     * Build a Memory instance from configuration
     *
     * When semanticRecall is enabled, includes vector store and embedder.
     */
    private buildMemory(config: MemoryConfig | null): Memory {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memoryOptions: any = {};
        // Check if semantic recall is enabled (it's an object when enabled, false when disabled)
        const hasSemanticRecall =
            config?.semanticRecall !== undefined &&
            config.semanticRecall !== false &&
            typeof config.semanticRecall === "object";

        if (config) {
            if (config.lastMessages !== undefined) {
                memoryOptions.lastMessages = config.lastMessages;
            }

            if (config.semanticRecall !== undefined) {
                memoryOptions.semanticRecall = config.semanticRecall;
            }

            if (config.workingMemory !== undefined) {
                memoryOptions.workingMemory = config.workingMemory;
            }
        }

        // Build memory config - include vector and embedder if semantic recall is enabled
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memoryConfig: any = {
            storage,
            options: memoryOptions
        };

        if (hasSemanticRecall) {
            memoryConfig.vector = vector;
            memoryConfig.embedder = new ModelRouterEmbeddingModel("openai/text-embedding-3-small");
        }

        return new Memory(memoryConfig);
    }

    /**
     * List all agents accessible by a user
     *
     * Includes:
     * - All SYSTEM agents
     * - User's own agents
     * - Public agents from other users
     */
    async listForUser(userId?: string): Promise<AgentRecordWithTools[]> {
        if (userId) {
            return prisma.agent.findMany({
                where: {
                    isActive: true,
                    OR: [{ type: "SYSTEM" }, { ownerId: userId }, { isPublic: true }]
                },
                include: { tools: true },
                orderBy: [{ type: "asc" }, { name: "asc" }]
            });
        }

        // No user - only SYSTEM and public agents
        return prisma.agent.findMany({
            where: {
                isActive: true,
                OR: [{ type: "SYSTEM" }, { isPublic: true }]
            },
            include: { tools: true },
            orderBy: [{ type: "asc" }, { name: "asc" }]
        });
    }

    /**
     * List all SYSTEM agents
     */
    async listSystem(): Promise<AgentRecordWithTools[]> {
        return prisma.agent.findMany({
            where: {
                type: "SYSTEM",
                isActive: true
            },
            include: { tools: true },
            orderBy: { name: "asc" }
        });
    }

    /**
     * Check if an agent exists by slug
     */
    async exists(slug: string): Promise<boolean> {
        const count = await prisma.agent.count({
            where: { slug, isActive: true }
        });
        return count > 0;
    }

    /**
     * Get an agent record by slug (without hydration)
     */
    async getRecord(slug: string): Promise<AgentRecordWithTools | null> {
        return prisma.agent.findUnique({
            where: { slug },
            include: { tools: true }
        });
    }
}

/**
 * Singleton instance of AgentResolver
 */
export const agentResolver = new AgentResolver();
