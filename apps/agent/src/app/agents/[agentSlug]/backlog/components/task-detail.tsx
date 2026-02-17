"use client";

import { useRouter } from "next/navigation";
import { Badge, Button, Separator } from "@repo/ui";
import { formatRelativeTime } from "@/components/run-detail-utils";
import type { BacklogTask } from "../page";

interface TaskDetailProps {
    task: BacklogTask | null;
    agentSlug: string;
    onStatusChange: (taskId: string, status: string) => void;
    onDelete: (taskId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    FAILED: "Failed",
    DEFERRED: "Deferred"
};

const PRIORITY_COLORS: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
};

function getPriorityLevel(priority: number): string {
    if (priority >= 8) return "high";
    if (priority >= 5) return "medium";
    return "low";
}

export default function TaskDetail({ task, agentSlug, onStatusChange, onDelete }: TaskDetailProps) {
    const router = useRouter();

    if (!task) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <p className="text-muted-foreground text-sm">Select a task to view details</p>
            </div>
        );
    }

    const priorityLevel = getPriorityLevel(task.priority);

    return (
        <div className="flex h-full flex-col overflow-auto">
            {/* Header */}
            <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">{task.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={`text-[10px] ${PRIORITY_COLORS[priorityLevel]}`}
                    >
                        Priority {task.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABELS[task.status] || task.status}
                    </Badge>
                    {task.source && (
                        <Badge variant="secondary" className="text-[10px]">
                            {task.source}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-4 py-3">
                {/* Description */}
                {task.description && (
                    <div className="mb-4">
                        <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                            Description
                        </h4>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {task.description}
                        </p>
                    </div>
                )}

                <Separator className="my-3" />

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <span className="text-muted-foreground">Created</span>
                        <p className="font-medium">{formatRelativeTime(task.createdAt)}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Updated</span>
                        <p className="font-medium">{formatRelativeTime(task.updatedAt)}</p>
                    </div>
                    {task.dueDate && (
                        <div>
                            <span className="text-muted-foreground">Due Date</span>
                            <p className="font-medium">
                                {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                    {task.completedAt && (
                        <div>
                            <span className="text-muted-foreground">Completed</span>
                            <p className="font-medium">{formatRelativeTime(task.completedAt)}</p>
                        </div>
                    )}
                    {task.lastAttemptAt && (
                        <div>
                            <span className="text-muted-foreground">Last Attempt</span>
                            <p className="font-medium">{formatRelativeTime(task.lastAttemptAt)}</p>
                        </div>
                    )}
                    {task.createdById && (
                        <div>
                            <span className="text-muted-foreground">Created By</span>
                            <p className="font-mono font-medium">
                                {task.createdById.slice(0, 8)}...
                            </p>
                        </div>
                    )}
                </div>

                {/* Tags */}
                {task.tags.length > 0 && (
                    <>
                        <Separator className="my-3" />
                        <div>
                            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                Tags
                            </h4>
                            <div className="flex flex-wrap gap-1">
                                {task.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Last Attempt Note */}
                {task.lastAttemptNote && (
                    <>
                        <Separator className="my-3" />
                        <div>
                            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                Last Attempt Note
                            </h4>
                            <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                                {task.lastAttemptNote}
                            </pre>
                        </div>
                    </>
                )}

                {/* Result */}
                {task.result && (
                    <>
                        <Separator className="my-3" />
                        <div>
                            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                Result
                            </h4>
                            <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                                {task.result}
                            </pre>
                        </div>
                    </>
                )}

                {/* Context JSON */}
                {task.contextJson && (
                    <>
                        <Separator className="my-3" />
                        <div>
                            <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                Context
                            </h4>
                            <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                                {JSON.stringify(task.contextJson, null, 2)}
                            </pre>
                        </div>
                    </>
                )}
            </div>

            {/* Footer actions */}
            <div className="space-y-2 border-t px-4 py-3">
                {task.agentRunId && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                            router.push(`/agents/${agentSlug}/runs?search=${task.agentRunId}`)
                        }
                    >
                        View Run
                    </Button>
                )}
                <div className="flex gap-2">
                    {task.status === "PENDING" && (
                        <Button
                            variant="default"
                            size="sm"
                            className="flex-1"
                            onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                        >
                            Start
                        </Button>
                    )}
                    {task.status === "IN_PROGRESS" && (
                        <Button
                            variant="default"
                            size="sm"
                            className="flex-1"
                            onClick={() => onStatusChange(task.id, "COMPLETED")}
                        >
                            Complete
                        </Button>
                    )}
                    {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => onStatusChange(task.id, "DEFERRED")}
                        >
                            Defer
                        </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => onDelete(task.id)}>
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
