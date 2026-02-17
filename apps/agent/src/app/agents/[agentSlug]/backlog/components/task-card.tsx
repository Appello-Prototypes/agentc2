"use client";

import { Badge, cn } from "@repo/ui";
import { formatRelativeTime } from "@/components/run-detail-utils";
import type { BacklogTask } from "../page";

interface TaskCardProps {
    task: BacklogTask;
    isSelected: boolean;
    onSelect: (task: BacklogTask) => void;
    onStatusChange: (taskId: string, status: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    FAILED: "Failed",
    DEFERRED: "Deferred"
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    DEFERRED: "bg-gray-500/10 text-gray-400 border-gray-500/20"
};

function getPriorityLevel(priority: number): string {
    if (priority >= 8) return "high";
    if (priority >= 5) return "medium";
    return "low";
}

export default function TaskCard({ task, isSelected, onSelect, onStatusChange }: TaskCardProps) {
    const priorityLevel = getPriorityLevel(task.priority);

    return (
        <div
            className={cn(
                "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                isSelected ? "border-primary bg-accent" : "hover:bg-accent/50 border-transparent"
            )}
            onClick={() => onSelect(task)}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium">{task.title}</h4>
                        <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] ${PRIORITY_COLORS[priorityLevel]}`}
                        >
                            P:{task.priority}
                        </Badge>
                    </div>
                    {task.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                            {task.description}
                        </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                        <select
                            className="bg-background text-muted-foreground cursor-pointer rounded border px-1.5 py-0.5 text-[10px]"
                            value={task.status}
                            onChange={(e) => {
                                e.stopPropagation();
                                onStatusChange(task.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        {task.tags.length > 0 && (
                            <div className="flex gap-1">
                                {task.tags.slice(0, 2).map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="h-4 px-1 text-[9px]"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                                {task.tags.length > 2 && (
                                    <span className="text-muted-foreground text-[9px]">
                                        +{task.tags.length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_COLORS[task.status] || ""}`}
                    >
                        {STATUS_LABELS[task.status] || task.status}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                        {formatRelativeTime(task.createdAt)}
                    </span>
                    {task.dueDate && (
                        <span className="text-muted-foreground text-[10px]">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
