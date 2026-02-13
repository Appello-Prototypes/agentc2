"use client";

import { AgentVersion } from "./types";
import { VersionCard } from "./version-card";
import { Button } from "@repo/ui";

interface VersionTimelineProps {
    versions: AgentVersion[];
    totalCount: number;
    selectModeActive: boolean;
    selectedVersions: number[];
    onToggleSelection: (version: number) => void;
    onViewDetails: (version: AgentVersion) => void;
    onCompareWithActive: (version: AgentVersion) => void;
    onRollback: (version: number) => void;
    rollingBack: number | null;
    onLoadMore: () => void;
    hasMore: boolean;
    loadingMore: boolean;
}

export function VersionTimeline({
    versions,
    totalCount,
    selectModeActive,
    selectedVersions,
    onToggleSelection,
    onViewDetails,
    onCompareWithActive,
    onRollback,
    rollingBack,
    onLoadMore,
    hasMore,
    loadingMore
}: VersionTimelineProps) {
    return (
        <div>
            <p className="text-muted-foreground mb-4 text-xs">
                Showing {versions.length} of {totalCount} versions
            </p>
            <div className="space-y-0">
                {versions.map((version, index) => {
                    const previousVersion = versions[index + 1] ?? null;
                    return (
                        <VersionCard
                            key={version.id}
                            version={version}
                            previousVersion={previousVersion}
                            isLast={index === versions.length - 1}
                            selectModeActive={selectModeActive}
                            isSelected={selectedVersions.includes(version.version)}
                            selectionDisabled={
                                !selectedVersions.includes(version.version) &&
                                selectedVersions.length >= 2
                            }
                            onToggleSelection={onToggleSelection}
                            onViewDetails={onViewDetails}
                            onCompareWithActive={onCompareWithActive}
                            onRollback={onRollback}
                            rollingBack={rollingBack}
                        />
                    );
                })}
            </div>

            {hasMore && (
                <div className="mt-4 text-center">
                    <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
                        {loadingMore ? "Loading..." : "Load More Versions"}
                    </Button>
                </div>
            )}
        </div>
    );
}
