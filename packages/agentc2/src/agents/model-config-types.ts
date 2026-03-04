/**
 * Provider-Aware Model Configuration Types
 *
 * Unified type system for model configuration stored in the database.
 * Supports provider-keyed configuration (anthropic.*, openai.*) with
 * backward compatibility for the legacy flat format.
 */

// ── Anthropic Provider Options ──────────────────────────────────────────────

export interface AnthropicThinkingEnabled {
    type: "enabled";
    budgetTokens?: number;
    budget_tokens?: number;
}

export interface AnthropicThinkingAdaptive {
    type: "adaptive";
}

export interface AnthropicThinkingDisabled {
    type: "disabled";
}

export type AnthropicThinkingConfig =
    | AnthropicThinkingEnabled
    | AnthropicThinkingAdaptive
    | AnthropicThinkingDisabled;

export interface AnthropicContextManagementEdit {
    /** AI SDK v2.0.61 uses "clear_01" and "compact_20260112" */
    type: "clear_01" | "compact_20260112" | string;
    trigger?: { type: "input_tokens"; value: number };
    keep?: { type: "thinking_turns"; value: number } | "all";
    instructions?: string;
}

export interface AnthropicProviderConfig {
    thinking?: AnthropicThinkingConfig;
    effort?: "max" | "high" | "medium" | "low";
    speed?: "fast" | "standard";
    cacheControl?: { type: "ephemeral"; ttl?: string } | string;
    sendReasoning?: boolean;
    contextManagement?: {
        edits: AnthropicContextManagementEdit[];
    };
}

// ── OpenAI Provider Options ─────────────────────────────────────────────────

export interface OpenAIProviderConfig {
    parallelToolCalls?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
    structuredOutputMode?: "auto" | "strict" | "compatible";
}

// ── Unified ModelConfig (stored in DB as JSON) ──────────────────────────────

export interface ModelConfig {
    // Shared (provider-agnostic) options
    toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
    reasoning?: { type: "enabled" | "disabled" };

    // Provider-specific options (new provider-keyed format)
    anthropic?: AnthropicProviderConfig;
    openai?: OpenAIProviderConfig;

    // ── DEPRECATED flat fields (backward compatibility with existing DB records) ──
    // These are read when provider-keyed config is absent. New code should write
    // to the provider-keyed format above instead.
    /** @deprecated Use anthropic.thinking instead */
    thinking?: {
        type: "enabled" | "disabled";
        budget_tokens?: number;
        budgetTokens?: number;
    };
    /** @deprecated Use openai.parallelToolCalls instead */
    parallelToolCalls?: boolean;
    /** @deprecated Use openai.reasoningEffort instead */
    reasoningEffort?: "low" | "medium" | "high";
    /** @deprecated Use anthropic.cacheControl instead */
    cacheControl?: string | { type: "ephemeral" };
}

// ── Models that support adaptive thinking ───────────────────────────────────

const ADAPTIVE_THINKING_MODELS = new Set([
    "claude-sonnet-4-6",
    "claude-opus-4-6",
    "claude-sonnet-4-5",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5-20250514",
    "claude-opus-4-5",
    "claude-opus-4-5-20251101",
    "claude-opus-4-5-20250514"
]);

export function supportsAdaptiveThinking(modelName: string): boolean {
    return ADAPTIVE_THINKING_MODELS.has(modelName);
}
