"use client";

import {
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea
} from "@repo/ui";

interface RouterInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function RouterInspector({ config, onChange }: RouterInspectorProps) {
    const instructions = (config.instructions as string) || "";
    const modelProvider = (config.modelProvider as string) || "openai";
    const modelName = (config.modelName as string) || "gpt-4o";
    const temperature = (config.temperature as number) ?? 0.7;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Routing Instructions</Label>
                <Textarea
                    rows={5}
                    value={instructions}
                    onChange={(e) => onChange({ ...config, instructions: e.target.value })}
                    placeholder="Instructions for how the router should decide which primitive to invoke..."
                />
            </div>

            <div className="space-y-2">
                <Label>Model Provider</Label>
                <Select
                    value={modelProvider}
                    onValueChange={(v) => onChange({ ...config, modelProvider: v })}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Model</Label>
                <Input
                    value={modelName}
                    onChange={(e) => onChange({ ...config, modelName: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label>Temperature ({temperature})</Label>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(e) =>
                        onChange({ ...config, temperature: parseFloat(e.target.value) })
                    }
                    className="w-full"
                />
            </div>
        </div>
    );
}
