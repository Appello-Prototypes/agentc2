"use client";

import { Input, Label } from "@repo/ui";

interface ForeachInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function ForeachInspector({ config, onChange }: ForeachInspectorProps) {
    const collectionPath = (config.collectionPath as string) || "";
    const itemVar = (config.itemVar as string) || "item";
    const concurrency = (config.concurrency as number) || 1;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Collection Path</Label>
                <Input
                    value={collectionPath}
                    onChange={(e) => onChange({ ...config, collectionPath: e.target.value })}
                    placeholder="e.g., {{input.items}} or {{steps.step1.output.list}}"
                />
            </div>

            <div className="space-y-2">
                <Label>Item Variable</Label>
                <Input
                    value={itemVar}
                    onChange={(e) => onChange({ ...config, itemVar: e.target.value })}
                    placeholder="item"
                />
            </div>

            <div className="space-y-2">
                <Label>Concurrency</Label>
                <Input
                    type="number"
                    min={1}
                    max={10}
                    value={concurrency}
                    onChange={(e) =>
                        onChange({ ...config, concurrency: parseInt(e.target.value) || 1 })
                    }
                />
            </div>
        </div>
    );
}
