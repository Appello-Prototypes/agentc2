"use client";

import { useState, useEffect } from "react";
import { Button, Input, Badge } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import type { BacklogTask } from "../page";

interface EditTaskDialogProps {
    agentSlug: string;
    task: BacklogTask | null;
    open: boolean;
    onClose: () => void;
    onTaskUpdated: () => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "DEFERRED", label: "Deferred" }
];

export default function EditTaskDialog({
    agentSlug,
    task,
    open,
    onClose,
    onTaskUpdated
}: EditTaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(5);
    const [status, setStatus] = useState("PENDING");
    const [dueDate, setDueDate] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (task && open) {
            setTitle(task.title);
            setDescription(task.description || "");
            setPriority(task.priority);
            setStatus(task.status);
            setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0]! : "");
            setTags(task.tags || []);
            setTagInput("");
            setError(null);
        }
    }, [task, open]);

    if (!open || !task) return null;

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setTagInput("");
        }
    };

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter((t) => t !== tag));
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    status,
                    dueDate: dueDate || null,
                    tags
                })
            });

            const data = await res.json();
            if (data.success) {
                onTaskUpdated();
                onClose();
            } else {
                setError(data.error || "Failed to update task");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="bg-background relative z-10 w-full max-w-md rounded-lg border p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold">Edit Task</h2>

                {error && (
                    <div className="mb-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Title *
                        </label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Description
                        </label>
                        <textarea
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the task..."
                        />
                    </div>

                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Status
                        </label>
                        <select
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Priority (0-10)
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value))}
                                className="flex-1"
                            />
                            <span
                                className={`min-w-8 text-center text-sm font-medium ${
                                    priority >= 8
                                        ? "text-red-400"
                                        : priority >= 5
                                          ? "text-amber-400"
                                          : "text-emerald-400"
                                }`}
                            >
                                {priority}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Due Date
                        </label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                            Tags
                        </label>
                        <div className="flex gap-2">
                            <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                placeholder="Add tag..."
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddTag();
                                    }
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddTag}
                                type="button"
                            >
                                Add
                            </Button>
                        </div>
                        {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="cursor-pointer text-xs"
                                        onClick={() => handleRemoveTag(tag)}
                                    >
                                        {tag} ×
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
                        {submitting ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
