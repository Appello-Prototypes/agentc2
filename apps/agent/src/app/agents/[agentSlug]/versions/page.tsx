"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import {
    VersionTimeline,
    VersionDetailSheet,
    VersionCompareDialog,
    VersionTrendChart
} from "./components";
import type { AgentVersion, VersionSnapshot, VersionStats } from "./components";
import { ChangelogTimeline } from "@/components/changelog";

interface ApiVersionResponse {
    id: string;
    version: number;
    description: string;
    instructions: string;
    modelProvider: string;
    modelName: string;
    changesJson?:
        | string[]
        | {
              type: string;
              fromVersion?: number;
              toVersion?: number;
              reason?: string;
          };
    snapshot?: VersionSnapshot;
    createdBy?: string;
    createdAt: string;
    isActive: boolean;
    isRollback: boolean;
    previousVersion: number | null;
    stats?: VersionStats;
    experimentResult?: {
        winRate: number | null;
        gatingResult: string | null;
        status: string;
    } | null;
}

const defaultStats: VersionStats = {
    runs: 0,
    successRate: 0,
    avgQuality: 0,
    totalCost: 0,
    avgDurationMs: null,
    feedbackSummary: { thumbsUp: 0, thumbsDown: 0 }
};

function transformVersion(v: ApiVersionResponse): AgentVersion {
    let changes: string[] = [];
    if (Array.isArray(v.changesJson)) {
        changes = v.changesJson;
    } else if (v.changesJson && typeof v.changesJson === "object") {
        if (v.changesJson.type === "rollback") {
            changes = [
                `Rolled back from v${v.changesJson.fromVersion} to v${v.changesJson.toVersion}`
            ];
            if (v.changesJson.reason) {
                changes.push(`Reason: ${v.changesJson.reason}`);
            }
        }
    }

    return {
        id: v.id,
        version: v.version,
        createdAt: v.createdAt,
        createdBy: v.createdBy || "System",
        description: v.description || `Version ${v.version}`,
        instructions: v.instructions || "",
        changes,
        isActive: v.isActive,
        isRollback: v.isRollback ?? false,
        previousVersion: v.previousVersion ?? null,
        modelProvider: v.modelProvider,
        modelName: v.modelName,
        snapshot: v.snapshot || null,
        stats: v.stats
            ? {
                  runs: v.stats.runs ?? 0,
                  successRate: v.stats.successRate ?? 0,
                  avgQuality: v.stats.avgQuality ?? 0,
                  totalCost: v.stats.totalCost ?? 0,
                  avgDurationMs: v.stats.avgDurationMs ?? null,
                  feedbackSummary: v.stats.feedbackSummary ?? { thumbsUp: 0, thumbsDown: 0 }
              }
            : defaultStats,
        experimentResult: v.experimentResult ?? null
    };
}

export default function VersionsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<AgentVersion[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [rollingBack, setRollingBack] = useState<number | null>(null);
    const [rollbackError, setRollbackError] = useState<string | null>(null);
    const [now] = useState(() => Date.now());

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");

    // Modal states
    const [selectedVersion, setSelectedVersion] = useState<AgentVersion | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareVersions, setCompareVersions] = useState<
        [AgentVersion | null, AgentVersion | null]
    >([null, null]);
    const [selectModeActive, setSelectModeActive] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

    const fetchVersions = useCallback(
        async (cursor?: string) => {
            try {
                if (!cursor) setLoading(true);
                else setLoadingMore(true);
                setError(null);

                const url = new URL(
                    `${getApiBase()}/api/agents/${agentSlug}/versions`,
                    window.location.origin
                );
                if (cursor) url.searchParams.set("cursor", cursor);

                const response = await fetch(url.toString());
                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || "Failed to fetch versions");
                }

                const transformedVersions = result.versions.map(transformVersion);

                if (cursor) {
                    setVersions((prev) => [...prev, ...transformedVersions]);
                } else {
                    setVersions(transformedVersions);
                }
                setTotalCount(result.totalCount ?? transformedVersions.length);
                setNextCursor(result.nextCursor ?? null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load versions");
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [agentSlug]
    );

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const handleLoadMore = () => {
        if (nextCursor) fetchVersions(nextCursor);
    };

    const handleRollback = async (targetVersion: number) => {
        try {
            setRollingBack(targetVersion);
            setRollbackError(null);

            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/versions/${targetVersion}/rollback`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                }
            );

            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Failed to rollback");

            await fetchVersions();
            setDetailsOpen(false);
        } catch (err) {
            setRollbackError(err instanceof Error ? err.message : "Failed to rollback");
        } finally {
            setRollingBack(null);
        }
    };

    const handleViewDetails = (version: AgentVersion) => {
        setSelectedVersion(version);
        setDetailsOpen(true);
    };

    const handleCompareWithActive = (version: AgentVersion) => {
        const activeVersion = versions.find((v) => v.isActive);
        if (activeVersion) {
            setCompareVersions([version, activeVersion]);
            setCompareOpen(true);
        }
    };

    const toggleVersionSelection = (versionNum: number) => {
        setSelectedForCompare((prev) => {
            if (prev.includes(versionNum)) {
                return prev.filter((v) => v !== versionNum);
            }
            if (prev.length < 2) {
                return [...prev, versionNum];
            }
            return prev;
        });
    };

    const handleCompareVersionsClick = () => {
        if (selectModeActive && selectedForCompare.length === 2) {
            const [v1, v2] = selectedForCompare.sort((a, b) => b - a);
            const version1 = versions.find((v) => v.version === v1);
            const version2 = versions.find((v) => v.version === v2);
            if (version1 && version2) {
                setCompareVersions([version1, version2]);
                setCompareOpen(true);
                setSelectModeActive(false);
                setSelectedForCompare([]);
            }
        } else {
            setSelectModeActive(true);
            setSelectedForCompare([]);
        }
    };

    const handleCancelSelection = () => {
        setSelectModeActive(false);
        setSelectedForCompare([]);
    };

    // Export History
    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(versions, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${agentSlug}-version-history.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCsv = () => {
        const header =
            "Version,Date,Description,Provider,Model,Runs,SuccessRate,Quality,Cost,AvgLatencyMs\n";
        const rows = versions
            .map(
                (v) =>
                    `${v.version},${new Date(v.createdAt).toISOString()},"${v.description.replace(/"/g, '""')}",${v.modelProvider},${v.modelName},${v.stats.runs},${v.stats.successRate},${v.stats.avgQuality},${v.stats.totalCost},${v.stats.avgDurationMs ?? ""}`
            )
            .join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${agentSlug}-version-history.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filtered versions
    const filteredVersions = useMemo(() => {
        let filtered = versions;

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (v) =>
                    v.description.toLowerCase().includes(q) ||
                    v.createdBy.toLowerCase().includes(q) ||
                    v.changes.some((c) => c.toLowerCase().includes(q))
            );
        }

        // Type filter
        if (filterType !== "all") {
            filtered = filtered.filter((v) => {
                switch (filterType) {
                    case "rollback":
                        return v.isRollback;
                    case "learning":
                        return v.createdBy?.toLowerCase().includes("learning");
                    case "experiment":
                        return v.experimentResult !== null;
                    case "manual":
                        return !v.isRollback && !v.createdBy?.toLowerCase().includes("learning");
                    default:
                        return true;
                }
            });
        }

        return filtered;
    }, [versions, searchQuery, filterType]);

    // Find previous version for the detail sheet
    const selectedPreviousVersion = useMemo(() => {
        if (!selectedVersion) return null;
        const idx = versions.findIndex((v) => v.id === selectedVersion.id);
        return idx >= 0 && idx < versions.length - 1 ? versions[idx + 1] : null;
    }, [selectedVersion, versions]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Version History</h1>
                    <p className="text-muted-foreground">
                        Track changes, compare versions, and rollback if needed
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={() => fetchVersions()}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const activeVersion = versions.find((v) => v.isActive);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Version History</h1>
                    <p className="text-muted-foreground">
                        Track changes, compare versions, and rollback if needed
                    </p>
                </div>
                <div className="flex gap-2">
                    {selectModeActive ? (
                        <>
                            <Button variant="outline" onClick={handleCancelSelection}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCompareVersionsClick}
                                disabled={selectedForCompare.length !== 2}
                            >
                                Compare ({selectedForCompare.length}/2 selected)
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={handleCompareVersionsClick}>
                            Compare Versions
                        </Button>
                    )}
                    <div className="relative">
                        <Button
                            variant="outline"
                            onClick={handleExportJson}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                handleExportCsv();
                            }}
                        >
                            Export JSON
                        </Button>
                    </div>
                    <Button variant="outline" onClick={handleExportCsv}>
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Rollback Error */}
            {rollbackError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-sm text-red-600">Rollback failed: {rollbackError}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setRollbackError(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Active Version Hero Card */}
            {activeVersion && (
                <Card className="border-primary bg-primary/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Badge className="px-3 py-1 text-lg">
                                    v{activeVersion.version}
                                </Badge>
                                <div>
                                    <CardTitle>Current Active Version</CardTitle>
                                    <CardDescription>{activeVersion.description}</CardDescription>
                                </div>
                            </div>
                            <Badge variant="default">Active</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Runs</p>
                                <p className="text-xl font-bold">{activeVersion.stats.runs}</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Success Rate</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats.successRate}%
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Quality</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats.avgQuality}%
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Total Cost</p>
                                <p className="text-xl font-bold">
                                    ${activeVersion.stats.totalCost.toFixed(4)}
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Avg Latency</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats.avgDurationMs
                                        ? `${(activeVersion.stats.avgDurationMs / 1000).toFixed(1)}s`
                                        : "-"}
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Deployed</p>
                                <p className="text-lg font-medium">
                                    {Math.floor(
                                        (now - new Date(activeVersion.createdAt).getTime()) /
                                            (1000 * 60 * 60 * 24)
                                    )}{" "}
                                    days ago
                                </p>
                            </div>
                        </div>
                        {/* Feedback indicator */}
                        {(activeVersion.stats.feedbackSummary.thumbsUp > 0 ||
                            activeVersion.stats.feedbackSummary.thumbsDown > 0) && (
                            <div className="mt-2 text-center">
                                <span className="text-muted-foreground text-xs">
                                    Feedback: {activeVersion.stats.feedbackSummary.thumbsUp} thumbs
                                    up, {activeVersion.stats.feedbackSummary.thumbsDown} thumbs down
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Trend Chart (replaces redundant comparison table) */}
            <VersionTrendChart versions={versions} onVersionClick={handleViewDetails} />

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-3">
                <Input
                    placeholder="Search by description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Versions</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="rollback">Rollback</SelectItem>
                        <SelectItem value="learning">Learning</SelectItem>
                        <SelectItem value="experiment">Experiment</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Version Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>All Versions</CardTitle>
                    <CardDescription>
                        {filteredVersions.length === versions.length
                            ? `${versions.length} versions total`
                            : `${filteredVersions.length} of ${versions.length} versions shown`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <VersionTimeline
                        versions={filteredVersions}
                        totalCount={totalCount}
                        selectModeActive={selectModeActive}
                        selectedVersions={selectedForCompare}
                        onToggleSelection={toggleVersionSelection}
                        onViewDetails={handleViewDetails}
                        onCompareWithActive={handleCompareWithActive}
                        onRollback={handleRollback}
                        rollingBack={rollingBack}
                        onLoadMore={handleLoadMore}
                        hasMore={nextCursor !== null}
                        loadingMore={loadingMore}
                    />
                </CardContent>
            </Card>

            {/* Changelog / Audit Trail */}
            <ChangelogTimeline entityType="agent" entityId={agentSlug} title="Audit Trail" />

            {/* Version Detail Sheet */}
            <VersionDetailSheet
                version={selectedVersion}
                previousVersion={selectedPreviousVersion}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onRollback={handleRollback}
                onCompareWithActive={handleCompareWithActive}
                rollingBack={rollingBack}
                agentSlug={agentSlug}
            />

            {/* Compare Versions Dialog */}
            <VersionCompareDialog
                versions={compareVersions}
                open={compareOpen}
                onOpenChange={setCompareOpen}
            />
        </div>
    );
}
