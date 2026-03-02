"use client";

import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, HugeiconsIcon, icons } from "@repo/ui";
import { getHealthStatus, getHealthStyles } from "@repo/ui/lib/health";
import { FeedCardCompact } from "./feed-card-compact";
import type { EventGroup } from "../_lib/types";
import { formatDuration, formatCost } from "../_lib/helpers";

const GROUP_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    campaign: {
        label: "Campaign",
        icon: "zap",
        color: "text-purple-600 dark:text-purple-400"
    },
    network: {
        label: "Network",
        icon: "share",
        color: "text-emerald-600 dark:text-emerald-400"
    },
    workflow: {
        label: "Workflow",
        icon: "git-branch",
        color: "text-blue-600 dark:text-blue-400"
    }
};

export function ExecutionTreeCard({
    group,
    onAgentClick,
    onRunClick,
    onChainClick
}: {
    group: EventGroup;
    onAgentClick: (slug: string) => void;
    onRunClick: (runId: string, agentSlug: string) => void;
    onChainClick: (networkRunId: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const config = GROUP_TYPE_CONFIG[group.type] || GROUP_TYPE_CONFIG.workflow!;

    const successRate =
        group.stats.total > 0 ? (group.stats.completed / group.stats.total) * 100 : 100;
    const healthStatus = getHealthStatus(successRate);
    const healthStyles = getHealthStyles(healthStatus);

    const iconRef = icons[config.icon as keyof typeof icons];

    return (
        <Card className={`border-l-2 transition-all ${healthStyles.border}`}>
            <CardHeader className="pb-2">
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${healthStyles.bg}`}
                        >
                            {iconRef && (
                                <HugeiconsIcon
                                    icon={iconRef}
                                    className={`size-4 ${config.color}`}
                                />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    {config.label}
                                </Badge>
                                <span className="text-sm font-medium">
                                    {group.rootEvent.summary.slice(0, 80)}
                                    {group.rootEvent.summary.length > 80 ? "..." : ""}
                                </span>
                            </div>
                            <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                                <span>{group.stats.total} events</span>
                                {group.stats.totalCost > 0 && (
                                    <span>{formatCost(group.stats.totalCost)}</span>
                                )}
                                {group.stats.totalDuration > 0 && (
                                    <span>{formatDuration(group.stats.totalDuration)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {group.stats.completed > 0 && (
                            <Badge
                                variant="secondary"
                                className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            >
                                {group.stats.completed} done
                            </Badge>
                        )}
                        {group.stats.failed > 0 && (
                            <Badge
                                variant="secondary"
                                className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            >
                                {group.stats.failed} failed
                            </Badge>
                        )}
                        {group.stats.running > 0 && (
                            <Badge
                                variant="secondary"
                                className="animate-pulse bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                            >
                                {group.stats.running} running
                            </Badge>
                        )}
                        <div className={`flex h-2 w-2 rounded-full ${healthStyles.dot}`} />
                        <HugeiconsIcon
                            icon={icons["chevron-down"]!}
                            className={`text-muted-foreground size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                    </div>
                </button>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-1 pt-0">
                    <div className="border-muted ml-4 space-y-1 border-l-2 pl-3">
                        {group.events.map((event) => (
                            <FeedCardCompact
                                key={event.id}
                                event={event}
                                isNew={false}
                                onAgentClick={onAgentClick}
                                onRunClick={onRunClick}
                            />
                        ))}
                    </div>
                    {group.type === "network" && group.rootEvent.networkRunId && (
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground mt-2 ml-4 text-xs underline"
                            onClick={() => onChainClick(group.rootEvent.networkRunId!)}
                        >
                            View trace chain
                        </button>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
