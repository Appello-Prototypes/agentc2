"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { GodModeView } from "./_lib/types";
import { useActivityFeed } from "./_hooks/use-activity-feed";
import { useSystemHealth } from "./_hooks/use-system-health";
import { FeedView } from "./_components/feed-view";
import { WiretapView } from "./_components/wiretap-view";
import { TraceChainDrawer } from "./_components/trace-chain-sheet";
import { SystemHealthBar } from "./_components/system-health-bar";
import { StatsGrid } from "./_components/stats-grid";
import { RunInspectorSheet } from "./_components/run-inspector-sheet";
import { KindFilter, type KindFilterValue } from "./_components/kind-filter";

export default function GodModePage() {
    const router = useRouter();
    const [activeView, setActiveView] = useState<GodModeView>("feed");
    const [chainTarget, setChainTarget] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [kindFilter, setKindFilter] = useState<KindFilterValue>("all");
    const [groupedMode, setGroupedMode] = useState(false);
    const [inspectorTarget, setInspectorTarget] = useState<{
        runId: string;
        agentSlug: string;
        kind?: "agent" | "workflow" | "network";
    } | null>(null);

    const {
        events,
        groupedEvents,
        metrics,
        loading,
        isLive,
        setIsLive,
        newEventIds,
        activeAgents,
        initialLoadDone,
        resetTimestamp
    } = useActivityFeed({ selectedAgent, typeFilter, searchQuery, grouped: groupedMode });

    const systemHealth = useSystemHealth();

    const handleAgentClick = useCallback(
        (slug: string) => router.push(`/agents/${slug}`),
        [router]
    );

    const handleRunClick = useCallback((runId: string, agentSlug: string) => {
        setInspectorTarget({ runId, agentSlug, kind: "agent" });
    }, []);

    const handleAgentFilter = useCallback(
        (slug: string | null) => {
            setSelectedAgent(slug);
            resetTimestamp();
        },
        [resetTimestamp]
    );

    const handleChainClick = useCallback((networkRunId: string) => {
        setChainTarget(networkRunId);
    }, []);

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchQuery(value);
            resetTimestamp();
        },
        [resetTimestamp]
    );

    const handleTypeFilterChange = useCallback(
        (value: string) => {
            setTypeFilter(value);
            setKindFilter("all");
            resetTimestamp();
        },
        [resetTimestamp]
    );

    const handleClearFilters = useCallback(() => {
        setSelectedAgent(null);
        setTypeFilter("all");
        setSearchQuery("");
        setKindFilter("all");
        resetTimestamp();
    }, [resetTimestamp]);

    const handleKindChange = useCallback(
        (kind: KindFilterValue, tf: string) => {
            setKindFilter(kind);
            setTypeFilter(tf);
            resetTimestamp();
        },
        [resetTimestamp]
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">God Mode</h1>
                            {activeView === "feed" && (
                                <button
                                    onClick={() => setIsLive(!isLive)}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                        isLive
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {isLive && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                        </span>
                                    )}
                                    {isLive ? "LIVE" : "Paused"}
                                </button>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            {activeView === "feed"
                                ? "Real-time feed of every agent execution, network routing, and system event across the platform."
                                : "Live execution traces streaming from all running agents across the platform."}
                        </p>
                    </div>
                </div>

                {/* View tabs */}
                <div className="flex items-center gap-1 border-b">
                    <button
                        onClick={() => setActiveView("feed")}
                        className={cn(
                            "relative px-4 py-2 text-sm font-medium transition-colors",
                            activeView === "feed"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                    >
                        Feed
                        {activeView === "feed" && (
                            <span className="bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-t" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveView("wiretap")}
                        className={cn(
                            "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                            activeView === "wiretap"
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground/70"
                        )}
                    >
                        Wiretap
                        {activeView === "wiretap" && (
                            <span className="bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-t" />
                        )}
                    </button>
                    {activeView === "feed" && (
                        <div className="ml-auto">
                            <KindFilter value={kindFilter} onChange={handleKindChange} />
                        </div>
                    )}
                </div>

                {activeView === "feed" && (
                    <>
                        <SystemHealthBar data={systemHealth} />
                        <StatsGrid data={systemHealth} />
                        <FeedView
                            events={events}
                            metrics={metrics}
                            loading={loading}
                            initialLoadDone={initialLoadDone}
                            newEventIds={newEventIds}
                            activeAgents={activeAgents}
                            selectedAgent={selectedAgent}
                            typeFilter={typeFilter}
                            searchQuery={searchQuery}
                            systemHealth={systemHealth}
                            groupedEvents={groupedEvents}
                            groupedMode={groupedMode}
                            onGroupedModeChange={setGroupedMode}
                            onSearchChange={handleSearchChange}
                            onTypeFilterChange={handleTypeFilterChange}
                            onAgentFilter={handleAgentFilter}
                            onClearFilters={handleClearFilters}
                            onAgentClick={handleAgentClick}
                            onRunClick={handleRunClick}
                            onChainClick={handleChainClick}
                        />
                    </>
                )}

                {activeView === "wiretap" && <WiretapView />}
            </div>

            {chainTarget && (
                <TraceChainDrawer networkRunId={chainTarget} onClose={() => setChainTarget(null)} />
            )}

            <RunInspectorSheet target={inspectorTarget} onClose={() => setInspectorTarget(null)} />
        </div>
    );
}
