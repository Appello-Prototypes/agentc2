"use client";

import { Badge, cn, Skeleton } from "@repo/ui";

interface BacklogSummaryProps {
    tasksByStatus: Record<string, number>;
    totalTasks: number;
    loading: boolean;
    activeFilters: Set<string>;
    onToggleFilter: (status: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; activeColor: string }> = {
    PENDING: {
        label: "Pending",
        color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        activeColor: "bg-amber-500/30 text-amber-300 border-amber-400 ring-1 ring-amber-400/40"
    },
    IN_PROGRESS: {
        label: "In Progress",
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        activeColor: "bg-blue-500/30 text-blue-300 border-blue-400 ring-1 ring-blue-400/40"
    },
    COMPLETED: {
        label: "Completed",
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        activeColor:
            "bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-1 ring-emerald-400/40"
    },
    FAILED: {
        label: "Failed",
        color: "bg-red-500/10 text-red-400 border-red-500/20",
        activeColor: "bg-red-500/30 text-red-300 border-red-400 ring-1 ring-red-400/40"
    },
    DEFERRED: {
        label: "Deferred",
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
        activeColor: "bg-gray-500/30 text-gray-300 border-gray-400 ring-1 ring-gray-400/40"
    }
};

export default function BacklogSummary({
    tasksByStatus,
    totalTasks,
    loading,
    activeFilters,
    onToggleFilter
}: BacklogSummaryProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-24 rounded-full" />
                ))}
            </div>
        );
    }

    const allSelected =
        activeFilters.size === 0 || activeFilters.size === Object.keys(STATUS_CONFIG).length;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge
                variant="outline"
                className={cn(
                    "cursor-pointer text-xs transition-all",
                    allSelected && "ring-primary/40 ring-1"
                )}
                onClick={() => onToggleFilter("ALL")}
            >
                {totalTasks} Total
            </Badge>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const count = tasksByStatus[status] || 0;
                const isActive = activeFilters.has(status);
                return (
                    <Badge
                        key={status}
                        variant="outline"
                        className={cn(
                            "cursor-pointer text-xs transition-all",
                            isActive ? config.activeColor : config.color,
                            count === 0 && "opacity-50"
                        )}
                        onClick={() => onToggleFilter(status)}
                    >
                        {count} {config.label}
                    </Badge>
                );
            })}
        </div>
    );
}
