/**
 * Agent Factory
 *
 * Creates Mastra Agent instances from stored agent configurations.
 * Used to instantiate database-backed agents at runtime.
 * Supports RequestContext for dynamic instructions and granular memory configuration.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { storage } from "../storage";
import { getToolsByNames, getToolsByNamesAsync } from "../tools/registry";

import { resolveModelForOrg } from "./model-provider";
import {
    resolveModelAlias,
    FALLBACK_AVAILABLE_MODELS,
    getAvailableModelsAsync as registryGetAvailableModelsAsync
} from "./model-registry";
import type { RequestContext } from "./resolver";

/**
 * Memory configuration from database
 */
export interface MemoryConfig {
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
export interface ModelConfig {
    reasoning?: { type: "enabled" | "disabled" };
    toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
    // Anthropic extended thinking configuration
    thinking?: {
        type: "enabled" | "disabled";
        budget_tokens?: number;
    };
    // OpenAI / Anthropic provider options
    parallelToolCalls?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    cacheControl?: { type: "ephemeral" };
}

/**
 * Stored agent configuration from database (enhanced)
 */
export interface StoredAgentConfig {
    id: string;
    slug?: string;
    name: string;
    description?: string | null;
    instructions: string;
    instructionsTemplate?: string | null;
    modelProvider: string;
    modelName: string;
    temperature?: number | null;
    maxTokens?: number | null;
    modelConfig?: ModelConfig | null;
    tools: string[];
    subAgents?: Record<string, Agent>;
    workflows?: Record<string, unknown>;
    memoryEnabled?: boolean;
    memory?: boolean; // Legacy field for backwards compatibility
    memoryConfig?: MemoryConfig | null;
    maxSteps?: number | null;
    metadata?: Record<string, unknown> | null;
    isActive: boolean;
}

/**
 * Interpolate instructions template with RequestContext values
 *
 * Replaces {{key}} placeholders with values from context.
 * If a key is not found, the placeholder is kept as-is.
 */
function interpolateInstructions(template: string, context: RequestContext): string {
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
function buildMemory(config?: MemoryConfig | null): Memory {
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
 * Build provider-specific default options from modelConfig
 */
function buildDefaultOptions(config: StoredAgentConfig): object | undefined {
    const modelConfig = config.modelConfig;
    if (!modelConfig) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};

    if (modelConfig.toolChoice !== undefined) {
        options.toolChoice = modelConfig.toolChoice;
    }

    if (modelConfig.reasoning !== undefined) {
        options.reasoning = modelConfig.reasoning;
    }

    if (config.modelProvider === "openai") {
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

    if (config.modelProvider === "anthropic") {
        const anthropicOptions: Record<string, unknown> = {};
        if (modelConfig.thinking?.type === "enabled") {
            const thinkingConfig = modelConfig.thinking as Record<string, unknown>;
            const budgetTokens =
                (thinkingConfig.budgetTokens as number) ||
                (thinkingConfig.budget_tokens as number) ||
                10000;
            anthropicOptions.thinking = {
                type: "enabled",
                budgetTokens
            };
        }
        if (modelConfig.cacheControl) {
            anthropicOptions.cacheControl =
                typeof modelConfig.cacheControl === "string"
                    ? { type: modelConfig.cacheControl }
                    : modelConfig.cacheControl;
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

function resolveModelName(provider: string, modelName: string) {
    const resolved = resolveModelAlias(provider, modelName);
    if (resolved !== modelName) {
        console.warn(
            `[Agent Factory] Remapping model ${provider}/${modelName} -> ${provider}/${resolved}`
        );
    }
    return resolved;
}

/**
 * Create an Agent instance from a stored agent configuration
 * (Sync version - only supports static registry tools)
 *
 * @param config - Stored agent configuration from database
 * @param requestContext - Optional runtime context for dynamic instructions
 * @returns Configured Agent instance
 */
export function createAgentFromConfig(
    config: StoredAgentConfig,
    requestContext?: RequestContext
): Agent {
    // Interpolate instructions if template exists
    const instructions = config.instructionsTemplate
        ? interpolateInstructions(config.instructionsTemplate, requestContext || {})
        : config.instructions;

    // Build model string in Mastra format: "provider/model"
    const modelName = resolveModelName(config.modelProvider, config.modelName);
    const model = `${config.modelProvider}/${modelName}`;

    // Get tools from registry
    const tools = getToolsByNames(config.tools);

    // Determine if memory is enabled (support both new and legacy fields)
    const memoryEnabled = config.memoryEnabled ?? config.memory ?? false;

    const defaultOptions = buildDefaultOptions(config);

    // Build agent configuration - using any to bypass strict typing issues with Mastra's Agent constructor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentConfig: any = {
        id: config.id,
        name: config.name,
        instructions,
        model
    };

    // Add tools if any were resolved
    if (Object.keys(tools).length > 0) {
        agentConfig.tools = tools;
    }

    // Add memory if enabled
    if (memoryEnabled) {
        agentConfig.memory = buildMemory(config.memoryConfig);
    }

    if (defaultOptions) {
        agentConfig.defaultOptions = defaultOptions;
    }

    if (config.subAgents && Object.keys(config.subAgents).length > 0) {
        agentConfig.agents = config.subAgents;
    }

    if (config.workflows && Object.keys(config.workflows).length > 0) {
        agentConfig.workflows = config.workflows;
    }

    return new Agent(agentConfig);
}

/**
 * Create an Agent instance from a stored agent configuration (Async version)
 * Supports both static registry tools AND MCP tools
 *
 * Use this version when agents may have MCP tools configured.
 *
 * @param config - Stored agent configuration from database
 * @param requestContext - Optional runtime context for dynamic instructions
 * @returns Configured Agent instance
 */
export async function createAgentFromConfigAsync(
    config: StoredAgentConfig,
    requestContext?: RequestContext
): Promise<Agent> {
    // Interpolate instructions if template exists
    const instructions = config.instructionsTemplate
        ? interpolateInstructions(config.instructionsTemplate, requestContext || {})
        : config.instructions;

    // Resolve model — prefer org-scoped API key, fall back to string-based model router
    const modelName = resolveModelName(config.modelProvider, config.modelName);
    const organizationId = requestContext?.resource?.tenantId || requestContext?.tenantId;
    const resolvedModel = await resolveModelForOrg(config.modelProvider, modelName, organizationId);
    const model = resolvedModel ?? `${config.modelProvider}/${modelName}`;

    // Get tools from registry AND MCP (async)
    const tools = await getToolsByNamesAsync(config.tools, organizationId);

    // Determine if memory is enabled (support both new and legacy fields)
    const memoryEnabled = config.memoryEnabled ?? config.memory ?? false;

    const defaultOptions = buildDefaultOptions(config);

    // Build agent configuration - using any to bypass strict typing issues with Mastra's Agent constructor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentConfig: any = {
        id: config.id,
        name: config.name,
        instructions,
        model
    };

    // Add tools if any were resolved
    if (Object.keys(tools).length > 0) {
        agentConfig.tools = tools;
    }

    // Add memory if enabled
    if (memoryEnabled) {
        agentConfig.memory = buildMemory(config.memoryConfig);
    }

    if (defaultOptions) {
        agentConfig.defaultOptions = defaultOptions;
    }

    if (config.subAgents && Object.keys(config.subAgents).length > 0) {
        agentConfig.agents = config.subAgents;
    }

    if (config.workflows && Object.keys(config.workflows).length > 0) {
        agentConfig.workflows = config.workflows;
    }

    return new Agent(agentConfig);
}

/**
 * Available model providers and their models (sync fallback).
 * Prefer getAvailableModelsAsync() for dynamic, API-driven model lists.
 */
export const availableModels = FALLBACK_AVAILABLE_MODELS;

/**
 * Get flat list of all available models for UI (sync fallback).
 * Prefer getAvailableModelsAsync() for dynamic, API-driven model lists.
 */
export function getAvailableModels(): { provider: string; name: string; displayName: string }[] {
    const models: { provider: string; name: string; displayName: string }[] = [];

    for (const [provider, modelList] of Object.entries(availableModels)) {
        for (const name of modelList) {
            models.push({
                provider,
                name,
                displayName: `${provider}/${name}`
            });
        }
    }

    return models;
}

/**
 * Get flat list of all available models, dynamically fetched from provider APIs.
 * Falls back to hardcoded list if APIs are unreachable.
 */
export { registryGetAvailableModelsAsync as getAvailableModelsAsync };
