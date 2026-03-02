"use client";

import { Button, Checkbox } from "@repo/ui";
import type { SortOption } from "../types";

interface FilterBarProps {
    workflowSlugs: string[];
    riskLevels: string[];
    filterWorkflow: string;
    filterRisk: string;
    sortBy: SortOption;
    onFilterWorkflowChange: (value: string) => void;
    onFilterRiskChange: (value: string) => void;
    onSortByChange: (value: SortOption) => void;
    tab: string;
    pendingCount: number;
    allPendingSelected: boolean;
    selectedCount: number;
    onToggleSelectAll: () => void;
    onBatchApprove: () => void;
    batchActing: boolean;
    filteredCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "highest-risk", label: "Highest Risk" },
    { value: "by-source", label: "By Source" }
];

export function FilterBar({
    workflowSlugs,
    riskLevels,
    filterWorkflow,
    filterRisk,
    sortBy,
    onFilterWorkflowChange,
    onFilterRiskChange,
    onSortByChange,
    tab,
    pendingCount,
    allPendingSelected,
    selectedCount,
    onToggleSelectAll,
    onBatchApprove,
    batchActing,
    filteredCount
}: FilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {workflowSlugs.length > 1 && (
                <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Workflow:</span>
                    <select
                        value={filterWorkflow}
                        onChange={(e) => onFilterWorkflowChange(e.target.value)}
                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                    >
                        <option value="all">All</option>
                        {workflowSlugs.map((slug) => (
                            <option key={slug} value={slug}>
                                {slug}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {riskLevels.length > 1 && (
                <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Risk:</span>
                    <select
                        value={filterRisk}
                        onChange={(e) => onFilterRiskChange(e.target.value)}
                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                    >
                        <option value="all">All</option>
                        {riskLevels.map((level) => (
                            <option key={level} value={level}>
                                {level}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">Sort:</span>
                <select
                    value={sortBy}
                    onChange={(e) => onSortByChange(e.target.value as SortOption)}
                    className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                >
                    {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {tab === "pending" && pendingCount > 0 && (
                <>
                    <div className="flex items-center gap-1.5">
                        <Checkbox
                            checked={allPendingSelected}
                            onCheckedChange={onToggleSelectAll}
                        />
                        <span className="text-muted-foreground text-xs">Select all</span>
                    </div>
                    {selectedCount > 0 && (
                        <Button size="sm" onClick={onBatchApprove} disabled={batchActing}>
                            {batchActing ? "Processing…" : `Approve selected (${selectedCount})`}
                        </Button>
                    )}
                </>
            )}

            <span className="text-muted-foreground ml-auto text-xs">
                {filteredCount} decision{filteredCount !== 1 ? "s" : ""}
            </span>
        </div>
    );
}
