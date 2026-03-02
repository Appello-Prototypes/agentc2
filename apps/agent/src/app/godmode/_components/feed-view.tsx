"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, HugeiconsIcon, icons } from "@repo/ui";
import { getSeverity } from "@repo/ui/lib/severity";
import { FeedCard } from "./feed-card";
import { FeedCardCompact } from "./feed-card-compact";
import { StatsBar } from "./stats-bar";
import { FeedFilters } from "./feed-filters";
import { ActiveAgentsSidebar } from "./active-agents-sidebar";
import { InsightsPanel } from "./insights-panel";
import { FeedSkeleton } from "./feed-skeleton";
import { ExecutionTreeCard } from "./execution-tree-card";
import type { ActivityEvent, FeedMetrics, GroupedEventsResponse } from "../_lib/types";
import type { SystemHealthData } from "../_hooks/use-system-health";

type ViewMode = "detail" | "compact";

function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
    const [mode, setMode] = useState<ViewMode>("detail");
    useEffect(() => {
        const stored = localStorage.getItem("godmode-view-mode");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (stored === "compact" || stored === "detail") setMode(stored);
    }, []);
    const set = (m: ViewMode) => {
        setMode(m);
        localStorage.setItem("godmode-view-mode", m);
    };
    return [mode, set];
}

function shouldRenderFull(event: ActivityEvent, viewMode: ViewMode): boolean {
    if (viewMode === "detail") return true;
    if (event.status === "failure" || event.type.includes("FAILED")) return true;
    const severity = getSeverity(event.status);
    return severity === "critical" || severity === "high";
}

export function FeedView({
    events,
    metrics,
    loading,
    initialLoadDone,
    newEventIds,
    activeAgents,
    selectedAgent,
    typeFilter,
    searchQuery,
    systemHealth,
    groupedEvents,
    groupedMode,
    onGroupedModeChange,
    onSearchChange,
    onTypeFilterChange,
    onAgentFilter,
    onClearFilters,
    onAgentClick,
    onRunClick,
    onChainClick
}: {
    events: ActivityEvent[];
    metrics: FeedMetrics | null;
    loading: boolean;
    initialLoadDone: boolean;
    newEventIds: Set<string>;
    activeAgents: Array<{ agentSlug: string; agentName: string; count: number }>;
    selectedAgent: string | null;
    typeFilter: string;
    searchQuery: string;
    systemHealth: SystemHealthData;
    groupedEvents: GroupedEventsResponse | null;
    groupedMode: boolean;
    onGroupedModeChange: (grouped: boolean) => void;
    onSearchChange: (value: string) => void;
    onTypeFilterChange: (value: string) => void;
    onAgentFilter: (slug: string | null) => void;
    onClearFilters: () => void;
    onAgentClick: (slug: string) => void;
    onRunClick: (runId: string, agentSlug: string) => void;
    onChainClick: (networkRunId: string) => void;
}) {
    const [viewMode, setViewMode] = useViewMode();

    return (
        <>
            <StatsBar metrics={metrics} />

            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <FeedFilters
                        searchQuery={searchQuery}
                        typeFilter={typeFilter}
                        selectedAgent={selectedAgent}
                        onSearchChange={onSearchChange}
                        onTypeFilterChange={onTypeFilterChange}
                        onClear={onClearFilters}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 rounded-md border p-0.5">
                        <Button
                            variant={groupedMode ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onGroupedModeChange(!groupedMode)}
                        >
                            Grouped
                        </Button>
                    </div>
                    <div className="flex gap-1 rounded-md border p-0.5">
                        <Button
                            variant={viewMode === "detail" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setViewMode("detail")}
                        >
                            Detail
                        </Button>
                        <Button
                            variant={viewMode === "compact" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setViewMode("compact")}
                        >
                            Compact
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                    {loading && !initialLoadDone ? (
                        <FeedSkeleton />
                    ) : events.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <div className="text-muted-foreground">
                                    <HugeiconsIcon
                                        icon={icons["search"]!}
                                        className="mx-auto mb-4 size-12 opacity-30"
                                    />
                                    <p className="text-lg font-medium">No activity yet</p>
                                    <p className="mt-1 text-sm">
                                        Agent events will appear here in real-time as they happen.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : groupedMode && groupedEvents ? (
                        <>
                            {groupedEvents.groups.map((group) => (
                                <ExecutionTreeCard
                                    key={group.key}
                                    group={group}
                                    onAgentClick={onAgentClick}
                                    onRunClick={onRunClick}
                                    onChainClick={onChainClick}
                                />
                            ))}
                            {groupedEvents.ungrouped.map((event) =>
                                shouldRenderFull(event, viewMode) ? (
                                    <FeedCard
                                        key={event.id}
                                        event={event}
                                        isNew={newEventIds.has(event.id)}
                                        onAgentClick={onAgentClick}
                                        onRunClick={onRunClick}
                                        onChainClick={onChainClick}
                                    />
                                ) : (
                                    <FeedCardCompact
                                        key={event.id}
                                        event={event}
                                        isNew={newEventIds.has(event.id)}
                                        onAgentClick={onAgentClick}
                                        onRunClick={onRunClick}
                                    />
                                )
                            )}
                        </>
                    ) : (
                        events.map((event) =>
                            shouldRenderFull(event, viewMode) ? (
                                <FeedCard
                                    key={event.id}
                                    event={event}
                                    isNew={newEventIds.has(event.id)}
                                    onAgentClick={onAgentClick}
                                    onRunClick={onRunClick}
                                    onChainClick={onChainClick}
                                />
                            ) : (
                                <FeedCardCompact
                                    key={event.id}
                                    event={event}
                                    isNew={newEventIds.has(event.id)}
                                    onAgentClick={onAgentClick}
                                    onRunClick={onRunClick}
                                />
                            )
                        )
                    )}
                </div>

                <div className="hidden w-72 shrink-0 space-y-4 lg:block">
                    <ActiveAgentsSidebar
                        agents={activeAgents}
                        selectedAgent={selectedAgent}
                        onSelect={onAgentFilter}
                    />
                    <InsightsPanel metrics={metrics} systemHealth={systemHealth} />
                </div>
            </div>
        </>
    );
}
