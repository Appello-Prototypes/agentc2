"use client";

import {
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import type { Edge } from "@xyflow/react";

interface EdgeInspectorProps {
    edge: Edge;
    onUpdate: (updates: Partial<Edge>) => void;
    onDelete: () => void;
}

export function EdgeInspector({ edge, onUpdate, onDelete }: EdgeInspectorProps) {
    const label = (edge.data?.label as string) || "";
    const edgeType = edge.type || "temporary";

    return (
        <div className="space-y-4">
            <div className="space-y-1 text-xs">
                <div className="text-muted-foreground">Source</div>
                <div className="font-medium">{edge.source}</div>
            </div>
            <div className="space-y-1 text-xs">
                <div className="text-muted-foreground">Target</div>
                <div className="font-medium">{edge.target}</div>
            </div>

            <div className="space-y-2">
                <Label>Condition Label</Label>
                <Input
                    value={label}
                    onChange={(e) => onUpdate({ data: { ...edge.data, label: e.target.value } })}
                    placeholder="Optional label for this connection"
                />
            </div>

            <div className="space-y-2">
                <Label>Edge Type</Label>
                <Select
                    value={edgeType}
                    onValueChange={(v) => {
                        if (v) onUpdate({ type: v });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="temporary">Normal</SelectItem>
                        <SelectItem value="animated">Conditional</SelectItem>
                        <SelectItem value="error">Error Path</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete Edge
            </Button>
        </div>
    );
}
