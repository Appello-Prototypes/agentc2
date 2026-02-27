"use client";

import { Input, Label, Textarea } from "@repo/ui";

interface DoWhileInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function DoWhileInspector({ config, onChange }: DoWhileInspectorProps) {
    const conditionExpression = (config.conditionExpression as string) || "";
    const maxIterations = (config.maxIterations as number) || 10;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Condition Expression</Label>
                <Textarea
                    rows={3}
                    value={conditionExpression}
                    onChange={(e) => onChange({ ...config, conditionExpression: e.target.value })}
                    placeholder="Evaluated after each iteration. Loop continues while true."
                />
                <p className="text-muted-foreground text-[10px]">
                    Use _dowhileIteration for current iteration index.
                </p>
            </div>

            <div className="space-y-2">
                <Label>Max Iterations</Label>
                <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxIterations}
                    onChange={(e) =>
                        onChange({ ...config, maxIterations: parseInt(e.target.value) || 10 })
                    }
                />
            </div>
        </div>
    );
}
