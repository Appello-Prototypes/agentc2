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
import { getToolsByNamesAsync, getAllMcpTools, toolRegistry } from "../tools/registry";
import { TOOL_OAUTH_REQUIREMENTS } from "../tools/oauth-requirements";
import { getScorersByNames } from "../scorers/registry";
import { getThreadSkillState } from "../skills/thread-state";
import { resolveModelForOrg } from "./model-provider";

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
    workspaceId?: string;
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
    /** Workspace ID for multi-tenant agent resolution */
    workspaceId?: string;
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
    /** Thread ID for loading thread-activated skills (progressive disclosure) */
    threadId?: string;
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
        const { slug, id, requestContext, fallbackToSystem = true, threadId } = options;

        if (!slug && !id) {
            throw new Error("Either slug or id must be provided");
        }

        // Derive workspaceId from request context for tenant isolation
        const workspaceId =
            requestContext?.workspaceId || requestContext?.resource?.workspaceId || undefined;

        // Build where clause with workspace isolation
        // When workspaceId is available, prefer workspace-scoped agents but fall back to system agents (null workspaceId)
        const slugWhere = slug
            ? {
                  slug,
                  isActive: true,
                  ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {})
              }
            : undefined;

        const idWhere = id ? { id, isActive: true } : undefined;

        // Try database first
        const record = await prisma.agent.findFirst({
            where: slugWhere || idWhere!,
            include: { tools: true, workspace: { select: { organizationId: true } } },
            // When workspace-scoped, prefer workspace agents over system agents
            ...(workspaceId && slug ? { orderBy: { workspaceId: "asc" as const } } : {})
        });

        if (record) {
            // Enforce hard budget limit before running the agent
            await this.checkBudgetLimit(record.id);

            const result = await this.hydrate(record, requestContext, threadId);
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
     * Supports progressive skill disclosure via pinned vs discoverable skills
     * Returns agent + skill metadata + tool origin map for observability
     */
    private async hydrate(
        record: AgentRecordWithTools,
        context?: RequestContext,
        threadId?: string
    ): Promise<{
        agent: Agent;
        activeSkills: ActiveSkillInfo[];
        toolOriginMap: Record<string, string>;
        skillDocumentIds: string[];
    }> {
        // Enrich context with Slack channel preferences for template interpolation
        const enrichedContext = await this.enrichContextWithSlackChannels(record, context || {});

        // Interpolate instructions if template exists
        const instructions = record.instructionsTemplate
            ? this.interpolateInstructions(record.instructionsTemplate, enrichedContext)
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

        const metadata = record.metadata as Record<string, unknown> | null;

        // Check if agent has skills — if so, use skill-based loading
        const hasSkills = await prisma.agentSkill.count({ where: { agentId: record.id } });

        // Warn about deprecated mcpEnabled when agent has skills
        if (hasSkills > 0 && metadata?.mcpEnabled) {
            console.warn(
                `[AgentResolver] DEPRECATION: Agent "${record.slug}" has skills AND mcpEnabled=true. ` +
                    `mcpEnabled is ignored when skills are present. MCP tools should be accessed through MCP skills.`
            );
        }

        // Load thread-activated skills (from previous conversation turns)
        const threadActivatedSlugs = threadId ? await getThreadSkillState(threadId) : [];

        // Parallelize independent async work: tools, skills, sub-agents, and MCP tools
        const [registryTools, skillResult, subAgents, mcpTools] = await Promise.all([
            getToolsByNamesAsync(toolNames, organizationId),
            this.loadSkills(record.id, organizationId, threadActivatedSlugs),
            this.loadSubAgents(record.subAgents, context),
            // Only load ALL MCP tools for legacy agents without skills
            hasSkills === 0 && metadata?.mcpEnabled
                ? getAllMcpTools(organizationId)
                : Promise.resolve({})
        ]);
        const {
            skillInstructions,
            skillTools,
            skillDocumentIds,
            activeSkills,
            hasDiscoverableSkills,
            discoverableSkillManifests
        } = skillResult;

        // Build tool origin map before merging (tracks where each tool came from)
        const toolOriginMap: Record<string, string> = {};
        for (const key of Object.keys(mcpTools)) {
            const serverName = key.split("_")[0] || "unknown";
            toolOriginMap[key] = `mcp:${serverName}`;
        }
        for (const key of Object.keys(skillTools)) {
            // Find which skill owns this tool — use dual origin format
            const ownerSkill = activeSkills.find(
                (s) => skillResult.skillToolMapping?.[key] === s.skillSlug
            );
            const skillOrigin = ownerSkill ? `skill:${ownerSkill.skillSlug}` : "skill:unknown";
            // Check if the tool is an MCP tool (contains underscore prefix pattern)
            const serverName = key.split("_")[0];
            const isMcpTool = serverName && key.includes("_") && serverName !== key;
            toolOriginMap[key] = isMcpTool ? `${skillOrigin}|mcp:${serverName}` : skillOrigin;
        }
        for (const key of Object.keys(registryTools)) {
            // If this tool also came from a skill, preserve dual-origin attribution
            const existingSkillOrigin = toolOriginMap[key];
            if (existingSkillOrigin && existingSkillOrigin.startsWith("skill:")) {
                toolOriginMap[key] = `registry+${existingSkillOrigin}`;
            } else {
                toolOriginMap[key] = "registry";
            }
        }

        // Merge tools: MCP tools (lowest priority) -> skill tools -> registry tools (highest)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: Record<string, any> = { ...mcpTools, ...skillTools, ...registryTools };

        // Inject skill discovery meta-tools if agent has discoverable (non-pinned) skills
        if (hasDiscoverableSkills) {
            // Add the three meta-tools for progressive skill discovery
            if (toolRegistry["search-skills"]) {
                tools["search-skills"] = toolRegistry["search-skills"];
                toolOriginMap["search-skills"] = "meta";
            }
            if (toolRegistry["activate-skill"]) {
                tools["activate-skill"] = toolRegistry["activate-skill"];
                toolOriginMap["activate-skill"] = "meta";
            }
            if (toolRegistry["list-active-skills"]) {
                tools["list-active-skills"] = toolRegistry["list-active-skills"];
                toolOriginMap["list-active-skills"] = "meta";
            }

            console.log(
                `[AgentResolver] Skill discovery enabled for "${record.slug}": ` +
                    `${activeSkills.length} active skills, ` +
                    `${discoverableSkillManifests.length} discoverable skills via meta-tools`
            );
        }

        // Connection-gate: remove OAuth tools without active connections for this org
        const connectedProviders = await this.getConnectedProviderKeys(organizationId);
        for (const [toolId, providerKey] of Object.entries(TOOL_OAUTH_REQUIREMENTS)) {
            if (tools[toolId] && !connectedProviders.has(providerKey)) {
                delete tools[toolId];
                toolOriginMap[toolId] = `filtered:no-connection:${providerKey}`;
                console.log(
                    `[AgentResolver] Filtered out "${toolId}" -- ` +
                        `requires "${providerKey}" OAuth connection (not connected)`
                );
            }
        }

        if (hasSkills === 0 && metadata?.mcpEnabled && Object.keys(mcpTools).length > 0) {
            console.log(
                `[AgentResolver] Legacy MCP-enabled agent "${record.slug}": loaded ${Object.keys(mcpTools).length} MCP tools`
            );
        }

        // Append skill instructions to agent instructions
        let finalInstructions = instructions;
        if (skillInstructions) {
            finalInstructions += `\n\n---\n# Skills & Domain Knowledge\n${skillInstructions}`;
        }

        // Append discoverable skill manifests as a guide for meta-tool usage
        if (hasDiscoverableSkills && discoverableSkillManifests.length > 0) {
            finalInstructions += `\n\n---\n# Available Skills (Not Yet Loaded)\n`;
            finalInstructions += `You have access to additional skills that can be activated on demand. `;
            finalInstructions += `Use the search-skills and activate-skill tools to discover and load them.\n\n`;
            finalInstructions += `Available skills:\n`;
            for (const manifest of discoverableSkillManifests) {
                finalInstructions += `- **${manifest.name}** (\`${manifest.slug}\`): ${manifest.description}\n`;
            }
        }

        // Append institutional knowledge from active recommendations
        try {
            const recommendations = await prisma.agentRecommendation.findMany({
                where: {
                    agentId: record.id,
                    status: "active",
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
                },
                orderBy: [{ frequency: "desc" }, { createdAt: "desc" }],
                take: 15 // Cap to prevent prompt bloat
            });

            if (recommendations.length > 0) {
                const sustain = recommendations.filter((r) => r.type === "sustain");
                const improve = recommendations.filter((r) => r.type === "improve");

                let section = "\n\n---\n# Institutional Knowledge (from recent evaluations)\n";

                if (sustain.length > 0) {
                    section += "\n## Things to Sustain\n";
                    for (const r of sustain) {
                        section += `- ${r.description}\n`;
                    }
                }

                if (improve.length > 0) {
                    section += "\n## Things to Improve\n";
                    for (const r of improve) {
                        section += `- ${r.description}\n`;
                    }
                }

                finalInstructions += section;
            }
        } catch {
            // Non-critical: continue without recommendations
        }

        // Get scorers from registry (synchronous)
        const scorers = getScorersByNames(record.scorers);

        // Resolve model — prefer org-scoped API key, fall back to string-based model router
        const modelName = resolveModelName(record.modelProvider, record.modelName);
        const resolvedModel = await resolveModelForOrg(
            record.modelProvider,
            modelName,
            organizationId
        );
        const model = resolvedModel ?? `${record.modelProvider}/${modelName}`;

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
     *
     * Supports progressive disclosure:
     * - Pinned skills (pinned=true): Always loaded, tools + instructions included
     * - Thread-activated skills: Previously activated via meta-tools, loaded from ThreadSkillState
     * - Discoverable skills (pinned=false, not thread-activated): Only manifests returned
     *
     * Returns merged skill instructions, resolved skill tools, document IDs,
     * active skill metadata, discoverable skill manifests, and tool-to-skill mapping.
     */

    /**
     * Check if an agent has exceeded its hard budget limit.
     * Throws if the agent's monthly spend >= the configured limit with hardLimit enabled.
     * Called before hydration to reject runs early without incurring tool/skill loading costs.
     */
    private async checkBudgetLimit(agentId: string): Promise<void> {
        const budgetPolicy = await prisma.budgetPolicy.findUnique({
            where: { agentId }
        });

        if (!budgetPolicy?.enabled || !budgetPolicy.hardLimit || !budgetPolicy.monthlyLimitUsd) {
            return;
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const costEvents = await prisma.costEvent.findMany({
            where: {
                agentId,
                createdAt: { gte: startOfMonth }
            },
            select: { costUsd: true }
        });

        const currentMonthCost = costEvents.reduce((sum, e) => sum + (e.costUsd || 0), 0);

        if (currentMonthCost >= budgetPolicy.monthlyLimitUsd) {
            throw new Error(
                `Agent budget exceeded: $${currentMonthCost.toFixed(2)} / $${budgetPolicy.monthlyLimitUsd} monthly limit`
            );
        }
    }

    /**
     * Get the set of OAuth provider keys that have active connections for an organization.
     * Used to filter out OAuth-dependent tools when the required connection is missing.
     */
    private async getConnectedProviderKeys(orgId?: string | null): Promise<Set<string>> {
        if (!orgId) return new Set();
        const connections = await prisma.integrationConnection.findMany({
            where: { organizationId: orgId, isActive: true },
            include: { provider: { select: { key: true } } }
        });
        return new Set(connections.map((c) => c.provider.key));
    }

    private async loadSkills(
        agentId: string,
        organizationId?: string | null,
        threadActivatedSlugs?: string[]
    ): Promise<{
        skillInstructions: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        skillTools: Record<string, any>;
        skillDocumentIds: string[];
        activeSkills: ActiveSkillInfo[];
        skillToolMapping: Record<string, string>;
        hasDiscoverableSkills: boolean;
        discoverableSkillManifests: Array<{
            slug: string;
            name: string;
            description: string;
        }>;
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
                skillToolMapping: {},
                hasDiscoverableSkills: false,
                discoverableSkillManifests: []
            };
        }

        let skillInstructions = "";
        const skillToolIds: string[] = [];
        const skillDocumentIds: string[] = [];
        const activeSkills: ActiveSkillInfo[] = [];
        const skillToolMapping: Record<string, string> = {};
        const discoverableSkillManifests: Array<{
            slug: string;
            name: string;
            description: string;
        }> = [];

        const activatedSet = new Set(threadActivatedSlugs || []);

        for (const agentSkill of agentSkills) {
            const { skill } = agentSkill;
            const isPinned = agentSkill.pinned;
            const isThreadActivated = activatedSet.has(skill.slug);

            // Skill is "active" if it's pinned OR thread-activated
            const shouldLoadFull = isPinned || isThreadActivated;

            if (shouldLoadFull) {
                // Full load: include tools, instructions, documents
                activeSkills.push({
                    skillId: skill.id,
                    skillSlug: skill.slug,
                    skillVersion: skill.version
                });

                skillInstructions += `\n\n## Skill: ${skill.name}\n${skill.instructions}`;
                if (skill.examples) {
                    skillInstructions += `\n\n### Examples:\n${skill.examples}`;
                }

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
            } else {
                // Discoverable: only include manifest (description) for meta-tool discovery
                discoverableSkillManifests.push({
                    slug: skill.slug,
                    name: skill.name,
                    description: skill.description || skill.instructions.slice(0, 200)
                });
            }
        }

        const skillTools =
            skillToolIds.length > 0 ? await getToolsByNamesAsync(skillToolIds, organizationId) : {};

        return {
            skillInstructions,
            skillTools,
            skillDocumentIds,
            activeSkills,
            skillToolMapping,
            hasDiscoverableSkills: discoverableSkillManifests.length > 0,
            discoverableSkillManifests
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

            // Handle slack.channels.* pattern (e.g., {{slack.channels.support}})
            if (parts.length === 3 && parts[0] === "slack" && parts[1] === "channels") {
                const channelMap = normalized.metadata?._slackChannels as
                    | Record<string, string>
                    | undefined;
                if (channelMap && parts[2] in channelMap) {
                    return channelMap[parts[2]];
                }
                // Keep placeholder if channel not configured
                return match;
            }

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
     * Enrich request context with Slack channel preferences.
     *
     * If the agent's organization has a Slack IntegrationConnection,
     * resolves channel preferences and injects them into context.metadata
     * so templates like {{slack.channels.support}} resolve correctly.
     */
    private async enrichContextWithSlackChannels(
        record: AgentRecordWithTools,
        context: RequestContext
    ): Promise<RequestContext> {
        const organizationId =
            context.resource?.tenantId ||
            context.tenantId ||
            record.workspace?.organizationId ||
            record.tenantId;

        if (!organizationId) return context;

        // Only enrich if the template references slack channels
        const template = record.instructionsTemplate;
        if (!template || !template.includes("{{slack.channels.")) return context;

        try {
            const provider = await prisma.integrationProvider.findUnique({
                where: { key: "slack" }
            });
            if (!provider) return context;

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: provider.id,
                    isActive: true
                },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });
            if (!connection) return context;

            // Resolve channel map (purposeKey -> channelId)
            const prefs = await prisma.slackChannelPreference.findMany({
                where: { integrationConnectionId: connection.id }
            });

            const channelMap: Record<string, string> = {};
            for (const p of prefs) {
                // Org-wide defaults (userId null), can be overridden by user-specific
                if (p.userId === null && !channelMap[p.purposeKey]) {
                    channelMap[p.purposeKey] = p.channelName
                        ? `#${p.channelName.replace(/^#/, "")}`
                        : p.channelId;
                }
            }

            return {
                ...context,
                metadata: {
                    ...(context.metadata || {}),
                    _slackChannels: channelMap
                }
            };
        } catch (error) {
            console.warn("[AgentResolver] Failed to enrich Slack channels:", error);
            return context;
        }
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
     * Check if an agent exists by slug (optionally within a workspace)
     */
    async exists(slug: string, workspaceId?: string | null): Promise<boolean> {
        const count = await prisma.agent.count({
            where: {
                slug,
                isActive: true,
                ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {})
            }
        });
        return count > 0;
    }

    /**
     * Get an agent record by slug (without hydration, optionally workspace-scoped)
     */
    async getRecord(
        slug: string,
        workspaceId?: string | null
    ): Promise<AgentRecordWithTools | null> {
        return prisma.agent.findFirst({
            where: {
                slug,
                ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {})
            },
            include: { tools: true, workspace: { select: { organizationId: true } } }
        });
    }
}

/**
 * Singleton instance of AgentResolver
 */
export const agentResolver = new AgentResolver();

// ── Model Routing ────────────────────────────────────────────────────────────

/**
 * Routing configuration stored on the Agent record
 */
export interface RoutingConfig {
    mode: "locked" | "auto";
    fastModel?: { provider: string; name: string };
    escalationModel?: { provider: string; name: string };
    confidenceThreshold?: number; // 0-1, default 0.7
    budgetAware?: boolean;
}

export type RoutingTier = "FAST" | "PRIMARY" | "ESCALATION";

export interface RoutingDecision {
    tier: RoutingTier;
    model: { provider: string; name: string };
    reason: string;
}

/**
 * Classify the complexity of user input using lightweight heuristics.
 * Returns a score from 0 (trivial) to 1 (very complex).
 */
export function classifyComplexity(input: string): {
    score: number;
    level: "simple" | "moderate" | "complex";
} {
    let score = 0;

    // Length-based: longer inputs tend to be more complex
    const wordCount = input.split(/\s+/).filter(Boolean).length;
    if (wordCount > 100) score += 0.3;
    else if (wordCount > 40) score += 0.15;
    else if (wordCount > 15) score += 0.05;

    // Multi-step indicators
    const multiStepPatterns =
        /\b(step\s*\d|first.*then|next.*after|please.*and.*also|multi[- ]?step|compare.*and|analyze.*and|1\.\s|2\.\s|3\.\s|\band\b.*\band\b)/i;
    if (multiStepPatterns.test(input)) score += 0.25;

    // Complex reasoning keywords
    const complexKeywords =
        /\b(analyze|synthesize|evaluate|compare|contrast|critique|refactor|architect|design|optimize|debug|troubleshoot|explain.*why|reason.*about|trade[- ]?off|pros?\s+and\s+cons?)\b/i;
    if (complexKeywords.test(input)) score += 0.2;

    // Code-related complexity
    const codePatterns = /```[\s\S]*```|function\s+\w+|class\s+\w+|import\s+/;
    if (codePatterns.test(input)) score += 0.15;

    // Question complexity
    const simpleQuestionPatterns = /^(what is|who is|when did|where is|how many|yes or no)\b/i;
    if (simpleQuestionPatterns.test(input) && wordCount < 15) score -= 0.15;

    // Greetings / simple messages
    const greetingPatterns = /^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no|bye|good)\b/i;
    if (greetingPatterns.test(input) && wordCount < 5) score -= 0.3;

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score));

    const level = score >= 0.5 ? "complex" : score >= 0.2 ? "moderate" : "simple";
    return { score, level };
}

/**
 * Determine which model tier to use based on routing config and input complexity.
 * Returns null if routing is disabled (locked mode or no config).
 */
export function resolveRoutingDecision(
    routingConfig: RoutingConfig | null | undefined,
    primaryModel: { provider: string; name: string },
    input: string,
    budgetExceeded?: boolean
): RoutingDecision | null {
    if (!routingConfig || routingConfig.mode !== "auto") {
        return null; // Routing disabled, use primary model as-is
    }

    const { score, level } = classifyComplexity(input);
    const threshold = routingConfig.confidenceThreshold ?? 0.7;

    // Budget-aware: if over budget threshold, bias toward fast model for moderate tasks
    const budgetBias = routingConfig.budgetAware && budgetExceeded;

    let tier: RoutingTier;
    let model: { provider: string; name: string };
    let reason: string;

    if (level === "simple" || (level === "moderate" && budgetBias)) {
        // Use fast model
        tier = "FAST";
        model = routingConfig.fastModel || primaryModel;
        reason =
            level === "simple"
                ? `Simple input (score=${score.toFixed(2)})`
                : `Moderate input biased to fast (budget-aware, score=${score.toFixed(2)})`;
    } else if (level === "complex" || score >= threshold) {
        // Use escalation model if configured, otherwise primary
        if (routingConfig.escalationModel?.name) {
            tier = "ESCALATION";
            model = routingConfig.escalationModel;
            reason = `Complex input (score=${score.toFixed(2)}, threshold=${threshold})`;
        } else {
            tier = "PRIMARY";
            model = primaryModel;
            reason = `Complex input, no escalation model configured (score=${score.toFixed(2)})`;
        }
    } else {
        // Moderate -> primary model
        tier = "PRIMARY";
        model = primaryModel;
        reason = `Moderate input (score=${score.toFixed(2)})`;
    }

    return { tier, model, reason };
}
