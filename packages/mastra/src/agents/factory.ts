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
import { getScorersByNames } from "../scorers/registry";
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
    memoryEnabled?: boolean;
    memory?: boolean; // Legacy field for backwards compatibility
    memoryConfig?: MemoryConfig | null;
    maxSteps?: number | null;
    scorers?: string[];
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
    const model = `${config.modelProvider}/${config.modelName}`;

    // Get tools from registry
    const tools = getToolsByNames(config.tools);

    // Get scorers from registry
    const scorers = config.scorers ? getScorersByNames(config.scorers) : {};

    // Determine if memory is enabled (support both new and legacy fields)
    const memoryEnabled = config.memoryEnabled ?? config.memory ?? false;

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

    // Add scorers if any were resolved
    if (Object.keys(scorers).length > 0) {
        agentConfig.scorers = scorers;
    }

    // Add extended thinking configuration if present (Anthropic Claude 4+ models)
    if (config.modelConfig?.thinking) {
        const thinkingConfig = config.modelConfig.thinking as {
            type: string;
            budget_tokens?: number;
        };
        if (thinkingConfig.type === "enabled") {
            agentConfig.defaultOptions = {
                ...agentConfig.defaultOptions,
                providerOptions: {
                    anthropic: {
                        thinking: {
                            type: "enabled",
                            budgetTokens: thinkingConfig.budget_tokens || 10000
                        }
                    }
                }
            };
        }
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

    // Build model string in Mastra format: "provider/model"
    const model = `${config.modelProvider}/${config.modelName}`;

    // Get tools from registry AND MCP (async)
    const tools = await getToolsByNamesAsync(config.tools);

    // Get scorers from registry
    const scorers = config.scorers ? getScorersByNames(config.scorers) : {};

    // Determine if memory is enabled (support both new and legacy fields)
    const memoryEnabled = config.memoryEnabled ?? config.memory ?? false;

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

    // Add scorers if any were resolved
    if (Object.keys(scorers).length > 0) {
        agentConfig.scorers = scorers;
    }

    // Add extended thinking configuration if present (Anthropic Claude 4+ models)
    if (config.modelConfig?.thinking) {
        const thinkingConfig = config.modelConfig.thinking as {
            type: string;
            budget_tokens?: number;
        };
        if (thinkingConfig.type === "enabled") {
            agentConfig.defaultOptions = {
                ...agentConfig.defaultOptions,
                providerOptions: {
                    anthropic: {
                        thinking: {
                            type: "enabled",
                            budgetTokens: thinkingConfig.budget_tokens || 10000
                        }
                    }
                }
            };
        }
    }

    return new Agent(agentConfig);
}

/**
 * Available model providers and their models
 */
export const availableModels = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: [
        // Claude 4.5 models
        "claude-opus-4-5-20250514",
        "claude-sonnet-4-5-20250514",
        // Claude 4 models
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        // Claude 3.5 models
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        // Claude 3 models
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
    ],
    google: ["gemini-2.0-flash", "gemini-1.5-pro"]
};

/**
 * Get flat list of all available models for UI
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
