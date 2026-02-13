"use client";

import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";

interface ModelOption {
    provider: string;
    name: string;
    displayName: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
    { provider: "openai", name: "gpt-4o", displayName: "GPT-4o" },
    { provider: "openai", name: "gpt-4o-mini", displayName: "GPT-4o Mini" },
    { provider: "openai", name: "o3-mini", displayName: "o3-mini" },
    { provider: "anthropic", name: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
    { provider: "anthropic", name: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4" },
    { provider: "anthropic", name: "claude-sonnet-4-5-20250514", displayName: "Claude Sonnet 4.5" },
    { provider: "anthropic", name: "claude-haiku-3-5-20241022", displayName: "Claude Haiku 3.5" }
];

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
function getModelDisplayName(modelName: string): string {
    return AVAILABLE_MODELS.find((m) => m.name === modelName)?.displayName || modelName;
}

export function ModelSelector({ value, agentDefault, onChange, disabled }: ModelSelectorProps) {
    const isOverriding = value !== null;
    const displayValue = value || agentDefault || "";

    const handleChange = (modelKey: string | null) => {
        if (!modelKey) return;
        if (modelKey === "__default__") {
            onChange(null);
            return;
        }
        const model = AVAILABLE_MODELS.find((m) => m.name === modelKey);
        if (model) {
            onChange({ provider: model.provider, name: model.name });
        }
    };

    return (
        <div className="flex items-center gap-1">
            <Select value={displayValue} onValueChange={handleChange} disabled={disabled}>
                <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Model">
                        <div className="flex items-center gap-1">
                            <span className="text-sm">{getModelDisplayName(displayValue)}</span>
                        </div>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {agentDefault && (
                        <SelectItem value="__default__">
                            <span className="text-muted-foreground">
                                Agent default ({getModelDisplayName(agentDefault)})
                            </span>
                        </SelectItem>
                    )}
                    <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                        OpenAI
                    </div>
                    {AVAILABLE_MODELS.filter((m) => m.provider === "openai").map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                            {m.displayName}
                        </SelectItem>
                    ))}
                    <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                        Anthropic
                    </div>
                    {AVAILABLE_MODELS.filter((m) => m.provider === "anthropic").map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                            {m.displayName}
                        </SelectItem>
                    ))}
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

/**
 * Check if a given model name is an Anthropic model
 */
export function isAnthropicModel(modelName: string | null): boolean {
    if (!modelName) return false;
    return AVAILABLE_MODELS.some((m) => m.name === modelName && m.provider === "anthropic");
}
