"use client";

import { Badge, Label, Textarea } from "@repo/ui";

interface PrimitiveInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function PrimitiveInspector({ config, onChange }: PrimitiveInspectorProps) {
    const primitiveType = (config.primitiveType as string) || "agent";
    const description = (config.description as string) || "";
    const reference =
        (config.reference as string) ||
        (config.agentSlug as string) ||
        (config.workflowSlug as string) ||
        (config.toolId as string) ||
        "";

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Badge variant="secondary">{primitiveType}</Badge>
                {reference && <span className="text-xs font-medium">{reference}</span>}
            </div>

            <div className="space-y-2">
                <Label>Description Override</Label>
                <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => onChange({ ...config, description: e.target.value })}
                    placeholder="Description used by the routing agent to decide when to invoke this primitive."
                />
            </div>
        </div>
    );
}
