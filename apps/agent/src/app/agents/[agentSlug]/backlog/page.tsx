"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import BacklogSummary from "./components/backlog-summary";
import TaskCard from "./components/task-card";
import TaskDetail from "./components/task-detail";
import AddTaskDialog from "./components/add-task-dialog";
import EditTaskDialog from "./components/edit-task-dialog";

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

const ALL_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "DEFERRED"];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BacklogPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [backlog, setBacklog] = useState<BacklogInfo | null>(null);
    const [tasks, setTasks] = useState<BacklogTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<BacklogTask | null>(null);
    const [activeFilters, setActiveFilters] = useState<Set<string>>(
        new Set(["PENDING", "IN_PROGRESS"])
    );
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingTask, setEditingTask] = useState<BacklogTask | null>(null);

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
            const filtersToUse =
                activeFilters.size === 0 || activeFilters.size === ALL_STATUSES.length
                    ? ALL_STATUSES
                    : Array.from(activeFilters);
            const statusParam = filtersToUse.join(",");
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
    }, [agentSlug, activeFilters]);

    const refreshAll = useCallback(() => {
        fetchBacklog();
        fetchTasks();
    }, [fetchBacklog, fetchTasks]);

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

    useEffect(() => {
        const interval = setInterval(refreshAll, 30000);
        return () => clearInterval(interval);
    }, [refreshAll]);

    const handleToggleFilter = useCallback((status: string) => {
        setActiveFilters((prev) => {
            if (status === "ALL") {
                return new Set<string>();
            }
            const next = new Set(prev);
            if (next.has(status)) {
                next.delete(status);
            } else {
                next.add(status);
            }
            return next;
        });
    }, []);

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                await Promise.all([fetchBacklog(), fetchTasks()]);
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

    const handleEditTask = (task: BacklogTask) => {
        setEditingTask(task);
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

                {/* Clickable filter badges */}
                <div className="mt-3">
                    <BacklogSummary
                        tasksByStatus={backlog?.tasksByStatus || {}}
                        totalTasks={backlog?.totalTasks || 0}
                        loading={loading}
                        activeFilters={activeFilters}
                        onToggleFilter={handleToggleFilter}
                    />
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
                                No tasks match the current filters.
                            </p>
                            <Button
                                size="sm"
                                className="mt-4"
                                onClick={() => setShowAddDialog(true)}
                            >
                                Add Task
                            </Button>
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
                                    onEdit={handleEditTask}
                                    onDelete={handleDeleteTask}
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
                        onEdit={handleEditTask}
                    />
                </div>
            </div>

            {/* Add task dialog */}
            <AddTaskDialog
                agentSlug={agentSlug}
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                onTaskAdded={refreshAll}
            />

            {/* Edit task dialog */}
            <EditTaskDialog
                agentSlug={agentSlug}
                task={editingTask}
                open={!!editingTask}
                onClose={() => setEditingTask(null)}
                onTaskUpdated={refreshAll}
            />
        </div>
    );
}
