"use client";

import { useState, useEffect } from "react";
import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface ModelOption {
    provider: string;
    name: string;
    displayName: string;
    category?: string;
}

export interface ModelOverride {
    provider: string;
    name: string;
}

interface ModelSelectorProps {
    value: string | null; // null = use agent default
    agentDefault?: string; // e.g. "gpt-4o"
    onChange: (model: ModelOverride | null) => void;
    disabled?: boolean;
}

/**
 * Look up a display name for any model string. Falls back to the raw name.
 */
function getModelDisplayName(modelName: string, models: ModelOption[]): string {
    return models.find((m) => m.name === modelName)?.displayName || modelName;
}

/**
 * Check if a model name belongs to an Anthropic model.
 */
export function isAnthropicModel(modelName: string | null): boolean {
    if (!modelName) return false;
    return modelName.includes("claude") || modelName.startsWith("anthropic/");
}

export function ModelSelector({ value, agentDefault, onChange, disabled }: ModelSelectorProps) {
    const [models, setModels] = useState<ModelOption[]>([]);
    const [loaded, setLoaded] = useState(false);
    const isOverriding = value !== null;
    const displayValue = value || agentDefault || "";

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/models`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.models)) {
                        setModels(
                            data.models.map(
                                (m: {
                                    id: string;
                                    provider: string;
                                    displayName: string;
                                    category?: string;
                                }) => ({
                                    provider: m.provider,
                                    name: m.id,
                                    displayName: m.displayName,
                                    category: m.category
                                })
                            )
                        );
                    }
                }
            } catch {
                // Silently fall back to empty — the selector will still work with raw model names
            } finally {
                setLoaded(true);
            }
        };
        fetchModels();
    }, []);

    const handleChange = (modelKey: string | null) => {
        if (!modelKey) return;
        if (modelKey === "__default__") {
            onChange(null);
            return;
        }
        const model = models.find((m) => m.name === modelKey);
        if (model) {
            onChange({ provider: model.provider, name: model.name });
        }
    };

    // Group models by provider, maintaining sort order from the API
    const providers = [
        "openai",
        "anthropic",
        "google",
        "groq",
        "deepseek",
        "mistral",
        "xai",
        "togetherai",
        "fireworks",
        "openrouter",
        "kimi"
    ];
    const providerLabels: Record<string, string> = {
        openai: "OpenAI",
        anthropic: "Anthropic",
        google: "Google",
        groq: "Groq",
        deepseek: "DeepSeek",
        mistral: "Mistral",
        xai: "xAI (Grok)",
        togetherai: "Together AI",
        fireworks: "Fireworks AI",
        openrouter: "OpenRouter (Free)",
        kimi: "Kimi (Moonshot)"
    };

    return (
        <div className="flex items-center gap-1">
            <Select
                value={displayValue}
                onValueChange={handleChange}
                disabled={disabled || !loaded}
            >
                <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Model">
                        <div className="flex items-center gap-1">
                            <span className="text-sm">
                                {getModelDisplayName(displayValue, models)}
                            </span>
                        </div>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {agentDefault && (
                        <SelectItem value="__default__">
                            <span className="text-muted-foreground">
                                Agent default ({getModelDisplayName(agentDefault, models)})
                            </span>
                        </SelectItem>
                    )}
                    {providers.map((provider) => {
                        const providerModels = models.filter((m) => m.provider === provider);
                        if (providerModels.length === 0) return null;
                        return (
                            <div key={provider}>
                                <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                                    {providerLabels[provider] || provider}
                                </div>
                                {providerModels.map((m) => (
                                    <SelectItem key={m.name} value={m.name}>
                                        {m.displayName}
                                    </SelectItem>
                                ))}
                            </div>
                        );
                    })}
                </SelectContent>
            </Select>
            {isOverriding && (
                <Badge variant="outline" className="text-xs">
                    custom
                </Badge>
            )}
        </div>
    );
}
