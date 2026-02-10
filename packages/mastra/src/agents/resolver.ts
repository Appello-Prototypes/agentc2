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
type AgentRecord = Prisma.AgentGetPayload<{
    include: { tools: true; workspace: { select: { organizationId: true } } };
}>;
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

const MODEL_ALIASES: Record<string, Record<string, string>> = {
    anthropic: {
        "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-5-20250514": "claude-sonnet-4-5-20250929",
        "claude-opus-4-5": "claude-opus-4-5-20251101",
        "claude-opus-4-5-20250514": "claude-opus-4-5-20251101"
    }
};

function resolveModelName(provider: string, modelName: string) {
    const alias = MODEL_ALIASES[provider]?.[modelName];
    if (alias) {
        console.warn(
            `[AgentResolver] Remapping model ${provider}/${modelName} -> ${provider}/${alias}`
        );
        return alias;
    }
    return modelName;
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
 * Active skill metadata captured at resolution time
 */
export interface ActiveSkillInfo {
    skillId: string;
    skillSlug: string;
    skillVersion: number;
}

/**
 * Result of agent resolution
 */
export interface HydratedAgent {
    agent: Agent;
    record: AgentRecordWithTools | null;
    source: "database" | "fallback";
    /** Skills active on the agent at resolution time */
    activeSkills: ActiveSkillInfo[];
    /** Maps tool name -> origin (e.g. "registry", "mcp:hubspot", "skill:research") */
    toolOriginMap: Record<string, string>;
    /** Document IDs from attached skills for RAG scoping */
    skillDocumentIds: string[];
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
 * Model configuration from database
 */
interface ModelConfig {
    reasoning?: { type: "enabled" | "disabled" };
    toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
    thinking?: {
        type: "enabled" | "disabled";
        budget_tokens?: number;
    };
    parallelToolCalls?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    cacheControl?: { type: "ephemeral" };
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
            include: { tools: true, workspace: { select: { organizationId: true } } }
        });

        if (record) {
            const result = await this.hydrate(record, requestContext);
            return { ...result, record, source: "database" };
        }

        // Fallback to code-defined agents
        if (fallbackToSystem && slug) {
            try {
                const agent = mastra.getAgent(slug);
                if (agent) {
                    console.log(`[AgentResolver] Fallback to code-defined agent: ${slug}`);
                    return {
                        agent,
                        record: null,
                        source: "fallback",
                        activeSkills: [],
                        toolOriginMap: {},
                        skillDocumentIds: []
                    };
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
     * Returns agent + skill metadata + tool origin map for observability
     */
    private async hydrate(
        record: AgentRecordWithTools,
        context?: RequestContext
    ): Promise<{
        agent: Agent;
        activeSkills: ActiveSkillInfo[];
        toolOriginMap: Record<string, string>;
        skillDocumentIds: string[];
    }> {
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
        const organizationId =
            context?.resource?.tenantId ||
            context?.tenantId ||
            record.workspace?.organizationId ||
            record.tenantId;

        // Parallelize independent async work: tools, skills, sub-agents, and MCP tools
        const metadata = record.metadata as Record<string, unknown> | null;
        const [registryTools, skillResult, subAgents, mcpTools] = await Promise.all([
            getToolsByNamesAsync(toolNames, organizationId),
            this.loadSkills(record.id, organizationId),
            this.loadSubAgents(record.subAgents, context),
            metadata?.mcpEnabled ? getAllMcpTools(organizationId) : Promise.resolve({})
        ]);
        const { skillInstructions, skillTools, skillDocumentIds, activeSkills } = skillResult;

        // Build tool origin map before merging (tracks where each tool came from)
        const toolOriginMap: Record<string, string> = {};
        for (const key of Object.keys(mcpTools)) {
            const serverName = key.split("_")[0] || "unknown";
            toolOriginMap[key] = `mcp:${serverName}`;
        }
        for (const key of Object.keys(skillTools)) {
            // Find which skill owns this tool
            const ownerSkill = activeSkills.find((s) =>
                skillResult.skillToolMapping?.[key] === s.skillSlug
            );
            toolOriginMap[key] = ownerSkill
                ? `skill:${ownerSkill.skillSlug}`
                : "skill:unknown";
        }
        for (const key of Object.keys(registryTools)) {
            toolOriginMap[key] = "registry";
        }

        // Merge tools: MCP tools (lowest priority) -> skill tools -> registry tools (highest)
        const tools = { ...mcpTools, ...skillTools, ...registryTools };

        if (metadata?.mcpEnabled && Object.keys(mcpTools).length > 0) {
            console.log(
                `[AgentResolver] MCP-enabled agent "${record.slug}": loaded ${Object.keys(mcpTools).length} MCP tools`
            );
        }

        // Append skill instructions to agent instructions
        let finalInstructions = instructions;
        if (skillInstructions) {
            finalInstructions += `\n\n---\n# Skills & Domain Knowledge\n${skillInstructions}`;
        }

        // Get scorers from registry (synchronous)
        const scorers = getScorersByNames(record.scorers);

        // Build model string
        const modelName = resolveModelName(record.modelProvider, record.modelName);
        const model = `${record.modelProvider}/${modelName}`;

        const defaultOptions = this.buildDefaultOptions(record);

        const workflows = this.loadWorkflows(record.workflows);

        // Create agent - using any to bypass strict typing issues with Mastra's Agent constructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentConfig: any = {
            id: record.id,
            name: record.name,
            instructions: finalInstructions,
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

        if (defaultOptions) {
            agentConfig.defaultOptions = defaultOptions;
        }

        if (Object.keys(subAgents).length > 0) {
            agentConfig.agents = subAgents;
        }

        if (Object.keys(workflows).length > 0) {
            agentConfig.workflows = workflows;
        }

        return {
            agent: new Agent(agentConfig),
            activeSkills,
            toolOriginMap,
            skillDocumentIds
        };
    }

    /**
     * Load skills attached to an agent via AgentSkill junction.
     * Returns merged skill instructions, resolved skill tools, document IDs,
     * active skill metadata, and a mapping of tool IDs to skill slugs.
     */
    private async loadSkills(
        agentId: string,
        organizationId?: string | null
    ): Promise<{
        skillInstructions: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        skillTools: Record<string, any>;
        skillDocumentIds: string[];
        activeSkills: ActiveSkillInfo[];
        skillToolMapping: Record<string, string>;
    }> {
        const agentSkills = await prisma.agentSkill.findMany({
            where: { agentId },
            include: {
                skill: {
                    include: {
                        documents: {
                            include: {
                                document: {
                                    select: { id: true, slug: true, name: true }
                                }
                            }
                        },
                        tools: true
                    }
                }
            }
        });

        if (agentSkills.length === 0) {
            return {
                skillInstructions: "",
                skillTools: {},
                skillDocumentIds: [],
                activeSkills: [],
                skillToolMapping: {}
            };
        }

        let skillInstructions = "";
        const skillToolIds: string[] = [];
        const skillDocumentIds: string[] = [];
        const activeSkills: ActiveSkillInfo[] = [];
        const skillToolMapping: Record<string, string> = {};

        for (const { skill } of agentSkills) {
            // Track active skill metadata
            activeSkills.push({
                skillId: skill.id,
                skillSlug: skill.slug,
                skillVersion: skill.version
            });

            skillInstructions += `\n\n## Skill: ${skill.name}\n${skill.instructions}`;
            if (skill.examples) {
                skillInstructions += `\n\n### Examples:\n${skill.examples}`;
            }

            // Append associated document info to skill instructions (for RAG scoping)
            if (skill.documents.length > 0) {
                skillInstructions += `\n\n### Associated Knowledge Base Documents:`;
                for (const sd of skill.documents) {
                    const roleSuffix = sd.role ? ` (${sd.role})` : "";
                    skillInstructions += `\n- ${sd.document.name}${roleSuffix}`;
                    skillDocumentIds.push(sd.documentId);
                }
            }

            for (const st of skill.tools) {
                skillToolIds.push(st.toolId);
                skillToolMapping[st.toolId] = skill.slug;
            }
        }

        const skillTools =
            skillToolIds.length > 0 ? await getToolsByNamesAsync(skillToolIds, organizationId) : {};

        return {
            skillInstructions,
            skillTools,
            skillDocumentIds,
            activeSkills,
            skillToolMapping
        };
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
     * Build provider-specific default options from modelConfig
     */
    private buildDefaultOptions(record: AgentRecordWithTools): object | undefined {
        const modelConfig = record.modelConfig as ModelConfig | null;
        if (!modelConfig) return undefined;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = {};

        if (modelConfig.toolChoice !== undefined) {
            options.toolChoice = modelConfig.toolChoice;
        }

        if (modelConfig.reasoning !== undefined) {
            options.reasoning = modelConfig.reasoning;
        }

        if (record.modelProvider === "openai") {
            const openaiOptions: Record<string, unknown> = {};
            if (modelConfig.parallelToolCalls !== undefined) {
                openaiOptions.parallelToolCalls = modelConfig.parallelToolCalls;
            }
            if (modelConfig.reasoningEffort) {
                openaiOptions.reasoningEffort = modelConfig.reasoningEffort;
            }
            if (Object.keys(openaiOptions).length > 0) {
                options.providerOptions = {
                    ...options.providerOptions,
                    openai: openaiOptions
                };
            }
        }

        if (record.modelProvider === "anthropic") {
            const anthropicOptions: Record<string, unknown> = {};
            if (modelConfig.thinking?.type === "enabled") {
                anthropicOptions.thinking = {
                    type: "enabled",
                    budgetTokens: modelConfig.thinking.budget_tokens || 10000
                };
            }
            if (modelConfig.cacheControl) {
                anthropicOptions.cacheControl = modelConfig.cacheControl;
            }
            if (Object.keys(anthropicOptions).length > 0) {
                options.providerOptions = {
                    ...options.providerOptions,
                    anthropic: anthropicOptions
                };
            }
        }

        return Object.keys(options).length > 0 ? options : undefined;
    }

    private async loadSubAgents(
        slugs: string[] | null | undefined,
        requestContext?: RequestContext
    ): Promise<Record<string, Agent>> {
        if (!slugs || slugs.length === 0) return {};

        const agents: Record<string, Agent> = {};
        for (const slug of slugs) {
            try {
                const { agent } = await this.resolve({
                    slug,
                    requestContext,
                    fallbackToSystem: true
                });
                agents[slug] = agent;
            } catch (error) {
                console.warn(`[AgentResolver] Failed to load sub-agent: ${slug}`, error);
            }
        }

        return agents;
    }

    private loadWorkflows(workflowIds: string[] | null | undefined): Record<string, unknown> {
        if (!workflowIds || workflowIds.length === 0) return {};

        const workflows: Record<string, unknown> = {};
        for (const id of workflowIds) {
            try {
                const workflow = mastra.getWorkflow(id);
                if (workflow) {
                    workflows[id] = workflow;
                } else {
                    console.warn(`[AgentResolver] Workflow not found: ${id}`);
                }
            } catch (error) {
                console.warn(`[AgentResolver] Failed to load workflow: ${id}`, error);
            }
        }

        return workflows;
    }

    /**
     * List all agents accessible by a user
     *
     * Includes:
     * - All SYSTEM agents (core platform agents)
     * - All DEMO agents (examples & templates)
     * - User's own agents
     * - Public agents from other users
     */
    async listForUser(userId?: string): Promise<AgentRecordWithTools[]> {
        if (userId) {
            return prisma.agent.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { type: "SYSTEM" },
                        { type: "DEMO" },
                        { ownerId: userId },
                        { isPublic: true }
                    ]
                },
                include: { tools: true, workspace: { select: { organizationId: true } } },
                orderBy: [{ type: "asc" }, { name: "asc" }]
            });
        }

        // No user - only SYSTEM, DEMO, and public agents
        return prisma.agent.findMany({
            where: {
                isActive: true,
                OR: [{ type: "SYSTEM" }, { type: "DEMO" }, { isPublic: true }]
            },
            include: { tools: true, workspace: { select: { organizationId: true } } },
            orderBy: [{ type: "asc" }, { name: "asc" }]
        });
    }

    /**
     * List all SYSTEM agents (core platform agents only, excludes DEMO)
     */
    async listSystem(): Promise<AgentRecordWithTools[]> {
        return prisma.agent.findMany({
            where: {
                type: "SYSTEM",
                isActive: true
            },
            include: { tools: true, workspace: { select: { organizationId: true } } },
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
            include: { tools: true, workspace: { select: { organizationId: true } } }
        });
    }
}

/**
 * Singleton instance of AgentResolver
 */
export const agentResolver = new AgentResolver();
