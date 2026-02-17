"use client";

import { Badge, Skeleton } from "@repo/ui";

interface BacklogSummaryProps {
    tasksByStatus: Record<string, number>;
    totalTasks: number;
    loading: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: {
        label: "Pending",
        color: "bg-amber-500/10 text-amber-400 border-amber-500/20"
    },
    IN_PROGRESS: {
        label: "In Progress",
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    },
    COMPLETED: {
        label: "Completed",
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    },
    FAILED: {
        label: "Failed",
        color: "bg-red-500/10 text-red-400 border-red-500/20"
    },
    DEFERRED: {
        label: "Deferred",
        color: "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
};

export default function BacklogSummary({
    tasksByStatus,
    totalTasks,
    loading
}: BacklogSummaryProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-24 rounded-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
                {totalTasks} Total
            </Badge>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const count = tasksByStatus[status] || 0;
                if (count === 0) return null;
                return (
                    <Badge key={status} variant="outline" className={`text-xs ${config.color}`}>
                        {count} {config.label}
                    </Badge>
                );
            })}
        </div>
    );
}
