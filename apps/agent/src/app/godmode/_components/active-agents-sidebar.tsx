"use client";

import { Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import { getAgentColor, getAgentInitials } from "../_lib/helpers";

export function ActiveAgentsSidebar({
    agents,
    selectedAgent,
    onSelect
}: {
    agents: Array<{ agentSlug: string; agentName: string; count: number }>;
    selectedAgent: string | null;
    onSelect: (slug: string | null) => void;
}) {
    if (agents.length === 0) return null;

    return (
        <Card>
            <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Active Agents</h3>
                <div className="space-y-1.5">
                    <button
                        onClick={() => onSelect(null)}
                        className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            !selectedAgent
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                            All
                        </div>
                        <span className="truncate">All Agents</span>
                    </button>
                    {agents.map((agent) => (
                        <button
                            key={agent.agentSlug}
                            onClick={() =>
                                onSelect(selectedAgent === agent.agentSlug ? null : agent.agentSlug)
                            }
                            className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                selectedAgent === agent.agentSlug
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br text-[9px] font-bold text-white",
                                    getAgentColor(agent.agentSlug)
                                )}
                            >
                                {getAgentInitials(agent.agentName, agent.agentSlug)}
                            </div>
                            <span className="flex-1 truncate text-left">
                                {agent.agentName || agent.agentSlug}
                            </span>
                            <span className="text-muted-foreground text-[10px] tabular-nums">
                                {agent.count}
                            </span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
