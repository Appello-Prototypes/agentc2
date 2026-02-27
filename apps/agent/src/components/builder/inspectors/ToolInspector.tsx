"use client";

import { Input, Label, Textarea } from "@repo/ui";

interface ToolInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function ToolInspector({ config, onChange }: ToolInspectorProps) {
    const toolId = (config.toolId as string) || "";
    const params = (config.params as Record<string, unknown>) || {};

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Tool ID</Label>
                <Input
                    value={toolId}
                    onChange={(e) => onChange({ ...config, toolId: e.target.value })}
                    placeholder="e.g., hubspot.hubspot-get-contacts"
                />
            </div>

            <div className="space-y-2">
                <Label>Parameters (JSON)</Label>
                <Textarea
                    rows={8}
                    value={JSON.stringify(params, null, 2)}
                    onChange={(e) => {
                        try {
                            onChange({ ...config, params: JSON.parse(e.target.value) });
                        } catch {
                            /* keep draft */
                        }
                    }}
                    placeholder="{}"
                />
            </div>
        </div>
    );
}
