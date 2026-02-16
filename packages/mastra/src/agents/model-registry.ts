/**
 * Model Registry
 *
 * Centralized, API-driven registry for all AI model information.
 * Dynamically fetches available models from OpenAI and Anthropic APIs,
 * enriches them with metadata (display names, categories, pricing, capabilities),
 * and caches results in-memory with a 1-hour TTL.
 *
 * This is the single source of truth for model information across the platform.
 */

import { getOrgApiKey } from "./model-provider";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelProvider =
    | "openai"
    | "anthropic"
    | "google"
    | "groq"
    | "mistral"
    | "xai"
    | "deepseek"
    | "togetherai"
    | "fireworks"
    | "openrouter"
    | "kimi";
export type ModelCategory = "flagship" | "fast" | "reasoning" | "legacy" | "open-source";

export interface ModelCapabilities {
    chat: boolean;
    vision: boolean;
    extendedThinking: boolean;
    parallelToolCalls: boolean;
    functionCalling: boolean;
    streaming: boolean;
}

export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}

export interface ModelDefinition {
    id: string;
    provider: ModelProvider;
    displayName: string;
    category: ModelCategory;
    capabilities: ModelCapabilities;
    contextWindow: number;
    pricing?: ModelPricing;
    deprecated: boolean;
    aliases: string[];
    sortOrder: number;
}

// ── Model Aliases ────────────────────────────────────────────────────────────
// Consolidated from factory.ts and resolver.ts — single source of truth

export const MODEL_ALIASES: Record<string, Record<string, string>> = {
    anthropic: {
        "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-5-20250514": "claude-sonnet-4-5-20250929",
        "claude-opus-4-5": "claude-opus-4-5-20251101",
        "claude-opus-4-5-20250514": "claude-opus-4-5-20251101"
    }
};

/**
 * Resolve a model name through the alias table.
 * Returns the canonical model name.
 */
export function resolveModelAlias(provider: string, modelName: string): string {
    return MODEL_ALIASES[provider]?.[modelName] ?? modelName;
}

// ── OpenAI Model Metadata ────────────────────────────────────────────────────
// OpenAI's API only returns { id, created, owned_by } — no display names,
// capabilities, or pricing. We enrich with this local metadata map.
// Unknown models (new releases) get auto-categorized with sensible defaults.

interface ModelMetadata {
    displayName: string;
    category: ModelCategory;
    capabilities: Partial<ModelCapabilities>;
    contextWindow: number;
    pricing?: ModelPricing;
    sortOrder: number;
    deprecated?: boolean;
}

const OPENAI_MODEL_METADATA: Record<string, ModelMetadata> = {
    // GPT-4.1 family
    "gpt-4.1": {
        displayName: "GPT-4.1",
        category: "flagship",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 1047576,
        pricing: { inputPer1M: 2.0, outputPer1M: 8.0 },
        sortOrder: 10
    },
    "gpt-4.1-mini": {
        displayName: "GPT-4.1 Mini",
        category: "fast",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 1047576,
        pricing: { inputPer1M: 0.4, outputPer1M: 1.6 },
        sortOrder: 11
    },
    "gpt-4.1-nano": {
        displayName: "GPT-4.1 Nano",
        category: "fast",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 1047576,
        pricing: { inputPer1M: 0.1, outputPer1M: 0.4 },
        sortOrder: 12
    },
    // GPT-4o family
    "gpt-4o": {
        displayName: "GPT-4o",
        category: "flagship",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 128000,
        pricing: { inputPer1M: 2.5, outputPer1M: 10.0 },
        sortOrder: 20
    },
    "gpt-4o-mini": {
        displayName: "GPT-4o Mini",
        category: "fast",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
        sortOrder: 21
    },
    // o-series reasoning models
    "o4-mini": {
        displayName: "o4-mini",
        category: "reasoning",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 1.1, outputPer1M: 4.4 },
        sortOrder: 30
    },
    o3: {
        displayName: "o3",
        category: "reasoning",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 2.0, outputPer1M: 8.0 },
        sortOrder: 31
    },
    "o3-mini": {
        displayName: "o3-mini",
        category: "reasoning",
        capabilities: { vision: false, parallelToolCalls: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 1.1, outputPer1M: 4.4 },
        sortOrder: 32
    },
    o1: {
        displayName: "o1",
        category: "reasoning",
        capabilities: { vision: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 15.0, outputPer1M: 60.0 },
        sortOrder: 33
    },
    "o1-mini": {
        displayName: "o1-mini",
        category: "reasoning",
        capabilities: {},
        contextWindow: 128000,
        pricing: { inputPer1M: 3.0, outputPer1M: 12.0 },
        sortOrder: 34
    },
    "o1-preview": {
        displayName: "o1-preview",
        category: "reasoning",
        capabilities: {},
        contextWindow: 128000,
        pricing: { inputPer1M: 15.0, outputPer1M: 60.0 },
        sortOrder: 35,
        deprecated: true
    },
    // GPT-4 Turbo
    "gpt-4-turbo": {
        displayName: "GPT-4 Turbo",
        category: "legacy",
        capabilities: { vision: true, parallelToolCalls: true },
        contextWindow: 128000,
        pricing: { inputPer1M: 10.0, outputPer1M: 30.0 },
        sortOrder: 40
    },
    // GPT-3.5 Turbo
    "gpt-3.5-turbo": {
        displayName: "GPT-3.5 Turbo",
        category: "legacy",
        capabilities: { parallelToolCalls: true },
        contextWindow: 16385,
        pricing: { inputPer1M: 0.5, outputPer1M: 1.5 },
        sortOrder: 50,
        deprecated: true
    }
};

// Prefixes used to identify chat-capable OpenAI models from the models.list() response
const OPENAI_CHAT_MODEL_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-"];

// Snapshot date suffixes we want to de-duplicate (e.g., gpt-4o-2024-08-06 => skip if gpt-4o exists)
function isSnapshotVariant(modelId: string): boolean {
    return /-(20\d{2})-(\d{2})-(\d{2})$/.test(modelId);
}

// ── Anthropic Model Metadata ─────────────────────────────────────────────────
// Anthropic's API returns display_name, so we primarily use that.
// This metadata provides pricing, capabilities, and category.

const ANTHROPIC_MODEL_METADATA: Record<string, Partial<ModelMetadata>> = {
    // Claude 4.x family
    "claude-opus-4-20250514": {
        category: "flagship",
        capabilities: { vision: true, extendedThinking: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 15.0, outputPer1M: 75.0 },
        sortOrder: 10
    },
    "claude-sonnet-4-20250514": {
        category: "flagship",
        capabilities: { vision: true, extendedThinking: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 3.0, outputPer1M: 15.0 },
        sortOrder: 11
    },
    // Claude 4.5 family
    "claude-opus-4-5-20251101": {
        category: "flagship",
        capabilities: { vision: true, extendedThinking: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 15.0, outputPer1M: 75.0 },
        sortOrder: 5
    },
    "claude-sonnet-4-5-20250929": {
        category: "flagship",
        capabilities: { vision: true, extendedThinking: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 3.0, outputPer1M: 15.0 },
        sortOrder: 6
    },
    // Claude 3.5 family
    "claude-3-5-sonnet-20241022": {
        category: "flagship",
        capabilities: { vision: true, extendedThinking: false },
        contextWindow: 200000,
        pricing: { inputPer1M: 3.0, outputPer1M: 15.0 },
        sortOrder: 20
    },
    "claude-3-5-haiku-20241022": {
        category: "fast",
        capabilities: { vision: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 1.0, outputPer1M: 5.0 },
        sortOrder: 21
    },
    // Claude 3 family
    "claude-3-opus-20240229": {
        category: "legacy",
        capabilities: { vision: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 15.0, outputPer1M: 75.0 },
        sortOrder: 30
    },
    "claude-3-sonnet-20240229": {
        category: "legacy",
        capabilities: { vision: true },
        contextWindow: 200000,
        pricing: { inputPer1M: 3.0, outputPer1M: 15.0 },
        sortOrder: 31
    },
    "claude-3-haiku-20240307": {
        category: "fast",
        capabilities: {},
        contextWindow: 200000,
        pricing: { inputPer1M: 0.25, outputPer1M: 1.25 },
        sortOrder: 32
    }
};

// ── Google Fallback Models ───────────────────────────────────────────────────
// Google doesn't have a public models.list() API we can use easily,
// so these remain as a static fallback list.

const GOOGLE_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "gemini-2.5-pro",
        provider: "google",
        displayName: "Gemini 2.5 Pro",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 1048576,
        pricing: { inputPer1M: 1.25, outputPer1M: 10.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 5
    },
    {
        id: "gemini-2.5-flash",
        provider: "google",
        displayName: "Gemini 2.5 Flash",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 1048576,
        pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
        deprecated: false,
        aliases: [],
        sortOrder: 6
    },
    {
        id: "gemini-2.0-flash",
        provider: "google",
        displayName: "Gemini 2.0 Flash",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 1048576,
        pricing: { inputPer1M: 0.1, outputPer1M: 0.4 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "gemini-1.5-pro",
        provider: "google",
        displayName: "Gemini 1.5 Pro",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 2097152,
        pricing: { inputPer1M: 3.5, outputPer1M: 10.5 },
        deprecated: false,
        aliases: [],
        sortOrder: 20
    },
    {
        id: "gemini-1.5-flash",
        provider: "google",
        displayName: "Gemini 1.5 Flash",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 1048576,
        pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
        deprecated: false,
        aliases: [],
        sortOrder: 21
    }
];

// ── Groq Model Metadata ─────────────────────────────────────────────────────
// Groq provides extremely fast inference for open-source models.
// Free tier available — ideal for cost-sensitive workloads.

const GROQ_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "llama-3.3-70b-versatile",
        provider: "groq",
        displayName: "Llama 3.3 70B Versatile",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.59, outputPer1M: 0.79 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "llama-3.1-8b-instant",
        provider: "groq",
        displayName: "Llama 3.1 8B Instant",
        category: "fast",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.05, outputPer1M: 0.08 },
        deprecated: false,
        aliases: [],
        sortOrder: 11
    },
    {
        id: "llama-4-scout-17b-16e-instruct",
        provider: "groq",
        displayName: "Llama 4 Scout 17B",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.11, outputPer1M: 0.34 },
        deprecated: false,
        aliases: [],
        sortOrder: 12
    },
    {
        id: "llama-4-maverick-17b-128e-instruct",
        provider: "groq",
        displayName: "Llama 4 Maverick 17B",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.50, outputPer1M: 0.77 },
        deprecated: false,
        aliases: [],
        sortOrder: 13
    },
    {
        id: "gemma2-9b-it",
        provider: "groq",
        displayName: "Gemma 2 9B",
        category: "fast",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 8192,
        pricing: { inputPer1M: 0.20, outputPer1M: 0.20 },
        deprecated: false,
        aliases: [],
        sortOrder: 20
    },
    {
        id: "mixtral-8x7b-32768",
        provider: "groq",
        displayName: "Mixtral 8x7B",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 32768,
        pricing: { inputPer1M: 0.24, outputPer1M: 0.24 },
        deprecated: false,
        aliases: [],
        sortOrder: 21
    },
    {
        id: "qwen-qwq-32b",
        provider: "groq",
        displayName: "Qwen QwQ 32B",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.29, outputPer1M: 0.39 },
        deprecated: false,
        aliases: [],
        sortOrder: 15
    },
    {
        id: "deepseek-r1-distill-llama-70b",
        provider: "groq",
        displayName: "DeepSeek R1 Distill 70B (Groq)",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.75, outputPer1M: 0.99 },
        deprecated: false,
        aliases: [],
        sortOrder: 16
    }
];

// ── DeepSeek Model Metadata ─────────────────────────────────────────────────
// DeepSeek provides extremely affordable models with strong coding abilities.

const DEEPSEEK_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "deepseek-chat",
        provider: "deepseek",
        displayName: "DeepSeek V3",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0.27, outputPer1M: 1.10 },
        deprecated: false,
        aliases: ["deepseek-v3"],
        sortOrder: 10
    },
    {
        id: "deepseek-reasoner",
        provider: "deepseek",
        displayName: "DeepSeek R1",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
        deprecated: false,
        aliases: ["deepseek-r1"],
        sortOrder: 11
    }
];

// ── Mistral Model Metadata ──────────────────────────────────────────────────
// Mistral provides high-quality European-built models with competitive pricing.

const MISTRAL_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "mistral-large-latest",
        provider: "mistral",
        displayName: "Mistral Large",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 2.0, outputPer1M: 6.0 },
        deprecated: false,
        aliases: ["mistral-large"],
        sortOrder: 10
    },
    {
        id: "mistral-small-latest",
        provider: "mistral",
        displayName: "Mistral Small",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.1, outputPer1M: 0.3 },
        deprecated: false,
        aliases: ["mistral-small"],
        sortOrder: 11
    },
    {
        id: "codestral-latest",
        provider: "mistral",
        displayName: "Codestral",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 256000,
        pricing: { inputPer1M: 0.3, outputPer1M: 0.9 },
        deprecated: false,
        aliases: ["codestral"],
        sortOrder: 12
    },
    {
        id: "mistral-medium-latest",
        provider: "mistral",
        displayName: "Mistral Medium",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.4, outputPer1M: 2.0 },
        deprecated: false,
        aliases: ["mistral-medium"],
        sortOrder: 13
    },
    {
        id: "open-mistral-nemo",
        provider: "mistral",
        displayName: "Mistral Nemo (Open)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0.15, outputPer1M: 0.15 },
        deprecated: false,
        aliases: ["mistral-nemo"],
        sortOrder: 20
    },
    {
        id: "pixtral-large-latest",
        provider: "mistral",
        displayName: "Pixtral Large",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 2.0, outputPer1M: 6.0 },
        deprecated: false,
        aliases: ["pixtral-large"],
        sortOrder: 14
    }
];

// ── xAI (Grok) Model Metadata ───────────────────────────────────────────────

const XAI_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "grok-3",
        provider: "xai",
        displayName: "Grok 3",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 3.0, outputPer1M: 15.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "grok-3-fast",
        provider: "xai",
        displayName: "Grok 3 Fast",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 5.0, outputPer1M: 25.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 11
    },
    {
        id: "grok-3-mini",
        provider: "xai",
        displayName: "Grok 3 Mini",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.30, outputPer1M: 0.50 },
        deprecated: false,
        aliases: [],
        sortOrder: 12
    },
    {
        id: "grok-3-mini-fast",
        provider: "xai",
        displayName: "Grok 3 Mini Fast",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.60, outputPer1M: 4.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 13
    },
    {
        id: "grok-2",
        provider: "xai",
        displayName: "Grok 2",
        category: "legacy",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 2.0, outputPer1M: 10.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 20
    }
];

// ── Together AI Model Metadata ──────────────────────────────────────────────
// Together hosts 200+ open-source models. These are the most popular/useful.

const TOGETHERAI_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo",
        provider: "togetherai",
        displayName: "Llama 4 Maverick 17B (Together)",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.27, outputPer1M: 0.85 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        provider: "togetherai",
        displayName: "Llama 4 Scout 17B (Together)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.15, outputPer1M: 0.40 },
        deprecated: false,
        aliases: [],
        sortOrder: 11
    },
    {
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        provider: "togetherai",
        displayName: "Llama 3.3 70B Turbo (Together)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.88, outputPer1M: 0.88 },
        deprecated: false,
        aliases: [],
        sortOrder: 12
    },
    {
        id: "deepseek-ai/DeepSeek-R1",
        provider: "togetherai",
        displayName: "DeepSeek R1 (Together)",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 3.0, outputPer1M: 7.0 },
        deprecated: false,
        aliases: [],
        sortOrder: 15
    },
    {
        id: "deepseek-ai/DeepSeek-V3",
        provider: "togetherai",
        displayName: "DeepSeek V3 (Together)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0.49, outputPer1M: 0.99 },
        deprecated: false,
        aliases: [],
        sortOrder: 16
    },
    {
        id: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        provider: "togetherai",
        displayName: "Qwen 2.5 72B Turbo (Together)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 32768,
        pricing: { inputPer1M: 0.60, outputPer1M: 0.60 },
        deprecated: false,
        aliases: [],
        sortOrder: 17
    },
    {
        id: "mistralai/Mixtral-8x22B-Instruct-v0.1",
        provider: "togetherai",
        displayName: "Mixtral 8x22B (Together)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 65536,
        pricing: { inputPer1M: 0.60, outputPer1M: 0.60 },
        deprecated: false,
        aliases: [],
        sortOrder: 18
    }
];

// ── Fireworks AI Model Metadata ─────────────────────────────────────────────
// Fireworks provides fast inference for open-source models at low cost.

const FIREWORKS_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "accounts/fireworks/models/llama4-maverick-instruct-basic",
        provider: "fireworks",
        displayName: "Llama 4 Maverick (Fireworks)",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.22, outputPer1M: 0.88 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "accounts/fireworks/models/llama4-scout-instruct-basic",
        provider: "fireworks",
        displayName: "Llama 4 Scout (Fireworks)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
        deprecated: false,
        aliases: [],
        sortOrder: 11
    },
    {
        id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        provider: "fireworks",
        displayName: "Llama 3.3 70B (Fireworks)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.90, outputPer1M: 0.90 },
        deprecated: false,
        aliases: [],
        sortOrder: 12
    },
    {
        id: "accounts/fireworks/models/deepseek-v3",
        provider: "fireworks",
        displayName: "DeepSeek V3 (Fireworks)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0.90, outputPer1M: 0.90 },
        deprecated: false,
        aliases: [],
        sortOrder: 15
    },
    {
        id: "accounts/fireworks/models/qwen2p5-72b-instruct",
        provider: "fireworks",
        displayName: "Qwen 2.5 72B (Fireworks)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 32768,
        pricing: { inputPer1M: 0.90, outputPer1M: 0.90 },
        deprecated: false,
        aliases: [],
        sortOrder: 16
    }
];

// ── OpenRouter Model Metadata ───────────────────────────────────────────────
// OpenRouter routes to 300+ models. These are curated free/cheap options.
// Users can use any model by specifying the full OpenRouter model ID.

const OPENROUTER_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "meta-llama/llama-4-maverick:free",
        provider: "openrouter",
        displayName: "Llama 4 Maverick (Free)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 1
    },
    {
        id: "meta-llama/llama-4-scout:free",
        provider: "openrouter",
        displayName: "Llama 4 Scout (Free)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 2
    },
    {
        id: "deepseek/deepseek-chat-v3-0324:free",
        provider: "openrouter",
        displayName: "DeepSeek V3 (Free)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 3
    },
    {
        id: "deepseek/deepseek-r1:free",
        provider: "openrouter",
        displayName: "DeepSeek R1 (Free)",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 64000,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 4
    },
    {
        id: "qwen/qwen3-235b-a22b:free",
        provider: "openrouter",
        displayName: "Qwen 3 235B (Free)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 40960,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 5
    },
    {
        id: "google/gemini-2.5-flash-preview:free",
        provider: "openrouter",
        displayName: "Gemini 2.5 Flash (Free via OR)",
        category: "fast",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 1048576,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 6
    },
    {
        id: "mistralai/mistral-small-3.1-24b-instruct:free",
        provider: "openrouter",
        displayName: "Mistral Small 3.1 (Free)",
        category: "open-source",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 128000,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 7
    },
    {
        id: "microsoft/phi-4-reasoning-plus:free",
        provider: "openrouter",
        displayName: "Phi-4 Reasoning Plus (Free)",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: true,
            parallelToolCalls: false,
            functionCalling: false,
            streaming: true
        },
        contextWindow: 32768,
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        deprecated: false,
        aliases: [],
        sortOrder: 8
    }
];

// ── Kimi (Moonshot AI) Model Metadata ────────────────────────────────────────
// Kimi K2/K2.5 — large MoE models with strong agentic and coding capabilities.

const KIMI_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "kimi-k2.5",
        provider: "kimi",
        displayName: "Kimi K2.5",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 262144,
        pricing: { inputPer1M: 0.60, outputPer1M: 2.40 },
        deprecated: false,
        aliases: [],
        sortOrder: 10
    },
    {
        id: "kimi-k2.5-thinking",
        provider: "kimi",
        displayName: "Kimi K2.5 Thinking",
        category: "reasoning",
        capabilities: {
            chat: true,
            vision: true,
            extendedThinking: true,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 262144,
        pricing: { inputPer1M: 0.60, outputPer1M: 2.40 },
        deprecated: false,
        aliases: [],
        sortOrder: 11
    },
    {
        id: "kimi-k2",
        provider: "kimi",
        displayName: "Kimi K2",
        category: "flagship",
        capabilities: {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        },
        contextWindow: 131072,
        pricing: { inputPer1M: 0.60, outputPer1M: 2.40 },
        deprecated: false,
        aliases: [],
        sortOrder: 12
    }
];

// ── Cache ────────────────────────────────────────────────────────────────────

interface CachedModels {
    models: ModelDefinition[];
    fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const modelCache = new Map<string, CachedModels>();

function getCachedModels(cacheKey: string): ModelDefinition[] | null {
    const cached = modelCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.models;
    }
    return null;
}

function setCachedModels(cacheKey: string, models: ModelDefinition[]): void {
    modelCache.set(cacheKey, { models, fetchedAt: Date.now() });
}

/**
 * Clear all cached model lists. Call with `?refresh=true` from the API.
 */
export function clearModelCache(): void {
    modelCache.clear();
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetch available chat models from the OpenAI API.
 * Filters to chat-capable models and enriches with local metadata.
 */
async function fetchOpenAIModels(apiKey: string): Promise<ModelDefinition[]> {
    const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!response.ok) {
        throw new Error(`OpenAI models API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as {
        data: Array<{ id: string; created: number; owned_by: string }>;
    };

    // Filter to chat-capable models
    const chatModels = data.data.filter((m) =>
        OPENAI_CHAT_MODEL_PREFIXES.some((prefix) => m.id.startsWith(prefix))
    );

    // Collect known base model IDs so we can filter snapshot variants
    const knownBaseIds = new Set(Object.keys(OPENAI_MODEL_METADATA));

    const models: ModelDefinition[] = [];
    const seenIds = new Set<string>();

    for (const apiModel of chatModels) {
        const id = apiModel.id;

        // Skip snapshot variants when the base model is known (e.g. gpt-4o-2024-08-06)
        if (isSnapshotVariant(id)) {
            const baseId = id.replace(/-(20\d{2})-(\d{2})-(\d{2})$/, "");
            if (knownBaseIds.has(baseId) || seenIds.has(baseId)) {
                continue;
            }
        }

        // Skip fine-tuned models
        if (id.startsWith("ft:") || id.includes(":ft-")) {
            continue;
        }

        // Skip non-chat models that somehow matched prefixes
        if (
            id.includes("embedding") ||
            id.includes("whisper") ||
            id.includes("tts") ||
            id.includes("dall-e") ||
            id.includes("davinci") ||
            id.includes("babbage")
        ) {
            continue;
        }

        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const metadata = OPENAI_MODEL_METADATA[id];
        const defaultCaps: ModelCapabilities = {
            chat: true,
            vision: false,
            extendedThinking: false,
            parallelToolCalls: true,
            functionCalling: true,
            streaming: true
        };

        models.push({
            id,
            provider: "openai",
            displayName: metadata?.displayName ?? formatModelId(id),
            category: metadata?.category ?? "flagship",
            capabilities: metadata?.capabilities
                ? { ...defaultCaps, ...metadata.capabilities }
                : defaultCaps,
            contextWindow: metadata?.contextWindow ?? 128000,
            pricing: metadata?.pricing,
            deprecated: metadata?.deprecated ?? false,
            aliases: [],
            sortOrder: metadata?.sortOrder ?? 100
        });
    }

    // Sort by sortOrder
    models.sort((a, b) => a.sortOrder - b.sortOrder);

    return models;
}

/**
 * Fetch available models from the Anthropic API.
 * Anthropic returns display_name, so we use that directly.
 */
async function fetchAnthropicModels(apiKey: string): Promise<ModelDefinition[]> {
    const models: ModelDefinition[] = [];
    let afterId: string | undefined;

    // Paginate through all models
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const url = new URL("https://api.anthropic.com/v1/models");
        url.searchParams.set("limit", "100");
        if (afterId) {
            url.searchParams.set("after_id", afterId);
        }

        const response = await fetch(url.toString(), {
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            }
        });

        if (!response.ok) {
            throw new Error(
                `Anthropic models API returned ${response.status}: ${response.statusText}`
            );
        }

        const data = (await response.json()) as {
            data: Array<{ id: string; display_name: string; created_at: string; type: string }>;
            has_more: boolean;
            last_id: string;
        };

        for (const apiModel of data.data) {
            const id = apiModel.id;
            const metadata = ANTHROPIC_MODEL_METADATA[id];
            const defaultCaps: ModelCapabilities = {
                chat: true,
                vision: true,
                extendedThinking: false,
                parallelToolCalls: false,
                functionCalling: true,
                streaming: true
            };

            // Build aliases for this model
            const aliases: string[] = [];
            for (const [aliasName, targetId] of Object.entries(MODEL_ALIASES.anthropic || {})) {
                if (targetId === id) {
                    aliases.push(aliasName);
                }
            }

            models.push({
                id,
                provider: "anthropic",
                displayName: apiModel.display_name || metadata?.displayName || formatModelId(id),
                category: metadata?.category ?? inferAnthropicCategory(id),
                capabilities: metadata?.capabilities
                    ? { ...defaultCaps, ...metadata.capabilities }
                    : defaultCaps,
                contextWindow: metadata?.contextWindow ?? 200000,
                pricing: metadata?.pricing,
                deprecated: false,
                aliases,
                sortOrder: metadata?.sortOrder ?? 100
            });
        }

        if (!data.has_more) break;
        afterId = data.last_id;
    }

    // Sort by sortOrder
    models.sort((a, b) => a.sortOrder - b.sortOrder);

    return models;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-format a model ID into a human-readable display name.
 * e.g., "gpt-4o-mini" -> "GPT-4o Mini", "o3-mini" -> "o3-mini"
 */
function formatModelId(id: string): string {
    if (id.startsWith("gpt-")) {
        return id
            .replace("gpt-", "GPT-")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .replace("GPT ", "GPT-");
    }
    if (id.startsWith("claude-")) {
        return id
            .replace("claude-", "Claude ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .replace(/\s\d{8}$/, ""); // Remove date suffix
    }
    return id;
}

/**
 * Infer category for an Anthropic model based on its ID.
 */
function inferAnthropicCategory(id: string): ModelCategory {
    if (id.includes("haiku")) return "fast";
    if (id.includes("opus")) return "flagship";
    if (id.includes("sonnet")) return "flagship";
    return "flagship";
}

// ── Hardcoded Fallback ───────────────────────────────────────────────────────
// Used when API calls fail — ensures the platform never breaks.

const OPENAI_FALLBACK_MODELS: ModelDefinition[] = [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
    "o3-mini",
    "o1",
    "o1-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo"
].map((id) => {
    const metadata = OPENAI_MODEL_METADATA[id]!;
    const defaultCaps: ModelCapabilities = {
        chat: true,
        vision: false,
        extendedThinking: false,
        parallelToolCalls: true,
        functionCalling: true,
        streaming: true
    };
    return {
        id,
        provider: "openai" as ModelProvider,
        displayName: metadata?.displayName ?? id,
        category: metadata?.category ?? ("flagship" as ModelCategory),
        capabilities: metadata?.capabilities
            ? { ...defaultCaps, ...metadata.capabilities }
            : defaultCaps,
        contextWindow: metadata?.contextWindow ?? 128000,
        pricing: metadata?.pricing,
        deprecated: metadata?.deprecated ?? false,
        aliases: [],
        sortOrder: metadata?.sortOrder ?? 100
    };
});

const ANTHROPIC_FALLBACK_MODELS: ModelDefinition[] = [
    {
        id: "claude-opus-4-5-20251101",
        displayName: "Claude Opus 4.5"
    },
    {
        id: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet 4.5"
    },
    {
        id: "claude-opus-4-20250514",
        displayName: "Claude Opus 4"
    },
    {
        id: "claude-sonnet-4-20250514",
        displayName: "Claude Sonnet 4"
    },
    {
        id: "claude-3-5-sonnet-20241022",
        displayName: "Claude 3.5 Sonnet"
    },
    {
        id: "claude-3-5-haiku-20241022",
        displayName: "Claude 3.5 Haiku"
    },
    {
        id: "claude-3-opus-20240229",
        displayName: "Claude 3 Opus"
    },
    {
        id: "claude-3-sonnet-20240229",
        displayName: "Claude 3 Sonnet"
    },
    {
        id: "claude-3-haiku-20240307",
        displayName: "Claude 3 Haiku"
    }
].map((m) => {
    const metadata = ANTHROPIC_MODEL_METADATA[m.id];
    const defaultCaps: ModelCapabilities = {
        chat: true,
        vision: true,
        extendedThinking: false,
        parallelToolCalls: false,
        functionCalling: true,
        streaming: true
    };

    // Build aliases
    const aliases: string[] = [];
    for (const [aliasName, targetId] of Object.entries(MODEL_ALIASES.anthropic || {})) {
        if (targetId === m.id) {
            aliases.push(aliasName);
        }
    }

    return {
        id: m.id,
        provider: "anthropic" as ModelProvider,
        displayName: m.displayName,
        category: metadata?.category ?? inferAnthropicCategory(m.id),
        capabilities: metadata?.capabilities
            ? { ...defaultCaps, ...metadata.capabilities }
            : defaultCaps,
        contextWindow: metadata?.contextWindow ?? 200000,
        pricing: metadata?.pricing,
        deprecated: false,
        aliases,
        sortOrder: metadata?.sortOrder ?? 100
    };
});

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all available models from a specific provider.
 * Fetches dynamically from the provider API with caching and fallback.
 *
 * @param provider - The model provider ("openai", "anthropic", "google")
 * @param organizationId - Optional org ID for org-scoped API keys
 * @param forceRefresh - When true, bypass the cache
 */
export async function getModelsByProvider(
    provider: ModelProvider,
    organizationId?: string | null,
    forceRefresh?: boolean
): Promise<ModelDefinition[]> {
    const cacheKey = `${provider}:${organizationId || "env"}`;

    if (!forceRefresh) {
        const cached = getCachedModels(cacheKey);
        if (cached) return cached;
    }

    try {
        const apiKey = await getOrgApiKey(provider, organizationId);
        if (!apiKey) {
            console.warn(`[ModelRegistry] No API key for ${provider}, using fallback`);
            return getFallbackModels(provider);
        }

        let models: ModelDefinition[];
        switch (provider) {
            case "openai":
                models = await fetchOpenAIModels(apiKey);
                break;
            case "anthropic":
                models = await fetchAnthropicModels(apiKey);
                break;
            case "google":
            case "groq":
            case "mistral":
            case "xai":
            case "deepseek":
            case "togetherai":
            case "fireworks":
            case "openrouter":
            case "kimi":
                // These providers use static fallback lists (API-based discovery not yet implemented)
                models = getFallbackModels(provider);
                break;
            default:
                models = [];
        }

        setCachedModels(cacheKey, models);
        return models;
    } catch (error) {
        console.warn(
            `[ModelRegistry] Failed to fetch ${provider} models, using fallback:`,
            error instanceof Error ? error.message : error
        );
        return getFallbackModels(provider);
    }
}

/**
 * Get all available models from all configured providers.
 *
 * @param organizationId - Optional org ID for org-scoped API keys
 * @param forceRefresh - When true, bypass the cache
 */
export async function getAllModels(
    organizationId?: string | null,
    forceRefresh?: boolean
): Promise<ModelDefinition[]> {
    const providers: ModelProvider[] = [
        "openai",
        "anthropic",
        "google",
        "groq",
        "mistral",
        "xai",
        "deepseek",
        "togetherai",
        "fireworks",
        "openrouter",
        "kimi"
    ];
    const results = await Promise.allSettled(
        providers.map((p) => getModelsByProvider(p, organizationId, forceRefresh))
    );

    const models: ModelDefinition[] = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            models.push(...result.value);
        }
    }

    return models;
}

/**
 * Get the flat model list for UI display (backward-compatible format).
 * This is the async replacement for the old getAvailableModels().
 */
export async function getAvailableModelsAsync(
    organizationId?: string | null,
    forceRefresh?: boolean
): Promise<{ provider: string; name: string; displayName: string }[]> {
    const models = await getAllModels(organizationId, forceRefresh);
    return models.map((m) => ({
        provider: m.provider,
        name: m.id,
        displayName: m.displayName
    }));
}

/**
 * Get the full ModelDefinition list for the API response.
 */
export async function getModelsForApi(
    organizationId?: string | null,
    provider?: ModelProvider | null,
    forceRefresh?: boolean
): Promise<ModelDefinition[]> {
    if (provider) {
        return getModelsByProvider(provider, organizationId, forceRefresh);
    }
    return getAllModels(organizationId, forceRefresh);
}

/**
 * Look up pricing for a model by ID.
 * Falls back to local metadata if the model isn't in the registry cache.
 */
export function getModelPricingFromRegistry(
    modelId: string,
    provider?: string
): ModelPricing | undefined {
    // Check OpenAI metadata
    if (!provider || provider === "openai") {
        const openai = OPENAI_MODEL_METADATA[modelId];
        if (openai?.pricing) return openai.pricing;
    }

    // Check Anthropic metadata
    if (!provider || provider === "anthropic") {
        const anthropic = ANTHROPIC_MODEL_METADATA[modelId];
        if (anthropic?.pricing) return anthropic.pricing;
    }

    // Try cached models
    for (const [, cached] of modelCache) {
        const found = cached.models.find((m) => m.id === modelId);
        if (found?.pricing) return found.pricing;
    }

    return undefined;
}

/**
 * Get hardcoded fallback models for a provider.
 */
function getFallbackModels(provider: ModelProvider): ModelDefinition[] {
    switch (provider) {
        case "openai":
            return OPENAI_FALLBACK_MODELS;
        case "anthropic":
            return ANTHROPIC_FALLBACK_MODELS;
        case "google":
            return GOOGLE_FALLBACK_MODELS;
        case "groq":
            return GROQ_FALLBACK_MODELS;
        case "deepseek":
            return DEEPSEEK_FALLBACK_MODELS;
        case "mistral":
            return MISTRAL_FALLBACK_MODELS;
        case "xai":
            return XAI_FALLBACK_MODELS;
        case "togetherai":
            return TOGETHERAI_FALLBACK_MODELS;
        case "fireworks":
            return FIREWORKS_FALLBACK_MODELS;
        case "openrouter":
            return OPENROUTER_FALLBACK_MODELS;
        case "kimi":
            return KIMI_FALLBACK_MODELS;
        default:
            return [];
    }
}

// ── Sync Backward Compatibility ──────────────────────────────────────────────
// These are used by code that can't await (e.g. the old getAvailableModels).

/**
 * Static fallback model list (sync). Used by the legacy getAvailableModels()
 * and as the initial value before dynamic models are fetched.
 */
export const FALLBACK_AVAILABLE_MODELS = {
    openai: OPENAI_FALLBACK_MODELS.map((m) => m.id),
    anthropic: ANTHROPIC_FALLBACK_MODELS.map((m) => m.id),
    google: GOOGLE_FALLBACK_MODELS.map((m) => m.id),
    groq: GROQ_FALLBACK_MODELS.map((m) => m.id),
    deepseek: DEEPSEEK_FALLBACK_MODELS.map((m) => m.id),
    mistral: MISTRAL_FALLBACK_MODELS.map((m) => m.id),
    xai: XAI_FALLBACK_MODELS.map((m) => m.id),
    togetherai: TOGETHERAI_FALLBACK_MODELS.map((m) => m.id),
    fireworks: FIREWORKS_FALLBACK_MODELS.map((m) => m.id),
    openrouter: OPENROUTER_FALLBACK_MODELS.map((m) => m.id),
    kimi: KIMI_FALLBACK_MODELS.map((m) => m.id)
};
