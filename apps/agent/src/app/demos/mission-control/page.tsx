"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Textarea,
    Badge
} from "@repo/ui";

interface GoalScore {
    relevancy: number;
    completeness: number;
    overall: number;
    passed: boolean;
}

interface Goal {
    id: string;
    title: string;
    description: string;
    status: "queued" | "running" | "completed" | "failed";
    progress: number;
    currentStep?: string;
    score?: GoalScore;
    result?: { text: string };
    error?: string;
    createdAt: string;
    updatedAt?: string;
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
    return (
        <div className={`bg-muted h-2 w-full overflow-hidden rounded-full ${className}`}>
            <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
        </div>
    );
}

function StatusBadge({ status }: { status: Goal["status"] }) {
    const variants: Record<Goal["status"], "default" | "secondary" | "destructive" | "outline"> = {
        queued: "secondary",
        running: "default",
        completed: "outline",
        failed: "destructive"
    };

    const labels: Record<Goal["status"], string> = {
        queued: "Queued",
        running: "Running",
        completed: "Completed",
        failed: "Failed"
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export default function MissionControlPage() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // SSE connection for real-time updates
    useEffect(() => {
        const eventSource = new EventSource(`${getApiBase()}/api/goals/stream`);

        eventSource.addEventListener("init", (e) => {
            try {
                const data = JSON.parse(e.data);
                setGoals(data.goals || []);
            } catch (err) {
                console.error("Failed to parse init event:", err);
            }
        });

        eventSource.addEventListener("update", (e) => {
            try {
                const data = JSON.parse(e.data);
                setGoals(data.goals || []);
            } catch (err) {
                console.error("Failed to parse update event:", err);
            }
        });

        eventSource.addEventListener("error", () => {
            console.error("SSE connection error");
        });

        return () => eventSource.close();
    }, []);

    // Update selected goal when goals change
    useEffect(() => {
        if (selectedGoal) {
            const updated = goals.find((g) => g.id === selectedGoal.id);
            if (updated) {
                setSelectedGoal(updated);
            }
        }
    }, [goals, selectedGoal]);

    const submitGoal = useCallback(async () => {
        if (!title.trim() || !description.trim()) {
            setError("Title and description are required");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(`${getApiBase()}/api/goals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), description: description.trim() })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to create goal");
            }

            const goal = await response.json();
            setGoals((prev) => [goal, ...prev]);
            setTitle("");
            setDescription("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create goal");
        } finally {
            setIsSubmitting(false);
        }
    }, [title, description]);

    const retryGoal = useCallback(async (goalId: string) => {
        try {
            const response = await fetch(`${getApiBase()}/api/goals/${goalId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "retry" })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to retry goal");
            }
        } catch (err) {
            console.error("Retry failed:", err);
        }
    }, []);

    const cancelGoal = useCallback(async (goalId: string) => {
        try {
            const response = await fetch(`${getApiBase()}/api/goals/${goalId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancel" })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to cancel goal");
            }
        } catch (err) {
            console.error("Cancel failed:", err);
        }
    }, []);

    const deleteGoal = useCallback(
        async (goalId: string) => {
            try {
                const response = await fetch(`${getApiBase()}/api/goals/${goalId}`, {
                    method: "DELETE"
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to delete goal");
                }

                setGoals((prev) => prev.filter((g) => g.id !== goalId));
                if (selectedGoal?.id === goalId) {
                    setSelectedGoal(null);
                }
            } catch (err) {
                console.error("Delete failed:", err);
            }
        },
        [selectedGoal?.id]
    );

    return (
        <div className="container mx-auto space-y-6 p-4 md:p-6">
            <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold">Mission Control</h1>
                <p className="text-muted-foreground">
                    Submit goals and let the AI agent work on them autonomously in the background.
                </p>
            </div>

            {/* Goal Submission */}
            <Card>
                <CardHeader>
                    <CardTitle>Submit a Goal</CardTitle>
                    <CardDescription>
                        Describe what you want to accomplish. The agent will plan and execute it
                        automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Goal title (e.g., 'Research competitors')"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <Textarea
                        placeholder="Describe what you want to accomplish in detail..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                    />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button
                        onClick={submitGoal}
                        disabled={!title.trim() || !description.trim() || isSubmitting}
                    >
                        {isSubmitting ? "Submitting..." : "Submit Goal"}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Goals List */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Your Goals</h3>
                    {goals.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No goals yet. Submit one above to get started.
                        </p>
                    ) : (
                        goals.map((goal) => (
                            <Card
                                key={goal.id}
                                className={`cursor-pointer transition-all ${
                                    selectedGoal?.id === goal.id
                                        ? "ring-primary ring-2"
                                        : "hover:shadow-md"
                                }`}
                                onClick={() => setSelectedGoal(goal)}
                            >
                                <CardContent className="p-4">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <span className="truncate font-medium">{goal.title}</span>
                                        <StatusBadge status={goal.status} />
                                    </div>

                                    {goal.status === "running" && (
                                        <div className="space-y-1">
                                            <ProgressBar value={goal.progress} />
                                            <p className="text-muted-foreground text-xs">
                                                {goal.currentStep || "Processing..."}
                                            </p>
                                        </div>
                                    )}

                                    {goal.status === "completed" && goal.score && (
                                        <p className="text-muted-foreground text-xs">
                                            Score: {Math.round(goal.score.overall * 100)}%
                                            {goal.score.passed ? " (Passed)" : " (Below threshold)"}
                                        </p>
                                    )}

                                    {goal.status === "failed" && (
                                        <p className="text-destructive text-xs">
                                            Click to see details
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Goal Detail */}
                <Card className="lg:col-span-2">
                    <CardContent className="p-6">
                        {selectedGoal ? (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-semibold">
                                            {selectedGoal.title}
                                        </h3>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {selectedGoal.description}
                                        </p>
                                    </div>
                                    <StatusBadge status={selectedGoal.status} />
                                </div>

                                {/* Progress */}
                                {selectedGoal.status === "running" && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Progress</span>
                                            <span>{selectedGoal.progress}%</span>
                                        </div>
                                        <ProgressBar value={selectedGoal.progress} />
                                        <p className="text-muted-foreground text-sm">
                                            {selectedGoal.currentStep}
                                        </p>
                                    </div>
                                )}

                                {/* Result */}
                                {selectedGoal.status === "completed" && selectedGoal.result && (
                                    <div className="space-y-3">
                                        <h4 className="font-medium">Result</h4>
                                        <div className="bg-muted max-h-96 overflow-auto rounded-lg p-4">
                                            <pre className="text-sm whitespace-pre-wrap">
                                                {selectedGoal.result.text}
                                            </pre>
                                        </div>

                                        {selectedGoal.score && (
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                <span>
                                                    Relevancy:{" "}
                                                    {Math.round(selectedGoal.score.relevancy * 100)}
                                                    %
                                                </span>
                                                <span>
                                                    Completeness:{" "}
                                                    {Math.round(
                                                        selectedGoal.score.completeness * 100
                                                    )}
                                                    %
                                                </span>
                                                <span>
                                                    Overall:{" "}
                                                    {Math.round(selectedGoal.score.overall * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Error */}
                                {selectedGoal.status === "failed" && selectedGoal.error && (
                                    <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                                        <h4 className="mb-2 font-medium">Error</h4>
                                        <p className="text-sm">{selectedGoal.error}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-4">
                                    {selectedGoal.status === "failed" && (
                                        <Button
                                            variant="outline"
                                            onClick={() => retryGoal(selectedGoal.id)}
                                        >
                                            Retry
                                        </Button>
                                    )}

                                    {(selectedGoal.status === "queued" ||
                                        selectedGoal.status === "running") && (
                                        <Button
                                            variant="outline"
                                            onClick={() => cancelGoal(selectedGoal.id)}
                                        >
                                            Cancel
                                        </Button>
                                    )}

                                    <Button
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => deleteGoal(selectedGoal.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground flex h-64 items-center justify-center">
                                <p>Select a goal to view details</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
