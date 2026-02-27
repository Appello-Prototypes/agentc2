"use client";

import { Input, Label, Textarea } from "@repo/ui";

interface HumanInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function HumanInspector({ config, onChange }: HumanInspectorProps) {
    const prompt = (config.prompt as string) || "";
    const timeoutMs = (config.timeoutMs as number) || 0;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Prompt</Label>
                <Textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => onChange({ ...config, prompt: e.target.value })}
                    placeholder="What should the human review or approve?"
                />
            </div>

            <div className="space-y-2">
                <Label>Timeout (ms, 0 = no timeout)</Label>
                <Input
                    type="number"
                    min={0}
                    value={timeoutMs}
                    onChange={(e) =>
                        onChange({ ...config, timeoutMs: parseInt(e.target.value) || 0 })
                    }
                />
            </div>
        </div>
    );
}
