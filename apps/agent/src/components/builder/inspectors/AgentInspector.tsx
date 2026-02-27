"use client";

import { useEffect, useState } from "react";
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
import { getApiBase } from "@/lib/utils";

interface AgentInspectorProps {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

interface AgentOption {
    slug: string;
    name: string;
    modelName?: string;
}

export function AgentInspector({ config, onChange }: AgentInspectorProps) {
    const [agents, setAgents] = useState<AgentOption[]>([]);

    useEffect(() => {
        fetch(`${getApiBase()}/api/agents`)
            .then((r) => r.json())
            .then((d) => setAgents(d.agents || []))
            .catch(() => {});
    }, []);

    const agentSlug = (config.agentSlug as string) || "";
    const promptTemplate = (config.promptTemplate as string) || "";
    const outputFormat = (config.outputFormat as string) || "text";
    const maxSteps = (config.maxSteps as number) || 10;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Agent</Label>
                <Select
                    value={agentSlug}
                    onValueChange={(v) => onChange({ ...config, agentSlug: v })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                        {agents.map((a) => (
                            <SelectItem key={a.slug} value={a.slug}>
                                {a.name} {a.modelName ? `(${a.modelName})` : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Prompt Template</Label>
                <Textarea
                    rows={5}
                    value={promptTemplate}
                    onChange={(e) => onChange({ ...config, promptTemplate: e.target.value })}
                    placeholder="Enter the prompt for the agent. Use {{input}}, {{steps.stepId.output}} for data references."
                />
            </div>

            <div className="space-y-2">
                <Label>Output Format</Label>
                <Select
                    value={outputFormat}
                    onValueChange={(v) => onChange({ ...config, outputFormat: v })}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Max Steps</Label>
                <Input
                    type="number"
                    min={1}
                    max={50}
                    value={maxSteps}
                    onChange={(e) =>
                        onChange({ ...config, maxSteps: parseInt(e.target.value) || 10 })
                    }
                />
            </div>
        </div>
    );
}
