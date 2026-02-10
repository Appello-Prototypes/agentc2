"use client";

import { useState, useEffect, useRef } from "react";
import { getApiBase } from "@/lib/utils";
import {
    cn,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from "@repo/ui";

export interface AgentInfo {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    type: "SYSTEM" | "USER" | "DEMO";
    description?: string;
    modelProvider: string;
    modelName: string;
}

interface AgentSelectorProps {
    value: string;
    onChange: (slug: string, agent: AgentInfo) => void;
    disabled?: boolean;
}

export function AgentSelector({ value, onChange, disabled }: AgentSelectorProps) {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [loading, setLoading] = useState(true);

    // Stable ref to onChange so the effect doesn't re-fire on every render
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Stable ref to value for the initial callback
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        async function fetchAgents() {
            try {
                const res = await fetch(`${getApiBase()}/api/agents`);
                const data = await res.json();
                if (data.success && data.agents) {
                    const fetched: AgentInfo[] = data.agents;
                    setAgents(fetched);

                    // Fire initial callback so the parent gets model info on mount
                    const matched = fetched.find((a) => a.slug === valueRef.current);
                    if (matched) {
                        onChangeRef.current(matched.slug, matched);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch agents:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAgents();
    }, []);

    const handleValueChange = (newValue: string | null) => {
        if (!newValue) return;
        const agent = agents.find((a) => a.slug === newValue);
        if (agent) {
            onChange(newValue, agent);
        }
    };

    const selectedAgent = agents.find((a) => a.slug === value);

    if (loading) {
        return (
            <div className="bg-muted/50 flex h-9 w-[220px] items-center gap-2 rounded-md border px-3">
                <span className="bg-muted size-2 animate-pulse rounded-full" />
                <span className="bg-muted h-3 w-20 animate-pulse rounded" />
            </div>
        );
    }

    return (
        <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
            <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select an agent">
                    {selectedAgent ? (
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "size-2 rounded-full",
                                    selectedAgent.isActive ? "bg-green-500" : "bg-muted-foreground"
                                )}
                            />
                            <span>{selectedAgent.name}</span>
                        </div>
                    ) : (
                        "Select an agent"
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {(() => {
                    const userAgents = agents.filter((a) => a.type === "USER");
                    const systemAgents = agents.filter((a) => a.type === "SYSTEM");
                    const demoAgents = agents.filter((a) => a.type === "DEMO");
                    const groups: { label: string; items: AgentInfo[]; muted?: boolean }[] = [];

                    if (userAgents.length > 0) {
                        groups.push({ label: "Your Agents", items: userAgents });
                    }
                    if (systemAgents.length > 0) {
                        groups.push({ label: "System", items: systemAgents });
                    }
                    if (demoAgents.length > 0) {
                        groups.push({ label: "Examples", items: demoAgents, muted: true });
                    }

                    if (groups.length === 0) {
                        return (
                            <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                No agents available
                            </div>
                        );
                    }

                    return groups.map((group, gi) => (
                        <div key={group.label}>
                            {gi > 0 && <SelectSeparator />}
                            <SelectGroup>
                                <SelectLabel>{group.label}</SelectLabel>
                                {group.items.map((agent) => (
                                    <SelectItem key={agent.slug} value={agent.slug}>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    "size-2 rounded-full",
                                                    agent.isActive
                                                        ? "bg-green-500"
                                                        : "bg-muted-foreground"
                                                )}
                                            />
                                            <span
                                                className={
                                                    group.muted ? "text-muted-foreground" : ""
                                                }
                                            >
                                                {agent.name}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </div>
                    ));
                })()}
            </SelectContent>
        </Select>
    );
}
