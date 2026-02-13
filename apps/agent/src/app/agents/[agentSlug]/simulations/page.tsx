"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Label,
    Skeleton
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface SimulationSession {
    id: string;
    theme: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    targetCount: number;
    completedCount: number;
    failedCount: number;
    concurrency: number;
    avgQualityScore: number | null;
    avgDurationMs: number | null;
    successRate: number | null;
    totalCostUsd: number | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

export default function SimulationsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SimulationSession[]>([]);
    const [theme, setTheme] = useState("");
    const [count, setCount] = useState(100);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/simulations`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.sessions);
            } else {
                setError(data.error || "Failed to load sessions");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load sessions");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Poll for updates when there are running sessions
    useEffect(() => {
        const hasRunning = sessions.some((s) => s.status === "RUNNING" || s.status === "PENDING");
        if (!hasRunning) return;

        const interval = setInterval(() => {
            fetchSessions();
        }, 5000);

        return () => clearInterval(interval);
    }, [sessions, fetchSessions]);

    const handleStartSimulation = async () => {
        if (!theme.trim()) {
            setError("Please enter a theme for the simulation");
            return;
        }

        setStarting(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/simulations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme: theme.trim(), count })
            });
            const data = await res.json();
            if (data.success) {
                setTheme("");
                fetchSessions();
            } else {
                setError(data.error || "Failed to start simulation");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start simulation");
        } finally {
            setStarting(false);
        }
    };

    const handleCancelSession = async (sessionId: string) => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/simulations/${sessionId}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.success) {
                fetchSessions();
            } else {
                setError(data.error || "Failed to cancel simulation");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to cancel simulation");
        }
    };

    const getStatusBadge = (status: SimulationSession["status"]) => {
        switch (status) {
            case "PENDING":
                return <Badge variant="secondary">Pending</Badge>;
            case "RUNNING":
                return <Badge variant="default">Running</Badge>;
            case "COMPLETED":
                return <Badge variant="outline">Completed</Badge>;
            case "FAILED":
                return <Badge variant="destructive">Failed</Badge>;
            case "CANCELLED":
                return <Badge variant="secondary">Cancelled</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return "-";
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatCost = (cost: number | null) => {
        if (!cost) return "-";
        return `$${cost.toFixed(4)}`;
    };

    const formatDate = (date: string | null) => {
        if (!date) return "-";
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    if (loading) {
        return (
            <div className="space-y-6 p-4 md:p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Simulations</h1>
                <p className="text-muted-foreground">
                    Run synthetic conversations to test and improve your agent before production.
                </p>
            </div>

            {error && (
                <div className="border-destructive bg-destructive/10 text-destructive rounded-lg border p-4">
                    {error}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-4"
                        onClick={() => setError(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Start Simulation Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Start New Simulation</CardTitle>
                    <CardDescription>
                        Describe what kind of user requests to simulate. The simulator will generate
                        realistic prompts based on your theme.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="theme">Theme</Label>
                        <textarea
                            id="theme"
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                            placeholder="e.g., Customer service questions about timesheets, Technical support for Jira integration, Sales inquiries about pricing..."
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="count">Number of Conversations</Label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                id="count"
                                min="10"
                                max="500"
                                step="10"
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value))}
                                className="w-full"
                            />
                            <span className="w-16 text-right font-mono text-sm">{count}</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleStartSimulation}
                        disabled={starting || !theme.trim()}
                        className="w-full"
                    >
                        {starting ? "Starting..." : "Start Simulation"}
                    </Button>
                </CardContent>
            </Card>

            {/* Sessions List */}
            <Card>
                <CardHeader>
                    <CardTitle>Simulation Sessions</CardTitle>
                    <CardDescription>
                        {sessions.length === 0
                            ? "No simulations yet. Start one above!"
                            : `${sessions.length} simulation session${sessions.length !== 1 ? "s" : ""}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <div className="text-muted-foreground py-8 text-center">
                            No simulations yet. Enter a theme above and click Start Simulation.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="flex items-start justify-between rounded-lg border p-4"
                                >
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(session.status)}
                                            <span className="text-muted-foreground text-sm">
                                                {formatDate(session.createdAt)}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 text-sm">{session.theme}</p>
                                        <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                                            <span>
                                                Progress: {session.completedCount}/
                                                {session.targetCount}
                                                {session.failedCount > 0 &&
                                                    ` (${session.failedCount} failed)`}
                                            </span>
                                            {session.status === "RUNNING" && (
                                                <span className="text-blue-500">
                                                    {Math.round(
                                                        ((session.completedCount +
                                                            session.failedCount) /
                                                            session.targetCount) *
                                                            100
                                                    )}
                                                    % complete
                                                </span>
                                            )}
                                            {session.avgQualityScore !== null && (
                                                <span>
                                                    Quality:{" "}
                                                    {(session.avgQualityScore * 100).toFixed(0)}%
                                                </span>
                                            )}
                                            {session.avgDurationMs !== null && (
                                                <span>
                                                    Avg Duration:{" "}
                                                    {formatDuration(session.avgDurationMs)}
                                                </span>
                                            )}
                                            {session.totalCostUsd !== null && (
                                                <span>
                                                    Cost: {formatCost(session.totalCostUsd)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-4 flex gap-2">
                                        {(session.status === "PENDING" ||
                                            session.status === "RUNNING") && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCancelSession(session.id)}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
