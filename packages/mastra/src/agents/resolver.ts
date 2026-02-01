/**
 * Agent Resolver
 *
 * Resolves agents from the database with fallback to code-defined agents.
 * Supports RequestContext for runtime context injection and dynamic instructions.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { prisma, Prisma } from "@repo/database";
import { mastra } from "../mastra";
import { storage } from "../storage";
import { getToolsByNamesAsync } from "../tools/registry";
import { getScorersByNames } from "../scorers/registry";

// Use Prisma namespace for types
type AgentRecord = Prisma.AgentGetPayload<{ include: { tools: true } }>;
type AgentToolRecord = Prisma.AgentToolGetPayload<object>;

/**
 * RequestContext - Injected per-request for dynamic behavior
 */
export interface RequestContext {
    userId?: string;
    userName?: string;
    tenantId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
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
        const tools = await getToolsByNamesAsync(toolNames);

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
     * If a key is not found, the placeholder is kept as-is.
     */
    private interpolateInstructions(template: string, context: RequestContext): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            // Check direct context properties
            if (key in context) {
                const value = context[key as keyof RequestContext];
                if (value !== undefined && typeof value !== "object") {
                    return String(value);
                }
            }

            // Check metadata
            if (context.metadata && key in context.metadata) {
                const value = context.metadata[key];
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
     */
    private buildMemory(config: MemoryConfig | null): Memory {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memoryOptions: any = {};

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

        return new Memory({
            storage,
            options: memoryOptions
        });
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
