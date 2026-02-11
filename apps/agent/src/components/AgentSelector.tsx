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
import { StarIcon } from "lucide-react";

const DEFAULT_AGENT_KEY = "mastra-default-agent";

export function getDefaultAgentSlug(): string {
    if (typeof window === "undefined") return "assistant";
    return localStorage.getItem(DEFAULT_AGENT_KEY) || "assistant";
}

export function setDefaultAgentSlug(slug: string): void {
    localStorage.setItem(DEFAULT_AGENT_KEY, slug);
}

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
    const [defaultSlug, setDefaultSlug] = useState<string>(() => getDefaultAgentSlug());

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
                    // Filter out DEMO agents
                    setAgents(fetched.filter((a) => a.type !== "DEMO"));
                }
            } catch (error) {
                console.error("Failed to fetch agents:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAgents();
    }, []);

    // Sync parent whenever value or agents change (handles initial mount,
    // external agent switches from suggestion cards, and loaded conversations)
    useEffect(() => {
        if (agents.length === 0) return;
        const matched = agents.find((a) => a.slug === value);
        if (matched) {
            onChangeRef.current(matched.slug, matched);
        }
    }, [value, agents]);

    const handleValueChange = (newValue: string | null) => {
        if (!newValue) return;
        const agent = agents.find((a) => a.slug === newValue);
        if (agent) {
            // Persist selection as default so it survives page refreshes
            setDefaultAgentSlug(newValue);
            setDefaultSlug(newValue);
            console.log(`[AgentSelector] User selected agent: ${newValue} (${agent.name})`);
            onChange(newValue, agent);
        }
    };

    const handleSetDefault = (e: React.MouseEvent, slug: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDefaultAgentSlug(slug);
        setDefaultSlug(slug);
    };

    const selectedAgent = agents.find((a) => a.slug === value);

    if (loading) {
        return (
            <div className="bg-muted/50 flex h-9 w-[180px] items-center gap-2 rounded-md border px-3">
                <span className="bg-muted size-2 animate-pulse rounded-full" />
                <span className="bg-muted h-3 w-20 animate-pulse rounded" />
            </div>
        );
    }

    return (
        <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
            <SelectTrigger className="w-[180px]">
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
                    const groups: { label: string; items: AgentInfo[] }[] = [];

                    if (userAgents.length > 0) {
                        groups.push({ label: "Your Agents", items: userAgents });
                    }
                    if (systemAgents.length > 0) {
                        groups.push({ label: "System", items: systemAgents });
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
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        "size-2 rounded-full",
                                                        agent.isActive
                                                            ? "bg-green-500"
                                                            : "bg-muted-foreground"
                                                    )}
                                                />
                                                <span>{agent.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                title={
                                                    defaultSlug === agent.slug
                                                        ? "Default agent"
                                                        : "Set as default"
                                                }
                                                onPointerDown={(e) =>
                                                    handleSetDefault(e, agent.slug)
                                                }
                                                className={cn(
                                                    "ml-auto shrink-0 rounded p-0.5 transition-colors",
                                                    defaultSlug === agent.slug
                                                        ? "text-yellow-500"
                                                        : "text-muted-foreground/40 hover:text-yellow-500"
                                                )}
                                            >
                                                <StarIcon
                                                    className={cn(
                                                        "size-3",
                                                        defaultSlug === agent.slug && "fill-current"
                                                    )}
                                                />
                                            </button>
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
