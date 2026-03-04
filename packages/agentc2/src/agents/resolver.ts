/**
 * Agent Resolver
 *
 * Resolves agents from the database with fallback to code-defined agents.
 * Supports RequestContext for runtime context injection and dynamic instructions.
 */

import { createHash } from "crypto";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { prisma, Prisma } from "@repo/database";
import { mastra } from "../mastra";
import { storage } from "../storage";
import { vector } from "../vector";
import {
    getToolsByNamesAsync,
    getAllMcpTools,
    toolRegistry,
    toolCredentialChecks,
    detectLethalTrifecta
} from "../tools/registry";
import { TOOL_OAUTH_REQUIREMENTS } from "../tools/oauth-requirements";
import { TokenLimiter, ToolCallFilter } from "@mastra/core/processors";
import { wrapToolsWithPermissionGuard } from "../security/tool-execution-guard";
import {
    createInputGuardrailProcessor,
    createOutputGuardrailProcessor
} from "../processors/guardrail-processors";

import { getThreadSkillState } from "../skills/thread-state";
import { recordActivity } from "../activity/service";
import { budgetEnforcement } from "../budget";
import { resolveModelForOrg } from "./model-provider";
import { resolveModelAlias } from "./model-registry";
import type { ModelConfig, AnthropicProviderConfig } from "./model-config-types";

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

function resolveModelName(provider: string, modelName: string) {
    const resolved = resolveModelAlias(provider, modelName);
    if (resolved !== modelName) {
        console.warn(
            `[AgentResolver] Remapping model ${provider}/${modelName} -> ${provider}/${resolved}`
        );
    }
    return resolved;
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
    /** When true, load ALL skills (pinned + discoverable) with their tools.
     *  Use for autonomous execution (campaigns, workflows, triggers) where
     *  there is no conversation thread for progressive disclosure. */
    loadAllSkills?: boolean;
    /** When provided, only load tools whose names include at least one of
     *  these substrings. System tools (campaign-write-*, agent-*, etc.) are
     *  always included. Use for campaign tasks to reduce token overhead. */
    toolFilter?: string[];
    /** Override the agent's configured model. Used by model routing to swap
     *  to a fast or escalation model based on input complexity. */
    modelOverride?: { provider: string; name: string };
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
 * Tool health snapshot captured at agent resolution time.
 * Tracks expected vs loaded tools for observability and debugging.
 */
export interface ToolHealthSnapshot {
    /** Number of tools the agent expected to have (AgentTool + SkillTool records) */
    expectedCount: number;
    /** Number of tools actually loaded and available */
    loadedCount: number;
    /** Tool IDs that were expected but could not be loaded */
    missingTools: string[];
    /** Tool IDs that were filtered out (OAuth, budget, etc.) */
    filteredTools: string[];
    /** Pre-flight readiness issues (truncated instructions, missing model, etc.) */
    readinessIssues?: string[];
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
    /** Tool health snapshot — expected vs loaded tools */
    toolHealth: ToolHealthSnapshot;
    /** All tool names loaded on the resolved agent (for finish-tool pattern detection) */
    resolvedToolNames: string[];
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
    maxWorkingMemoryChars?: number;
}

// ModelConfig imported from ./model-config-types

/**
 * Structured error thrown when an agent's monthly spend exceeds its hard budget limit.
 * Carries budget details so consumers (e.g. chat route) can render a user-facing upgrade flow
 * instead of a generic 500 error. This is a critical SaaS revenue touchpoint.
 */
export class BudgetExceededError extends Error {
    public readonly code = "BUDGET_EXCEEDED" as const;
    public readonly agentId: string;
    public readonly currentSpendUsd: number;
    public readonly monthlyLimitUsd: number;
    public readonly periodStart: string;
    public readonly periodEnd: string;

    constructor(details: {
        agentId: string;
        currentSpendUsd: number;
        monthlyLimitUsd: number;
        periodStart: string;
        periodEnd: string;
    }) {
        super(
            `Agent budget exceeded: $${details.currentSpendUsd.toFixed(2)} / $${details.monthlyLimitUsd} monthly limit`
        );
        this.name = "BudgetExceededError";
        this.agentId = details.agentId;
        this.currentSpendUsd = details.currentSpendUsd;
        this.monthlyLimitUsd = details.monthlyLimitUsd;
        this.periodStart = details.periodStart;
        this.periodEnd = details.periodEnd;
    }

    /** Serialize to a plain object for API responses / stream data parts */
    toJSON() {
        return {
            code: this.code,
            agentId: this.agentId,
            currentSpendUsd: this.currentSpendUsd,
            monthlyLimitUsd: this.monthlyLimitUsd,
            periodStart: this.periodStart,
            periodEnd: this.periodEnd
        };
    }
}

/**
 * AgentResolver class
 *
 * Provides database-first agent resolution with fallback to code-defined agents.
 */
export class AgentResolver {
    /** Temporary storage for current resolve options (used by hydrate) */
    private currentResolveOptions?: ResolveOptions;

    /** In-memory cache for hydrated agents to avoid repeated DB+hydrate overhead */
    private hydrationCache = new Map<
        string,
        { result: Omit<HydratedAgent, "record" | "source">; expiresAt: number }
    >();
    private static HYDRATION_CACHE_TTL_MS = 30_000;

    /**
     * Resolve an agent by slug or id
     *
     * @param options - Resolution options including slug, id, and requestContext
     * @returns Hydrated agent with metadata
     * @throws Error if agent not found
     */
    async resolve(options: ResolveOptions): Promise<HydratedAgent> {
        this.currentResolveOptions = options;
        const {
            slug,
            id,
            requestContext,
            fallbackToSystem = true,
            threadId,
            loadAllSkills
        } = options;

        if (!slug && !id) {
            throw new Error("Either slug or id must be provided");
        }

        // Derive workspaceId from request context for tenant isolation
        const workspaceId =
            requestContext?.workspaceId || requestContext?.resource?.workspaceId || undefined;

        // Build where clause with workspace isolation
        // When workspaceId is available, prefer workspace-scoped agents but fall back to
        // other workspaces in the same org and system agents (null workspaceId).
        const organizationId = requestContext?.tenantId || undefined;
        const slugWhere = slug
            ? {
                  slug,
                  isActive: true,
                  ...(workspaceId
                      ? {
                            OR: [
                                { workspaceId },
                                { workspaceId: null },
                                ...(organizationId ? [{ workspace: { organizationId } }] : [])
                            ]
                        }
                      : organizationId
                        ? {
                              OR: [{ workspace: { organizationId } }, { workspaceId: null }]
                          }
                        : {})
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
            // Enforce hard budget limit before running the agent (full hierarchy)
            // Budget checks must always run live, never cached
            await this.checkBudgetLimit(record.id, {
                userId: requestContext?.userId,
                organizationId: record.workspace?.organizationId
            });

            // Check hydration cache (keyed by slug:version:threadId:loadAllSkills)
            const cacheKey = `${record.slug}:${record.version}:${threadId || "none"}:${loadAllSkills ? "all" : "prog"}`;
            const cached = this.hydrationCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                console.log(
                    `[AgentResolver] Hydration cache HIT for "${record.slug}" v${record.version} (TTL ${Math.round((cached.expiresAt - Date.now()) / 1000)}s remaining)`
                );
                return { ...cached.result, record, source: "database" };
            }

            const result = await this.hydrate(record, requestContext, threadId, loadAllSkills);

            // Store in hydration cache
            this.hydrationCache.set(cacheKey, {
                result,
                expiresAt: Date.now() + AgentResolver.HYDRATION_CACHE_TTL_MS
            });

            // Evict expired entries lazily (every ~10 resolves)
            if (this.hydrationCache.size > 20) {
                const now = Date.now();
                for (const [key, entry] of this.hydrationCache) {
                    if (entry.expiresAt <= now) this.hydrationCache.delete(key);
                }
            }

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
                        skillDocumentIds: [],
                        toolHealth: {
                            expectedCount: 0,
                            loadedCount: 0,
                            missingTools: [],
                            filteredTools: []
                        },
                        resolvedToolNames: []
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
        threadId?: string,
        loadAllSkills?: boolean
    ): Promise<{
        agent: Agent;
        activeSkills: ActiveSkillInfo[];
        toolOriginMap: Record<string, string>;
        skillDocumentIds: string[];
        toolHealth: ToolHealthSnapshot;
        resolvedToolNames: string[];
    }> {
        // Enrich context with Slack channel preferences for template interpolation
        const enrichedContext = await this.enrichContextWithSlackChannels(record, context || {});

        // Interpolate instructions if template exists
        let instructions = record.instructionsTemplate
            ? this.interpolateInstructions(record.instructionsTemplate, enrichedContext)
            : record.instructions;

        // Apply instance-specific overrides when present
        const instanceCtx = enrichedContext.metadata?._instanceContext as
            | Record<string, unknown>
            | undefined;
        if (instanceCtx?.instructionOverrides) {
            instructions = instructions + "\n\n" + String(instanceCtx.instructionOverrides);
        }

        // Instance temperature override (applied to record for downstream model config)
        if (
            instanceCtx?.temperatureOverride !== undefined &&
            instanceCtx?.temperatureOverride !== null &&
            typeof instanceCtx.temperatureOverride === "number"
        ) {
            (record as Record<string, unknown>).temperature = instanceCtx.temperatureOverride;
        }

        // Instance maxSteps override (stored on enrichedContext for callers to read)
        if (
            instanceCtx?.maxStepsOverride !== undefined &&
            instanceCtx?.maxStepsOverride !== null &&
            typeof instanceCtx.maxStepsOverride === "number"
        ) {
            (record as Record<string, unknown>).maxSteps = instanceCtx.maxStepsOverride;
        }

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
            this.loadSkills(record.id, organizationId, threadActivatedSlugs, loadAllSkills),
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

        // Compute expected tool set (everything the agent was configured to have)
        const expectedSkillToolIds = skillResult.skillToolMapping
            ? Object.keys(skillResult.skillToolMapping)
            : [];
        const expectedToolNames = new Set([...toolNames, ...expectedSkillToolIds]);
        const filteredTools: string[] = [];

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
                filteredTools.push(toolId);
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

        // Apply tool filter if provided (campaign task optimization)
        if (loadAllSkills && this.currentResolveOptions?.toolFilter?.length) {
            const filter = this.currentResolveOptions.toolFilter;
            // System tools that are always kept regardless of filter
            const systemPrefixes = [
                "campaign-",
                "agent-",
                "date-time",
                "updateWorkingMemory",
                "document-",
                "search-skills",
                "activate-skill",
                "list-active-skills"
            ];
            const beforeCount = Object.keys(tools).length;
            for (const toolKey of Object.keys(tools)) {
                const isSystem = systemPrefixes.some((p) => toolKey.startsWith(p));
                const matchesFilter = filter.some((f) =>
                    toolKey.toLowerCase().includes(f.toLowerCase())
                );
                if (!isSystem && !matchesFilter) {
                    delete tools[toolKey];
                }
            }
            const afterCount = Object.keys(tools).length;
            if (beforeCount !== afterCount) {
                console.log(
                    `[AgentResolver] Tool filter applied for "${record.slug}": ${beforeCount} -> ${afterCount} tools ` +
                        `(filter: ${filter.join(", ")})`
                );
            }
        }

        // Context-aware tool budgeting: when an agent has many tools and a maxToolsLoaded
        // threshold is configured in metadata, cap the number of tools loaded to reduce
        // token overhead. Essential + always-loaded tools are kept first, then remaining
        // tools fill the budget. Overflow tools stay accessible via skill activation meta-tools.
        const maxToolsLoaded = (metadata?.maxToolsLoaded as number) || 0;
        if (maxToolsLoaded > 0 && !loadAllSkills) {
            const totalTools = Object.keys(tools).length;
            if (totalTools > maxToolsLoaded) {
                // Essential tools that are always kept: meta-tools, memory, utilities
                const essentialPrefixes = [
                    "date-time",
                    "calculator",
                    "updateWorkingMemory",
                    "memory-recall",
                    "search-skills",
                    "activate-skill",
                    "list-active-skills",
                    "rag-query",
                    "document-search",
                    "turn-complete"
                ];
                // Also keep tools explicitly listed in metadata.alwaysLoadedTools
                const alwaysLoaded = (metadata?.alwaysLoadedTools as string[]) || [];

                // Partition tools into priority tiers
                const priorityTools: string[] = [];
                const remainingTools: string[] = [];

                for (const toolKey of Object.keys(tools)) {
                    const isEssential = essentialPrefixes.some(
                        (p) => toolKey === p || toolKey.startsWith(p + "-")
                    );
                    const isAlwaysLoaded = alwaysLoaded.some(
                        (t) => toolKey === t || toolKey.toLowerCase().includes(t.toLowerCase())
                    );
                    // Protect all skill-origin tools (pinned + thread-activated)
                    // and meta-tools -- these must never be budget-cut
                    const origin = toolOriginMap[toolKey] ?? "";
                    const isSkillTool = origin.startsWith("skill:") || origin.includes("|skill:");
                    const isMetaTool = origin === "meta";

                    if (isEssential || isAlwaysLoaded || isSkillTool || isMetaTool) {
                        priorityTools.push(toolKey);
                    } else {
                        remainingTools.push(toolKey);
                    }
                }

                // Budget: fill remaining slots with non-priority tools
                const budget = Math.max(0, maxToolsLoaded - priorityTools.length);
                const toolsToKeep = new Set([...priorityTools, ...remainingTools.slice(0, budget)]);

                const beforeCount = Object.keys(tools).length;
                for (const toolKey of Object.keys(tools)) {
                    if (!toolsToKeep.has(toolKey)) {
                        delete tools[toolKey];
                    }
                }
                const afterCount = Object.keys(tools).length;
                console.log(
                    `[AgentResolver] Tool budget applied for "${record.slug}": ` +
                        `${beforeCount} -> ${afterCount} tools ` +
                        `(${priorityTools.length} priority + ${Math.min(budget, remainingTools.length)} additional, ` +
                        `maxToolsLoaded: ${maxToolsLoaded}). ` +
                        `${beforeCount - afterCount} tools accessible via skill activation.`
                );
            }
        }

        // --- Credential Gating ---
        // Remove tools whose required credentials are missing to prevent runtime failures
        const credentialFiltered: string[] = [];
        for (const toolName of Object.keys(tools)) {
            const check = toolCredentialChecks[toolName];
            if (check && !check()) {
                delete tools[toolName];
                credentialFiltered.push(toolName);
            }
        }
        if (credentialFiltered.length > 0) {
            filteredTools.push(...credentialFiltered);
            console.warn(
                `[AgentResolver] Credential gating for "${record.slug}": ` +
                    `removed ${credentialFiltered.length} tool(s) with missing credentials: ${credentialFiltered.join(", ")}`
            );
        }

        // --- Thread Context Binding ---
        // Inject threadId into tools that need session context to function correctly.
        // This must run after all tools are merged (registry, MCP, skill, meta) because
        // these tools can be loaded as regular AgentTool records.
        if (threadId) {
            const contextBoundToolIds = ["activate-skill", "list-active-skills", "memory-recall"];
            for (const toolId of contextBoundToolIds) {
                if (tools[toolId]) {
                    const originalExecute = tools[toolId].execute;
                    tools[toolId] = {
                        ...tools[toolId],
                        execute: (
                            input: Record<string, unknown>,
                            execCtx: Record<string, unknown>
                        ) => {
                            return originalExecute(
                                {
                                    ...input,
                                    threadId: input.threadId || threadId,
                                    agentId: input.agentId || record.slug
                                },
                                execCtx
                            );
                        }
                    };
                    console.log(
                        `[AgentResolver] Bound threadId to "${toolId}" for thread ${threadId.substring(0, 30)}…`
                    );
                }
            }
        }

        // --- Tool Health Check ---
        // Compare loaded tools against what was expected from AgentTool + SkillTool records
        const loadedToolNames = new Set(Object.keys(tools));
        const missingTools = [...expectedToolNames].filter((t) => !loadedToolNames.has(t));
        const toolHealth: ToolHealthSnapshot = {
            expectedCount: expectedToolNames.size,
            loadedCount: loadedToolNames.size,
            missingTools,
            filteredTools
        };

        if (missingTools.length > 0) {
            console.warn(
                `[AgentResolver] Tool health warning for "${record.slug}": ` +
                    `${missingTools.length} expected tool(s) not loaded: ${missingTools.join(", ")}. ` +
                    `(${loadedToolNames.size}/${expectedToolNames.size} loaded)`
            );

            // Record structured activity event for observability
            recordActivity({
                type: "ALERT_RAISED",
                agentId: record.id,
                agentSlug: record.slug,
                summary: `${record.slug}: ${missingTools.length} tool(s) unavailable`,
                detail: `Missing tools: ${missingTools.join(", ")}. Loaded: ${loadedToolNames.size}/${expectedToolNames.size}.`,
                status: "warning",
                source: "tool-health",
                tenantId: record.tenantId || undefined,
                metadata: {
                    missingTools,
                    expectedCount: expectedToolNames.size,
                    loadedCount: loadedToolNames.size,
                    filteredTools
                }
            });
        }

        // Inject agent identity so the LLM knows its own slug/ID for self-referencing tools
        let finalInstructions =
            instructions +
            `\n\n---\n# Agent Identity\nslug: ${record.slug}\nid: ${record.id}\nname: ${record.name}\n`;

        if (skillInstructions) {
            finalInstructions += `\n\n---\n# Skills & Domain Knowledge\n${skillInstructions}`;
        }

        // Inject unavailable tool notice so the LLM can gracefully handle missing tools
        if (missingTools.length > 0) {
            finalInstructions +=
                `\n\n---\n# Tool Availability Notice\n` +
                `The following tools are currently unavailable (MCP server may be down or tool not loaded): ` +
                `${missingTools.join(", ")}. ` +
                `If a user's request requires one of these tools, inform them the capability is temporarily ` +
                `unavailable and suggest alternative approaches or ask them to try again later. ` +
                `Do NOT attempt to call these tools.\n`;
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

        // Bind org context to workspace/sandbox tools so they use org-scoped paths
        if (organizationId) {
            const { bindWorkspaceContext } = await import("../tools/sandbox-tools");
            for (const toolKey of Object.keys(tools)) {
                tools[toolKey] = bindWorkspaceContext(tools[toolKey], {
                    organizationId,
                    agentId: record.slug
                });
            }
        }

        // Resolve model — prefer org-scoped API key, fall back to string-based model router
        // When modelOverride is provided (from model routing), use that instead of the record's model
        const modelOverride = this.currentResolveOptions?.modelOverride;
        let model;
        if (modelOverride) {
            const overrideName = resolveModelName(modelOverride.provider, modelOverride.name);
            const resolvedOverride = await resolveModelForOrg(
                modelOverride.provider,
                overrideName,
                organizationId
            );
            model = resolvedOverride ?? `${modelOverride.provider}/${overrideName}`;
        } else {
            const modelName = resolveModelName(record.modelProvider, record.modelName);
            const resolvedModel = await resolveModelForOrg(
                record.modelProvider,
                modelName,
                organizationId
            );
            model = resolvedModel ?? `${record.modelProvider}/${modelName}`;
        }

        // --- Tool Permission Guard ---
        // Wrap each tool's execute() with checkToolPermission + checkEgressPermission
        if (Object.keys(tools).length > 0) {
            const guardResult = wrapToolsWithPermissionGuard(
                tools,
                record.id,
                organizationId || undefined
            );
            if (guardResult.toolsGuarded > 0) {
                console.log(
                    `[AgentResolver] Permission guard applied to ${guardResult.toolsGuarded} tools for "${record.slug}"`
                );
            }

            // Lethal trifecta detection (warn only)
            const trifecta = detectLethalTrifecta(Object.keys(tools));
            if (trifecta) {
                console.warn(
                    `[AgentResolver] SECURITY WARNING for "${record.slug}": ${trifecta.warning}\n` +
                        `  Flagged tools: ${trifecta.flags.join(", ")}`
                );
                recordActivity({
                    type: "ALERT_RAISED",
                    agentId: record.id,
                    agentSlug: record.slug,
                    summary: `Lethal trifecta detected: ${record.slug}`,
                    detail: trifecta.warning,
                    status: "warning",
                    source: "security",
                    tenantId: record.tenantId || undefined,
                    metadata: { flags: trifecta.flags }
                });
            }
        }

        // --- Tool Result Compression ---
        const agentContextConfig = (record as Record<string, unknown>).contextConfig as
            | Record<string, unknown>
            | null
            | undefined;
        const compressionConfig = agentContextConfig?.toolResultCompression as
            | { enabled?: boolean; threshold?: number }
            | undefined;
        if (compressionConfig?.enabled) {
            const threshold = compressionConfig.threshold ?? 3000;
            for (const toolKey of Object.keys(tools)) {
                const original = tools[toolKey]!;
                const originalExecute = original.execute;
                tools[toolKey] = {
                    ...original,
                    execute: async (
                        input: Record<string, unknown>,
                        execCtx: Record<string, unknown>
                    ) => {
                        const result = await originalExecute(input, execCtx);
                        if (result === undefined || result === null) return result;
                        const str = typeof result === "string" ? result : JSON.stringify(result);
                        if (str.length <= threshold) return result;
                        if (typeof result === "object") {
                            try {
                                const truncated = JSON.stringify(result, (_, v) => {
                                    if (typeof v === "string" && v.length > 500) {
                                        return v.slice(0, 500) + "…[truncated]";
                                    }
                                    return v;
                                });
                                if (truncated.length <= threshold) return JSON.parse(truncated);
                            } catch {}
                            // Trim arrays to fit within threshold
                            try {
                                const shallow = { ...(result as Record<string, unknown>) };
                                for (const [k, v] of Object.entries(shallow)) {
                                    if (Array.isArray(v) && v.length > 3) {
                                        shallow[k] = [
                                            ...v.slice(0, 3),
                                            `…[${v.length - 3} more items]`
                                        ];
                                    }
                                }
                                const trimmed = JSON.stringify(shallow);
                                if (trimmed.length <= threshold * 1.5) return JSON.parse(trimmed);
                            } catch {}
                        }
                        return {
                            _truncated: true,
                            _originalChars: str.length,
                            content: str.slice(0, threshold)
                        };
                    }
                };
            }
        }

        const defaultOptions = this.buildDefaultOptions(record);

        const workflows = this.loadWorkflows(record.workflows);

        // --- Mastra Processors ---
        // Wire guardrail processors + memory processors at the Agent level
        const tenantId = organizationId || record.tenantId || undefined;
        // Model-aware TokenLimiter: use contextConfig.maxContextTokens from agent,
        // or fall back to hardcoded 12K for agents without contextConfig
        const contextConfig = (record as Record<string, unknown>).contextConfig as
            | { maxContextTokens?: number }
            | null
            | undefined;
        const tokenLimit = contextConfig?.maxContextTokens
            ? Math.min(contextConfig.maxContextTokens, 50_000) // cap at 50K for safety
            : 12_000;
        const inputProcessors = [
            createInputGuardrailProcessor(record.id, tenantId),
            new TokenLimiter(tokenLimit)
        ];
        const outputProcessors = [
            createOutputGuardrailProcessor(record.id, tenantId),
            new ToolCallFilter(),
            new TokenLimiter(tokenLimit)
        ];

        // Create agent - using any to bypass strict typing issues with Mastra's Agent constructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentConfig: any = {
            id: record.id,
            name: record.name,
            instructions: finalInstructions,
            model,
            inputProcessors,
            outputProcessors
        };

        // Add optional fields
        if (Object.keys(tools).length > 0) {
            agentConfig.tools = tools;
        }

        if (memory) {
            agentConfig.memory = memory;
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

        // Pre-flight validation: catch truncated instructions, missing model, etc.
        const readinessIssues = this.validateAgentReadiness(record, finalInstructions, model);
        if (readinessIssues.length > 0) {
            toolHealth.readinessIssues = readinessIssues;
        }

        return {
            agent: new Agent(agentConfig),
            activeSkills,
            toolOriginMap,
            skillDocumentIds,
            toolHealth,
            resolvedToolNames: Object.keys(tools)
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
     * Pre-warm the hydration cache for the most recently updated active agents.
     * Fire-and-forget — errors are logged but never thrown.
     */
    async prewarm(limit = 5): Promise<void> {
        try {
            const topAgents = await prisma.agent.findMany({
                where: { isActive: true },
                orderBy: { updatedAt: "desc" },
                take: limit,
                select: { slug: true }
            });

            const results = await Promise.allSettled(
                topAgents.map((a) => this.resolve({ slug: a.slug }))
            );

            const warmed = results.filter((r) => r.status === "fulfilled").length;
            console.log(`[AgentResolver] Pre-warmed ${warmed}/${topAgents.length} agents`);
        } catch (e) {
            console.warn("[AgentResolver] Pre-warm failed:", e);
        }
    }

    /**
     * Check the full budget enforcement hierarchy before allowing a run.
     * Checks subscription credits → org budget → user budget → agent budget.
     * Throws BudgetExceededError if any level with hardLimit blocks the run.
     */
    private async checkBudgetLimit(
        agentId: string,
        ctx?: { userId?: string | null; organizationId?: string | null }
    ): Promise<void> {
        const result = await budgetEnforcement.check({
            agentId,
            userId: ctx?.userId,
            organizationId: ctx?.organizationId
        });

        if (!result.allowed && result.violations.length > 0) {
            const top = result.violations[0];
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            throw new BudgetExceededError({
                agentId,
                currentSpendUsd: Math.round(top.currentSpendUsd * 100) / 100,
                monthlyLimitUsd: top.limitUsd,
                periodStart: startOfMonth.toISOString(),
                periodEnd: new Date().toISOString()
            });
        }
    }

    /**
     * Validate that a hydrated agent is ready to serve requests.
     * Catches configuration problems (truncated instructions, missing model, hash mismatch)
     * before they reach the LLM and produce silent empty responses.
     *
     * Non-blocking: logs warnings but does not throw, to avoid breaking existing flows.
     * Returns the list of issues found (empty array = healthy).
     */
    private validateAgentReadiness(
        record: AgentRecordWithTools,
        finalInstructions: string,
        model: unknown
    ): string[] {
        const issues: string[] = [];

        if (!finalInstructions || finalInstructions.length < 50) {
            issues.push(
                `Instructions too short (${finalInstructions?.length ?? 0} chars) — ` +
                    `likely truncated or missing`
            );
        }

        if (!model) {
            issues.push("Model is null/undefined — LLM calls will fail");
        }

        // Cross-check against the stored version instructions to detect truncation
        if (record.instructions && finalInstructions) {
            const baseLen = record.instructions.length;
            // Final instructions should always be >= base instructions (we append identity, skills, etc.)
            // If final is shorter than base, something went wrong during hydration
            if (finalInstructions.length < baseLen * 0.5 && baseLen > 100) {
                issues.push(
                    `Final instructions (${finalInstructions.length} chars) are less than 50% ` +
                        `of base instructions (${baseLen} chars) — possible truncation`
                );
            }
        }

        if (issues.length > 0) {
            const hash = finalInstructions
                ? createHash("sha256").update(finalInstructions).digest("hex").slice(0, 16)
                : "n/a";
            console.error(
                `[AgentResolver] Agent readiness check FAILED for "${record.slug}" ` +
                    `(v${record.version}, hash=${hash}):`,
                issues
            );

            recordActivity({
                type: "ALERT_RAISED",
                agentId: record.id,
                agentSlug: record.slug,
                summary: `${record.slug}: agent readiness check failed`,
                detail: issues.join("; "),
                status: "warning",
                source: "agent-readiness",
                tenantId: record.tenantId || undefined,
                metadata: {
                    issues,
                    instructionsLength: finalInstructions?.length ?? 0,
                    modelPresent: !!model,
                    version: record.version
                }
            });
        }

        return issues;
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
        threadActivatedSlugs?: string[],
        loadAllSkills?: boolean
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
        const loadedSkillSlugs = new Set<string>();

        for (const agentSkill of agentSkills) {
            const { skill } = agentSkill;
            const isPinned = agentSkill.pinned;
            const isThreadActivated = activatedSet.has(skill.slug);

            // Skill is "active" if loadAllSkills is set, it's pinned, OR thread-activated
            const shouldLoadFull = loadAllSkills || isPinned || isThreadActivated;

            if (shouldLoadFull) {
                // If pinnedVersion is set, load that specific version's instructions
                let resolvedInstructions = skill.instructions;
                let resolvedVersion = skill.version;

                if (agentSkill.pinnedVersion != null) {
                    const pinnedVer = await prisma.skillVersion.findFirst({
                        where: {
                            skillId: skill.id,
                            version: agentSkill.pinnedVersion
                        },
                        select: { version: true, instructions: true }
                    });
                    if (pinnedVer) {
                        resolvedInstructions = pinnedVer.instructions;
                        resolvedVersion = pinnedVer.version;
                    }
                }

                activeSkills.push({
                    skillId: skill.id,
                    skillSlug: skill.slug,
                    skillVersion: resolvedVersion
                });

                skillInstructions += `\n\n## Skill: ${skill.name}\n${resolvedInstructions}`;
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
                loadedSkillSlugs.add(skill.slug);
            } else {
                // Discoverable: only include manifest (description) for meta-tool discovery
                discoverableSkillManifests.push({
                    slug: skill.slug,
                    name: skill.name,
                    description: skill.description || skill.instructions.slice(0, 200)
                });
                loadedSkillSlugs.add(skill.slug);
            }
        }

        // Load thread-activated skills not already in this agent's AgentSkill records.
        // This handles the case where a user activates a skill via activate-skill that
        // exists in the platform but isn't directly linked to this agent.
        const unlinkedSlugs = [...activatedSet].filter((s) => !loadedSkillSlugs.has(s));
        if (unlinkedSlugs.length > 0) {
            const unlinkedSkills = await prisma.skill.findMany({
                where: { slug: { in: unlinkedSlugs } },
                include: {
                    documents: {
                        include: {
                            document: { select: { id: true, slug: true, name: true } }
                        }
                    },
                    tools: true
                }
            });
            for (const skill of unlinkedSkills) {
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
                console.log(
                    `[AgentResolver] Loaded thread-activated skill "${skill.slug}" ` +
                        `(${skill.tools.length} tools) — not in agent's AgentSkill records`
                );
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
            // When loadAllSkills is true, all skills are loaded — nothing left to discover
            hasDiscoverableSkills: !loadAllSkills && discoverableSkillManifests.length > 0,
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
                return match;
            }

            // Handle instance.* patterns (e.g., {{instance.name}}, {{instance.context.companyName}})
            if (parts[0] === "instance") {
                const instanceCtx = normalized.metadata?._instanceContext as
                    | Record<string, unknown>
                    | undefined;
                if (!instanceCtx) return match;

                if (parts.length === 2) {
                    const value = instanceCtx[parts[1]];
                    if (value !== undefined && value !== null) return String(value);
                    return match;
                }
                // instance.context.fieldName — drill into contextData
                if (parts.length === 3 && parts[1] === "context") {
                    const contextData = instanceCtx.contextData as
                        | Record<string, unknown>
                        | undefined;
                    if (contextData && parts[2] in contextData) {
                        const value = contextData[parts[2]];
                        if (value !== undefined && value !== null) return String(value);
                    }
                    return match;
                }
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

    private static readonly DEFAULT_MAX_WORKING_MEMORY_CHARS = 4_000;
    private static readonly CONSOLIDATION_TARGET_CHARS = 2_000;

    /**
     * Build a Memory instance from configuration
     *
     * When semanticRecall is enabled, includes vector store and embedder.
     * When maxWorkingMemoryChars is set, proxies updateWorkingMemory to
     * auto-consolidate oversized memory via a fast model.
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

        const mem = new Memory(memoryConfig);

        const maxChars =
            config?.maxWorkingMemoryChars ?? AgentResolver.DEFAULT_MAX_WORKING_MEMORY_CHARS;

        if (maxChars > 0) {
            const originalUpdate = mem.updateWorkingMemory.bind(mem);
            const targetChars = AgentResolver.CONSOLIDATION_TARGET_CHARS;

            mem.updateWorkingMemory = async (args: {
                threadId: string;
                resourceId?: string;
                workingMemory: string;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                memoryConfig?: any;
            }): Promise<void> => {
                let { workingMemory } = args;

                if (!args.threadId) {
                    console.error(
                        "[AgentResolver] updateWorkingMemory called without threadId, skipping"
                    );
                    return;
                }

                if (workingMemory.length > maxChars) {
                    console.warn(
                        `[AgentResolver] Working memory exceeds ${maxChars} chars (${workingMemory.length}). ` +
                            `Consolidating to ~${targetChars} chars for thread ${args.threadId}`
                    );
                    try {
                        workingMemory = await AgentResolver.consolidateWorkingMemory(
                            workingMemory,
                            targetChars
                        );
                    } catch (err) {
                        console.error(
                            "[AgentResolver] Working memory consolidation failed, truncating:",
                            (err as Error)?.message || err
                        );
                        workingMemory = workingMemory.slice(0, maxChars);
                    }
                }

                // Retry once on failure before giving up
                try {
                    return await originalUpdate({ ...args, workingMemory });
                } catch (firstErr) {
                    console.warn(
                        `[AgentResolver] Working memory update failed for thread ${args.threadId}, retrying in 2s:`,
                        (firstErr as Error)?.message || firstErr
                    );
                    await new Promise((r) => setTimeout(r, 2000));
                    try {
                        return await originalUpdate({ ...args, workingMemory });
                    } catch (retryErr) {
                        console.error(
                            `[AgentResolver] Working memory update retry failed for thread ${args.threadId}:`,
                            (retryErr as Error)?.message || retryErr
                        );
                    }
                }
            };
        }

        return mem;
    }

    /**
     * Consolidate oversized working memory using a fast model.
     * Preserves factual user data and active projects while removing
     * redundant event logs and stale entries.
     */
    private static async consolidateWorkingMemory(
        memory: string,
        targetChars: number
    ): Promise<string> {
        const { generateText } = await import("ai");
        const { openai } = await import("@ai-sdk/openai");

        const result = await generateText({
            model: openai("gpt-4o-mini"),
            system: [
                "You are a working-memory compactor. Given an agent's working memory that has grown too large, ",
                "produce a consolidated version that fits within the target character limit.",
                "\n\nRules:",
                "\n- Preserve ALL factual information about the user (name, role, preferences)",
                "\n- Preserve active projects and their current status (keep only the 3-5 most recent)",
                "\n- Remove redundant greeting logs and duplicate event entries",
                "\n- Remove stale or completed items",
                "\n- Keep the same structured format (XML tags or sections) as the original",
                "\n- Output ONLY the consolidated memory, no commentary"
            ].join(""),
            prompt: `Target: ${targetChars} characters maximum.\n\nCurrent working memory (${memory.length} chars):\n\n${memory}`
        });

        return result.text;
    }

    /**
     * Build provider-specific default options from modelConfig.
     *
     * Supports two formats:
     *   1. Provider-keyed (new): { anthropic: { thinking: { type: "adaptive" }, effort: "high" }, openai: { ... } }
     *   2. Flat (deprecated):    { thinking: { type: "enabled", budgetTokens: 10000 }, parallelToolCalls: true }
     * Provider-keyed values take precedence; flat fields are used as fallback for backward compatibility.
     */
    private buildDefaultOptions(record: AgentRecordWithTools): object | undefined {
        const modelConfig = record.modelConfig as ModelConfig | null;

        const recordAny = record as Record<string, unknown>;
        const agentTemperature = recordAny.temperature as number | null | undefined;
        const agentMaxTokens = recordAny.maxTokens as number | null | undefined;

        // Even without modelConfig, temperature/maxTokens from the record should be passed
        const hasRecordSettings =
            (agentTemperature !== null && agentTemperature !== undefined) ||
            (agentMaxTokens !== null && agentMaxTokens !== undefined);

        if (!modelConfig && !hasRecordSettings) return undefined;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any = {};

        // Pass temperature and maxTokens from the agent record as modelSettings
        const modelSettings: Record<string, unknown> = {};
        if (agentTemperature !== null && agentTemperature !== undefined) {
            modelSettings.temperature = agentTemperature;
        }
        if (agentMaxTokens !== null && agentMaxTokens !== undefined) {
            modelSettings.maxOutputTokens = agentMaxTokens;
        }
        if (Object.keys(modelSettings).length > 0) {
            options.modelSettings = modelSettings;
        }

        if (!modelConfig) return options;

        if (modelConfig.toolChoice !== undefined) {
            options.toolChoice = modelConfig.toolChoice;
        }

        if (modelConfig.reasoning !== undefined) {
            options.reasoning = modelConfig.reasoning;
        }

        if (record.modelProvider === "openai") {
            const oaiCfg = modelConfig.openai ?? {};
            const openaiOptions: Record<string, unknown> = {};

            const parallelToolCalls = oaiCfg.parallelToolCalls ?? modelConfig.parallelToolCalls;
            if (parallelToolCalls !== undefined) {
                openaiOptions.parallelToolCalls = parallelToolCalls;
            }

            const reasoningEffort = oaiCfg.reasoningEffort ?? modelConfig.reasoningEffort;
            if (reasoningEffort) {
                openaiOptions.reasoningEffort = reasoningEffort;
            }

            if (oaiCfg.structuredOutputMode) {
                openaiOptions.structuredOutputMode = oaiCfg.structuredOutputMode;
            }

            if (Object.keys(openaiOptions).length > 0) {
                options.providerOptions = {
                    ...options.providerOptions,
                    openai: openaiOptions
                };
            }
        }

        if (record.modelProvider === "anthropic") {
            const anthCfg: AnthropicProviderConfig = modelConfig.anthropic ?? {};
            const anthropicOptions: Record<string, unknown> = {};

            const thinking = anthCfg.thinking ?? modelConfig.thinking;
            if (thinking?.type === "adaptive") {
                anthropicOptions.thinking = { type: "adaptive" };
            } else if (thinking?.type === "enabled") {
                const thinkingConfig = thinking as Record<string, unknown>;
                const budgetTokens =
                    (thinkingConfig.budgetTokens as number) ||
                    (thinkingConfig.budget_tokens as number) ||
                    10000;
                anthropicOptions.thinking = {
                    type: "enabled",
                    budgetTokens
                };
                // Anthropic requires max_tokens > thinking.budgetTokens.
                const currentMaxTokens =
                    (options.modelSettings?.maxOutputTokens as number | undefined) ??
                    agentMaxTokens;
                if (currentMaxTokens && currentMaxTokens <= budgetTokens) {
                    const adjustedMaxTokens = budgetTokens + 8192;
                    console.warn(
                        `[AgentResolver] Agent "${record.slug}": maxTokens (${currentMaxTokens}) <= thinking.budgetTokens (${budgetTokens}). ` +
                            `Adjusting maxOutputTokens to ${adjustedMaxTokens} for Anthropic compatibility.`
                    );
                    if (!options.modelSettings) options.modelSettings = {};
                    options.modelSettings.maxOutputTokens = adjustedMaxTokens;
                }
            }

            if (anthCfg.effort) {
                anthropicOptions.effort = anthCfg.effort;
            }

            if (anthCfg.speed) {
                anthropicOptions.speed = anthCfg.speed;
            }

            if (anthCfg.sendReasoning !== undefined) {
                anthropicOptions.sendReasoning = anthCfg.sendReasoning;
            }

            if (anthCfg.contextManagement) {
                anthropicOptions.contextManagement = anthCfg.contextManagement;
            }

            const cacheControl = anthCfg.cacheControl ?? modelConfig.cacheControl;
            if (cacheControl) {
                anthropicOptions.cacheControl =
                    typeof cacheControl === "string" ? { type: cacheControl } : cacheControl;
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
     * List all agents accessible by a user, respecting org boundaries.
     *
     * Visibility rules:
     * - SYSTEM agents: only global (workspaceId=null) or same-org workspace
     * - User's own agents (ownerId match)
     * - ORGANIZATION-visible agents in the same org
     * - PUBLIC agents
     *
     * Agents with metadata.chatVisible === false are excluded (background/utility agents).
     */
    async listForUser(userId?: string, organizationId?: string): Promise<AgentRecordWithTools[]> {
        let agents: AgentRecordWithTools[];

        if (userId) {
            agents = await prisma.agent.findMany({
                where: {
                    isActive: true,
                    OR: [
                        // Global system agents (no workspace affiliation)
                        { type: "SYSTEM", workspaceId: null },
                        // Org-scoped system agents
                        ...(organizationId
                            ? [{ type: "SYSTEM" as const, workspace: { organizationId } }]
                            : []),
                        // User's own agents
                        { ownerId: userId },
                        // Org-shared agents (USER or SYSTEM with ORGANIZATION visibility)
                        ...(organizationId
                            ? [
                                  {
                                      visibility: "ORGANIZATION" as const,
                                      workspace: { organizationId }
                                  }
                              ]
                            : []),
                        // Public agents
                        { visibility: "PUBLIC" }
                    ]
                },
                include: { tools: true, workspace: { select: { organizationId: true } } },
                orderBy: [{ type: "asc" }, { name: "asc" }]
            });
        } else {
            // No user - only global SYSTEM agents and public agents
            agents = await prisma.agent.findMany({
                where: {
                    isActive: true,
                    OR: [{ type: "SYSTEM", workspaceId: null }, { visibility: "PUBLIC" }]
                },
                include: { tools: true, workspace: { select: { organizationId: true } } },
                orderBy: [{ type: "asc" }, { name: "asc" }]
            });
        }

        // Post-filter: Prisma's NOT with JSON path returns NULL for missing keys,
        // which SQL treats as false — incorrectly excluding agents without the key.
        const visible = agents.filter((a) => {
            if (a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata)) {
                return (a.metadata as Record<string, unknown>).chatVisible !== false;
            }
            return true;
        });

        // Deduplicate by slug: the compound unique @@unique([workspaceId, slug])
        // allows the same slug across different workspaces. When multiple agents
        // share a slug, prefer workspace-scoped over global (workspaceId=null).
        const slugMap = new Map<string, AgentRecordWithTools>();
        for (const a of visible) {
            const existing = slugMap.get(a.slug);
            if (!existing || (a.workspaceId && !existing.workspaceId)) {
                slugMap.set(a.slug, a);
            }
        }
        return [...slugMap.values()];
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
    async exists(
        slug: string,
        workspaceId?: string | null,
        organizationId?: string | null
    ): Promise<boolean> {
        const count = await prisma.agent.count({
            where: {
                slug,
                isActive: true,
                ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {}),
                ...(organizationId ? { workspace: { organizationId } } : {})
            }
        });
        return count > 0;
    }

    /**
     * Get an agent record by slug (without hydration, optionally workspace/org-scoped)
     */
    async getRecord(
        slug: string,
        workspaceId?: string | null,
        organizationId?: string | null
    ): Promise<AgentRecordWithTools | null> {
        return prisma.agent.findFirst({
            where: {
                slug,
                ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {}),
                ...(organizationId ? { workspace: { organizationId } } : {})
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
    reasoningModel?: { provider: string; name: string };
    confidenceThreshold?: number; // 0-1, default 0.7
    budgetAware?: boolean;
}

export type RoutingTier = "FAST" | "PRIMARY" | "ESCALATION" | "REASONING";

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
    needsReasoning: boolean;
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

    // Reasoning detection: problems requiring multi-step logical deduction
    const reasoningPatterns =
        /\b(prove|disprove|derive|deduce|step[- ]by[- ]step|mathematical|theorem|proof|logic|contradict|implication|infer|calculate.*show|verify.*correct|find.*error|what.*wrong|debug.*why|root\s*cause|differential|integral|equation|algorithm\s+complexity)\b/i;
    const needsReasoning = reasoningPatterns.test(input) && score >= 0.4;

    return { score, level, needsReasoning };
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

    const { score, level, needsReasoning } = classifyComplexity(input);
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

    // Reasoning tier override: if input needs deep reasoning and a reasoning model is configured
    if (needsReasoning && routingConfig.reasoningModel?.name) {
        tier = "REASONING";
        model = routingConfig.reasoningModel;
        reason = `Reasoning-class input detected (score=${score.toFixed(2)})`;
    }

    return { tier, model, reason };
}

/**
 * Resolve model override for any execution path (invoke, runs, Slack, test, chat).
 * Encapsulates the routing logic so it doesn't need to be duplicated in each route.
 *
 * @returns modelOverride to pass to agentResolver.resolve(), or undefined if primary model should be used
 */
export async function resolveModelOverride(
    agentIdOrSlug: string,
    input:
        | string
        | Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>,
    options?: { userId?: string; organizationId?: string }
): Promise<{
    modelOverride?: { provider: string; name: string };
    routingDecision: RoutingDecision | null;
    isReasoningModel?: boolean;
}> {
    const routingRecord = await prisma.agent.findFirst({
        where: {
            OR: [{ slug: agentIdOrSlug }, { id: agentIdOrSlug }],
            ...(options?.organizationId
                ? { workspace: { organizationId: options.organizationId } }
                : {})
        },
        select: {
            id: true,
            routingConfig: true,
            modelProvider: true,
            modelName: true,
            budgetPolicy: { select: { enabled: true, alertAtPct: true } }
        }
    });

    if (!routingRecord?.routingConfig) {
        return { routingDecision: null };
    }

    const rc = routingRecord.routingConfig as unknown as RoutingConfig;
    if (rc.mode !== "auto") {
        return { routingDecision: null };
    }

    // Extract text from input (string or message array)
    let inputForRouting = "";
    if (typeof input === "string") {
        inputForRouting = input;
    } else if (Array.isArray(input)) {
        const lastMsg = input.filter((m) => m.role === "user").pop();
        if (lastMsg?.parts && Array.isArray(lastMsg.parts)) {
            for (const part of lastMsg.parts) {
                if (part.type === "text" && part.text) inputForRouting = part.text;
            }
        } else if (lastMsg?.content) {
            inputForRouting = lastMsg.content;
        }
    }

    if (!inputForRouting) {
        return { routingDecision: null };
    }

    let budgetExceeded = false;
    if (rc.budgetAware) {
        try {
            const budgetResult = await budgetEnforcement.check({
                agentId: routingRecord.id,
                userId: options?.userId,
                organizationId: options?.organizationId
            });
            const alertPct = routingRecord.budgetPolicy?.enabled
                ? (routingRecord.budgetPolicy.alertAtPct ?? 80)
                : 80;
            budgetExceeded = budgetResult.warnings.some(
                (w) => w.level === "agent" && w.percentUsed >= alertPct
            );
        } catch (e) {
            console.warn("[resolveModelOverride] Budget check for routing failed:", e);
        }
    }

    const routingDecision = resolveRoutingDecision(
        rc,
        { provider: routingRecord.modelProvider, name: routingRecord.modelName },
        inputForRouting,
        budgetExceeded
    );

    let modelOverride: { provider: string; name: string } | undefined;
    if (routingDecision && routingDecision.tier !== "PRIMARY") {
        modelOverride = routingDecision.model;
    }

    const isReasoningModel = routingDecision?.tier === "REASONING";

    console.log(
        `[ModelRouting] ${routingDecision?.tier || "PRIMARY"} → ${modelOverride ? `${modelOverride.provider}/${modelOverride.name}` : "primary"} (${routingDecision?.reason || "default"})`
    );

    return { modelOverride, routingDecision, isReasoningModel };
}
