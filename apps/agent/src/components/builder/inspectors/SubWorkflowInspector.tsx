"use client";

import { useEffect, useState } from "react";
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface SubWorkflowInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

interface WorkflowOption {
    slug: string;
    name: string;
    description?: string;
}

export function SubWorkflowInspector({ config, onChange }: SubWorkflowInspectorProps) {
    const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
    const workflowId = (config.workflowId as string) || "";
    const inputMappingText = JSON.stringify(config.inputMapping || {}, null, 2);

    useEffect(() => {
        fetch(`${getApiBase()}/api/workflows`)
            .then((r) => r.json())
            .then((d) => setWorkflows(d.workflows || []))
            .catch(() => {});
    }, []);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Workflow</Label>
                <Select
                    value={workflowId}
                    onValueChange={(v) => onChange({ ...config, workflowId: v })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a workflow..." />
                    </SelectTrigger>
                    <SelectContent>
                        {workflows.map((w) => (
                            <SelectItem key={w.slug} value={w.slug}>
                                {w.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Input Mapping (JSON)</Label>
                <Textarea
                    rows={5}
                    value={inputMappingText}
                    onChange={(e) => {
                        try {
                            onChange({ ...config, inputMapping: JSON.parse(e.target.value) });
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
