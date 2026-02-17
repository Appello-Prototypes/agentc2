"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import BacklogSummary from "./components/backlog-summary";
import TaskCard from "./components/task-card";
import TaskDetail from "./components/task-detail";
import AddTaskDialog from "./components/add-task-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacklogTask {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    dueDate: string | null;
    source: string | null;
    createdById: string | null;
    tags: string[];
    agentRunId: string | null;
    lastAttemptAt: string | null;
    lastAttemptNote: string | null;
    result: string | null;
    completedAt: string | null;
    contextJson: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

interface BacklogInfo {
    id: string;
    agentSlug: string;
    agentName: string;
    name: string;
    description: string | null;
    totalTasks: number;
    tasksByStatus: Record<string, number>;
}

type StatusGroup = "active" | "completed";

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BacklogPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [backlog, setBacklog] = useState<BacklogInfo | null>(null);
    const [tasks, setTasks] = useState<BacklogTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<BacklogTask | null>(null);
    const [statusGroup, setStatusGroup] = useState<StatusGroup>("active");
    const [showAddDialog, setShowAddDialog] = useState(false);

    const fetchBacklog = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}`);
            const data = await res.json();
            if (data.success && data.backlog) {
                setBacklog(data.backlog);
            }
        } catch (err) {
            console.error("Failed to fetch backlog:", err);
        }
    }, [agentSlug]);

    const fetchTasks = useCallback(async () => {
        try {
            const statusParam =
                statusGroup === "active" ? "PENDING,IN_PROGRESS" : "COMPLETED,FAILED,DEFERRED";
            const res = await fetch(
                `${getApiBase()}/api/backlogs/${agentSlug}/tasks?status=${statusParam}&sortBy=priority&limit=100`
            );
            const data = await res.json();
            if (data.success) {
                setTasks(data.tasks);
            }
        } catch (err) {
            console.error("Failed to fetch tasks:", err);
        }
    }, [agentSlug, statusGroup]);

    const refreshAll = useCallback(() => {
        fetchBacklog();
        fetchTasks();
    }, [fetchBacklog, fetchTasks]);

    // Initial data load
    useEffect(() => {
        let cancelled = false;
        async function loadInitial() {
            await Promise.all([fetchBacklog(), fetchTasks()]);
            if (!cancelled) setLoading(false);
        }
        loadInitial();
        return () => {
            cancelled = true;
        };
    }, [fetchBacklog, fetchTasks]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(refreshAll, 30000);
        return () => clearInterval(interval);
    }, [refreshAll]);

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh lists
                await Promise.all([fetchBacklog(), fetchTasks()]);
                // Update selected task if it's the one we changed
                if (selectedTask?.id === taskId) {
                    setSelectedTask(data.task);
                }
            }
        } catch (err) {
            console.error("Failed to update task:", err);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}/tasks/${taskId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                if (selectedTask?.id === taskId) {
                    setSelectedTask(null);
                }
                await Promise.all([fetchBacklog(), fetchTasks()]);
            }
        } catch (err) {
            console.error("Failed to delete task:", err);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Backlog</h1>
                        <p className="text-muted-foreground text-sm">
                            Persistent work queue for this agent
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={refreshAll}>
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowAddDialog(true)}>
                            Add Task
                        </Button>
                    </div>
                </div>

                {/* Summary badges */}
                <div className="mt-3">
                    <BacklogSummary
                        tasksByStatus={backlog?.tasksByStatus || {}}
                        totalTasks={backlog?.totalTasks || 0}
                        loading={loading}
                    />
                </div>
            </div>

            {/* Status group tabs */}
            <div className="border-b px-6 py-2">
                <div className="flex gap-4">
                    <button
                        className={`pb-1 text-sm font-medium transition-colors ${
                            statusGroup === "active"
                                ? "border-primary text-foreground border-b-2"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStatusGroup("active")}
                    >
                        Active
                    </button>
                    <button
                        className={`pb-1 text-sm font-medium transition-colors ${
                            statusGroup === "completed"
                                ? "border-primary text-foreground border-b-2"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStatusGroup("completed")}
                    >
                        Completed / Closed
                    </button>
                </div>
            </div>

            {/* Two-column layout: task list + detail panel */}
            <div className="flex min-h-0 flex-1">
                {/* Task list */}
                <div className="w-1/2 overflow-auto border-r">
                    {loading ? (
                        <div className="space-y-2 p-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="text-muted-foreground mb-4 text-4xl">{"[ ]"}</div>
                            <h3 className="text-lg font-medium">No tasks</h3>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {statusGroup === "active"
                                    ? "No active tasks in this backlog."
                                    : "No completed or closed tasks."}
                            </p>
                            {statusGroup === "active" && (
                                <Button
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => setShowAddDialog(true)}
                                >
                                    Add First Task
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    isSelected={selectedTask?.id === task.id}
                                    onSelect={setSelectedTask}
                                    onStatusChange={handleStatusChange}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                <div className="w-1/2 overflow-auto">
                    <TaskDetail
                        task={selectedTask}
                        agentSlug={agentSlug}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteTask}
                    />
                </div>
            </div>

            {/* Add task dialog */}
            <AddTaskDialog
                agentSlug={agentSlug}
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                onTaskAdded={() => {
                    fetchBacklog();
                    fetchTasks();
                }}
            />
        </div>
    );
}
