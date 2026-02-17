"use client";

import { useState } from "react";
import { Button, Input, Badge } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AddTaskDialogProps {
    agentSlug: string;
    open: boolean;
    onClose: () => void;
    onTaskAdded: () => void;
}

export default function AddTaskDialog({
    agentSlug,
    open,
    onClose,
    onTaskAdded
}: AddTaskDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(5);
    const [dueDate, setDueDate] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

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
            const res = await fetch(`${getApiBase()}/api/backlogs/${agentSlug}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || undefined,
                    priority,
                    dueDate: dueDate || undefined,
                    tags,
                    source: "ui"
                })
            });

            const data = await res.json();
            if (data.success) {
                setTitle("");
                setDescription("");
                setPriority(5);
                setDueDate("");
                setTags([]);
                onTaskAdded();
                onClose();
            } else {
                setError(data.error || "Failed to create task");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="bg-background relative z-10 w-full max-w-md rounded-lg border p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold">Add Task</h2>

                {error && (
                    <div className="mb-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Title */}
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

                    {/* Description */}
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

                    {/* Priority */}
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

                    {/* Due Date */}
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

                    {/* Tags */}
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

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
                        {submitting ? "Adding..." : "Add Task"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
