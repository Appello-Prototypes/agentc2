/**
 * Provider Parameter Schema
 *
 * Declarative registry of provider-specific configuration knobs.
 * The configure UI renders controls dynamically from this schema
 * instead of hardcoding provider-specific sections.
 *
 * Each provider declares groups of parameters with types, defaults,
 * constraints, and optional model-level filtering (e.g., thinking
 * is only available on Claude 4+ models).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProviderParamOption {
    value: string;
    label: string;
}

export interface ProviderParam {
    /** Dot-path key within the provider config object (e.g. "thinking.type") */
    key: string;
    /** Human-readable label for the control */
    label: string;
    /** Short description / tooltip */
    description: string;
    /** Control type */
    type: "boolean" | "select" | "slider";
    /** Default value when not set */
    default?: unknown;
    /** Options for "select" type */
    options?: ProviderParamOption[];
    /** Range for "slider" type */
    range?: { min: number; max: number; step: number };
    /** Format hint for slider display (e.g. "tokens", "percent") */
    unit?: string;
    /**
     * Only show this param when another param matches a condition.
     * Format: "key=value" (e.g. "thinking.type=enabled")
     */
    dependsOn?: string;
    /**
     * Only show for models matching these regex patterns.
     * If omitted, shown for all models of this provider.
     */
    models?: string[];
}

export interface ProviderParamGroup {
    /** Group heading (e.g. "Reasoning", "Performance") */
    label: string;
    /** Parameters in this group */
    params: ProviderParam[];
}

// ── Provider Parameter Registry ──────────────────────────────────────────────

export const PROVIDER_PARAMS: Record<string, ProviderParamGroup[]> = {
    anthropic: [
        {
            label: "Reasoning",
            params: [
                {
                    key: "thinking.type",
                    label: "Thinking Mode",
                    description:
                        "Controls how the model reasons. Adaptive lets the model decide when to think deeply. Enabled uses a fixed token budget for every request.",
                    type: "select",
                    options: [
                        { value: "disabled", label: "Disabled" },
                        { value: "adaptive", label: "Adaptive" },
                        { value: "enabled", label: "Enabled (fixed budget)" }
                    ],
                    default: "disabled",
                    models: [".*opus-4.*", ".*sonnet-4.*"]
                },
                {
                    key: "thinking.budgetTokens",
                    label: "Thinking Budget",
                    description:
                        "Maximum tokens the model can use for internal reasoning. Higher budgets enable more thorough analysis but increase latency and cost.",
                    type: "slider",
                    range: { min: 1024, max: 128000, step: 1024 },
                    unit: "tokens",
                    default: 10000,
                    dependsOn: "thinking.type=enabled",
                    models: [".*opus-4.*", ".*sonnet-4.*"]
                },
                {
                    key: "effort",
                    label: "Effort Level",
                    description:
                        "Controls how much effort the model puts into its response. Higher effort produces better results but costs more.",
                    type: "select",
                    options: [
                        { value: "", label: "Default" },
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                        { value: "max", label: "Max" }
                    ],
                    default: ""
                },
                {
                    key: "sendReasoning",
                    label: "Send Reasoning",
                    description:
                        "Include the model's internal reasoning in the response stream. Useful for debugging and transparency.",
                    type: "boolean",
                    default: false
                }
            ]
        },
        {
            label: "Performance",
            params: [
                {
                    key: "speed",
                    label: "Speed Mode",
                    description:
                        'Set to "fast" for lower-latency responses at potentially reduced quality.',
                    type: "select",
                    options: [
                        { value: "", label: "Default (Standard)" },
                        { value: "fast", label: "Fast" },
                        { value: "standard", label: "Standard" }
                    ],
                    default: ""
                },
                {
                    key: "cacheControl.type",
                    label: "Prompt Caching",
                    description:
                        "Cache system prompts and repeated context for faster, cheaper subsequent requests.",
                    type: "select",
                    options: [
                        { value: "", label: "Disabled" },
                        { value: "ephemeral", label: "Ephemeral" }
                    ],
                    default: ""
                }
            ]
        }
    ],
    openai: [
        {
            label: "Tool Calling",
            params: [
                {
                    key: "parallelToolCalls",
                    label: "Parallel Tool Calls",
                    description:
                        "Allow the model to call multiple tools simultaneously in a single step.",
                    type: "boolean",
                    default: false
                },
                {
                    key: "structuredOutputMode",
                    label: "Structured Output Mode",
                    description:
                        "Controls how structured output schemas are enforced. Strict guarantees schema compliance but may reduce flexibility.",
                    type: "select",
                    options: [
                        { value: "", label: "Default (Auto)" },
                        { value: "auto", label: "Auto" },
                        { value: "strict", label: "Strict" },
                        { value: "compatible", label: "Compatible" }
                    ],
                    default: ""
                }
            ]
        },
        {
            label: "Reasoning",
            params: [
                {
                    key: "reasoningEffort",
                    label: "Reasoning Effort",
                    description:
                        "Controls how much reasoning the model performs. Higher effort improves accuracy for complex tasks.",
                    type: "select",
                    options: [
                        { value: "", label: "Default" },
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" }
                    ],
                    default: ""
                }
            ]
        }
    ]
};

// ── Shared (provider-agnostic) parameters ────────────────────────────────────
// These are rendered as top-level controls, not inside provider sections.

export const SHARED_PARAMS: ProviderParam[] = [
    {
        key: "toolChoice",
        label: "Tool Choice",
        description: "Controls whether the model must use tools in generation.",
        type: "select",
        options: [
            { value: "auto", label: "Auto" },
            { value: "required", label: "Required" },
            { value: "none", label: "None" }
        ],
        default: "auto"
    },
    {
        key: "reasoning.type",
        label: "Reasoning Mode",
        description:
            "Enable or disable the shared reasoning capability across all providers that support it.",
        type: "select",
        options: [
            { value: "", label: "Default" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" }
        ],
        default: ""
    }
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get parameter groups for a specific provider and model,
 * filtering out params that don't apply to the given model.
 */
export function getParamsForProvider(provider: string, modelName?: string): ProviderParamGroup[] {
    const groups = PROVIDER_PARAMS[provider];
    if (!groups) return [];

    if (!modelName) return groups;

    return groups
        .map((group) => ({
            ...group,
            params: group.params.filter((param) => {
                if (!param.models || param.models.length === 0) return true;
                return param.models.some((pattern) => new RegExp(pattern).test(modelName));
            })
        }))
        .filter((group) => group.params.length > 0);
}

/**
 * Get the value at a dot-path key from a nested object.
 * e.g. getNestedValue({ thinking: { type: "enabled" } }, "thinking.type") → "enabled"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Set a value at a dot-path key in a nested object, creating intermediate objects as needed.
 * Returns a new object (does not mutate the input).
 */
export function setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
): Record<string, unknown> {
    const result = { ...obj };
    const parts = path.split(".");
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] == null || typeof current[part] !== "object") {
            current[part] = {};
        } else {
            current[part] = { ...(current[part] as Record<string, unknown>) };
        }
        current = current[part] as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1];
    if (value === "" || value === undefined) {
        delete current[lastKey];
    } else {
        current[lastKey] = value;
    }

    return result;
}

/**
 * Check if a dependsOn condition is met.
 * Format: "key=value" (e.g. "thinking.type=enabled")
 */
export function isDependencyMet(
    providerConfig: Record<string, unknown>,
    dependsOn: string
): boolean {
    const [depKey, depValue] = dependsOn.split("=");
    const actual = getNestedValue(providerConfig, depKey);
    return String(actual) === depValue;
}

/**
 * Strip empty objects and undefined values from a provider config,
 * cleaning up after deletions.
 */
export function cleanProviderConfig(
    config: Record<string, unknown>
): Record<string, unknown> | null {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (value === undefined || value === null || value === "") continue;
        if (typeof value === "object" && !Array.isArray(value)) {
            const sub = cleanProviderConfig(value as Record<string, unknown>);
            if (sub && Object.keys(sub).length > 0) {
                cleaned[key] = sub;
            }
        } else {
            cleaned[key] = value;
        }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/**
 * List all providers that have parameter schemas defined.
 */
export function getProvidersWithParams(): string[] {
    return Object.keys(PROVIDER_PARAMS);
}
