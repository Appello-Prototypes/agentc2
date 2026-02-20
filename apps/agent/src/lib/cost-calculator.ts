/**
 * Cost Calculator
 *
 * Calculates token costs for various LLM providers and models.
 * Prices are in USD per 1 million tokens (input/output).
 *
 * Pricing sources (as of 2025):
 * - OpenAI: https://openai.com/pricing
 * - Anthropic: https://www.anthropic.com/pricing
 * - Google: https://cloud.google.com/vertex-ai/pricing
 *
 * NOTE: This file is used client-side (runs page) and cannot import from
 * @repo/agentc2/agents (server-only). Pricing data is maintained locally.
 * For the canonical model registry, see packages/agentc2/src/agents/model-registry.ts
 */

/**
 * Model pricing configuration
 * Prices are per 1 million tokens
 */
interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}

/**
 * Pricing table for known models
 * Format: "provider/model" or just "model"
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
    // OpenAI GPT-4.1 family
    "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
    "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
    "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },

    // OpenAI GPT-4o models
    "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
    "gpt-4o-2024-05-13": { inputPer1M: 2.5, outputPer1M: 10.0 },
    "gpt-4o-2024-08-06": { inputPer1M: 2.5, outputPer1M: 10.0 },

    // OpenAI o-series reasoning models
    "o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
    o3: { inputPer1M: 2.0, outputPer1M: 8.0 },
    "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
    o1: { inputPer1M: 15.0, outputPer1M: 60.0 },
    "o1-mini": { inputPer1M: 3.0, outputPer1M: 12.0 },
    "o1-preview": { inputPer1M: 15.0, outputPer1M: 60.0 },

    // OpenAI GPT-4 Turbo
    "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
    "gpt-4-turbo-preview": { inputPer1M: 10.0, outputPer1M: 30.0 },
    "gpt-4-1106-preview": { inputPer1M: 10.0, outputPer1M: 30.0 },

    // OpenAI GPT-4
    "gpt-4": { inputPer1M: 30.0, outputPer1M: 60.0 },
    "gpt-4-32k": { inputPer1M: 60.0, outputPer1M: 120.0 },

    // OpenAI GPT-3.5 Turbo
    "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
    "gpt-3.5-turbo-0125": { inputPer1M: 0.5, outputPer1M: 1.5 },
    "gpt-3.5-turbo-16k": { inputPer1M: 3.0, outputPer1M: 4.0 },

    // Anthropic Claude 4.5 models
    "claude-opus-4-5-20251101": { inputPer1M: 15.0, outputPer1M: 75.0 },
    "claude-sonnet-4-5-20250929": { inputPer1M: 3.0, outputPer1M: 15.0 },

    // Anthropic Claude 4 models
    "claude-opus-4-20250514": { inputPer1M: 15.0, outputPer1M: 75.0 },
    "claude-sonnet-4-20250514": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },

    // Anthropic Claude 3.5 models
    "claude-3-5-sonnet-20241022": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "claude-3-5-sonnet-20240620": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "claude-3-5-haiku-20241022": { inputPer1M: 1.0, outputPer1M: 5.0 },

    // Anthropic Claude 3 models
    "claude-3-opus-20240229": { inputPer1M: 15.0, outputPer1M: 75.0 },
    "claude-3-sonnet-20240229": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },

    // Anthropic Claude 2.x (legacy)
    "claude-2.1": { inputPer1M: 8.0, outputPer1M: 24.0 },
    "claude-2.0": { inputPer1M: 8.0, outputPer1M: 24.0 },
    "claude-instant-1.2": { inputPer1M: 0.8, outputPer1M: 2.4 },

    // Google Gemini models
    "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
    "gemini-1.5-pro": { inputPer1M: 3.5, outputPer1M: 10.5 },
    "gemini-1.5-flash": { inputPer1M: 0.35, outputPer1M: 1.05 },
    "gemini-1.0-pro": { inputPer1M: 0.5, outputPer1M: 1.5 },
    "gemini-pro": { inputPer1M: 0.5, outputPer1M: 1.5 },

    // Fallback aliases with provider prefix
    "openai/gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
    "openai/gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
    "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
    "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
    "anthropic/claude-sonnet-4-20250514": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "anthropic/claude-3-5-sonnet-20241022": { inputPer1M: 3.0, outputPer1M: 15.0 },
    "anthropic/claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },
    "google/gemini-1.5-pro": { inputPer1M: 3.5, outputPer1M: 10.5 },
    "google/gemini-1.5-flash": { inputPer1M: 0.35, outputPer1M: 1.05 }
};

/**
 * Default pricing for unknown models (conservative estimate)
 */
const DEFAULT_PRICING: ModelPricing = {
    inputPer1M: 2.5, // Similar to GPT-4o
    outputPer1M: 10.0
};

/**
 * Get pricing for a model
 *
 * Tries various name formats to find a match:
 * 1. Exact match
 * 2. provider/model format
 * 3. Model name without date suffix
 * 4. Default pricing
 */
export function getModelPricing(modelName: string, modelProvider?: string): ModelPricing {
    // Try exact match
    if (MODEL_PRICING[modelName]) {
        return MODEL_PRICING[modelName];
    }

    // Try with provider prefix
    if (modelProvider) {
        const withProvider = `${modelProvider.toLowerCase()}/${modelName}`;
        if (MODEL_PRICING[withProvider]) {
            return MODEL_PRICING[withProvider];
        }
    }

    // Try model name normalized (lowercase)
    const normalized = modelName.toLowerCase();
    if (MODEL_PRICING[normalized]) {
        return MODEL_PRICING[normalized];
    }

    // Try without date suffix (e.g., claude-3-5-sonnet -> claude-3-5-sonnet-20241022)
    // Find any model that starts with this name
    const matchingKey = Object.keys(MODEL_PRICING).find(
        (key) => key.startsWith(normalized) || normalized.startsWith(key.replace(/-\d{8}$/, ""))
    );
    if (matchingKey) {
        return MODEL_PRICING[matchingKey];
    }

    // Use default pricing
    console.log(`[CostCalculator] Unknown model "${modelName}", using default pricing`);
    return DEFAULT_PRICING;
}

/**
 * Calculate the cost of a model invocation
 *
 * @param modelName - The model name (e.g., "gpt-4o", "claude-3-5-sonnet-20241022")
 * @param modelProvider - The provider (e.g., "openai", "anthropic")
 * @param promptTokens - Number of input/prompt tokens
 * @param completionTokens - Number of output/completion tokens
 * @returns Cost in USD (rounded to 6 decimal places)
 */
export function calculateCost(
    modelName: string,
    modelProvider?: string,
    promptTokens?: number,
    completionTokens?: number
): number {
    if (!promptTokens && !completionTokens) {
        return 0;
    }

    const pricing = getModelPricing(modelName, modelProvider);

    const inputCost = ((promptTokens || 0) / 1_000_000) * pricing.inputPer1M;
    const outputCost = ((completionTokens || 0) / 1_000_000) * pricing.outputPer1M;

    // Round to 6 decimal places for precision
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/**
 * Calculate cost breakdown
 *
 * Returns separate costs for input and output tokens
 */
export function calculateCostBreakdown(
    modelName: string,
    modelProvider?: string,
    promptTokens?: number,
    completionTokens?: number
): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = getModelPricing(modelName, modelProvider);

    const inputCost = ((promptTokens || 0) / 1_000_000) * pricing.inputPer1M;
    const outputCost = ((completionTokens || 0) / 1_000_000) * pricing.outputPer1M;

    return {
        inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
        outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
        totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
    };
}
