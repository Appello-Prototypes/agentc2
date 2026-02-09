"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getApiBase } from "@/lib/utils";
import { calculateCost } from "@/lib/cost-calculator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton
} from "@repo/ui";

interface Run {
    id: string;
    input: string;
    output: string;
    status: "completed" | "failed" | "timeout" | "running" | "queued" | "cancelled";
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    modelName: string;
    toolCalls: string[];
    scores: {
        helpfulness?: number;
        relevancy?: number;
        toxicity?: number;
    };
    feedback?: {
        rating?: number;
        thumbs?: "up" | "down";
    };
    userId?: string;
    createdAt: string;
}

function StatusBadge({ status }: { status: Run["status"] }) {
    const config: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
        completed: { variant: "default", label: "Completed" },
        failed: { variant: "destructive", label: "Failed" },
        timeout: { variant: "secondary", label: "Timeout" },
        running: { variant: "outline", label: "Running" },
        queued: { variant: "secondary", label: "Queued" },
        cancelled: { variant: "secondary", label: "Cancelled" }
    };
    const { variant, label } = config[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
}

export default function RunsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [rerunning, setRerunning] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [triggerIdFilter, setTriggerIdFilter] = useState<string | null>(
        searchParams.get("triggerId")
    );

    useEffect(() => {
        setTriggerIdFilter(searchParams.get("triggerId"));
    }, [searchParams]);

    useEffect(() => {
        const fetchRuns = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (statusFilter !== "all") {
                    params.append("status", statusFilter.toUpperCase());
                }
                // Source filter: "all" shows everything, "production" excludes simulations, "simulation" shows only simulations
                if (sourceFilter !== "all") {
                    params.append("source", sourceFilter);
                } else {
                    params.append("source", "all");
                }
                if (searchQuery) {
                    params.append("search", searchQuery);
                }
                if (triggerIdFilter) {
                    params.append("triggerId", triggerIdFilter);
                }

                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/runs?${params.toString()}`
                );
                const result = await response.json();

                if (result.success) {
                    // Transform API response to match Run interface
                    const transformedRuns = result.runs.map(
                        (run: {
                            id: string;
                            runType: string;
                            status: string;
                            inputText: string;
                            outputText: string;
                            durationMs: number;
                            startedAt: string;
                            modelProvider?: string;
                            modelName?: string;
                            promptTokens?: number;
                            completionTokens?: number;
                            totalTokens?: number;
                            costUsd?: number;
                            evaluation?: Record<string, number>;
                            feedback?: { thumbs?: boolean; rating?: number };
                        }) => {
                            // Calculate cost from tokens if not provided
                            const cost =
                                run.costUsd ??
                                calculateCost(
                                    run.modelName || "gpt-4o",
                                    run.modelProvider,
                                    run.promptTokens,
                                    run.completionTokens
                                );

                            return {
                                id: run.id,
                                input: run.inputText,
                                output: run.outputText || "",
                                status: run.status.toLowerCase() as Run["status"],
                                durationMs: run.durationMs || 0,
                                promptTokens: run.promptTokens || 0,
                                completionTokens: run.completionTokens || 0,
                                totalTokens: run.totalTokens || 0,
                                estimatedCost: cost,
                                modelName: run.modelName || "unknown",
                                toolCalls: [],
                                scores: run.evaluation || {},
                                feedback: run.feedback
                                    ? {
                                          thumbs:
                                              run.feedback.thumbs === true
                                                  ? ("up" as const)
                                                  : run.feedback.thumbs === false
                                                    ? ("down" as const)
                                                    : undefined,
                                          rating: run.feedback.rating
                                      }
                                    : undefined,
                                createdAt: run.startedAt
                            };
                        }
                    );
                    setRuns(transformedRuns);
                } else {
                    console.error("Failed to fetch runs:", result.error);
                    // Fall back to empty array on error
                    setRuns([]);
                }
            } catch (error) {
                console.error("Error fetching runs:", error);
                setRuns([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRuns();
    }, [agentSlug, statusFilter, sourceFilter, searchQuery, triggerIdFilter]);

    // Handle viewing full trace
    const handleViewTrace = (runId: string) => {
        router.push(`/agents/${agentSlug}/traces?runId=${runId}`);
    };

    // Handle re-running an agent execution
    const handleRerun = async (runId: string) => {
        try {
            setRerunning(true);
            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/runs/${runId}/rerun`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                }
            );

            const result = await response.json();

            if (result.success) {
                // Refresh the runs list to show the new run
                const params = new URLSearchParams();
                if (statusFilter !== "all") {
                    params.append("status", statusFilter.toUpperCase());
                }
                if (searchQuery) {
                    params.append("search", searchQuery);
                }

                const refreshResponse = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/runs?${params.toString()}`
                );
                const refreshResult = await refreshResponse.json();

                if (refreshResult.success) {
                    const transformedRuns = refreshResult.runs.map(
                        (run: {
                            id: string;
                            runType: string;
                            status: string;
                            inputText: string;
                            outputText: string;
                            durationMs: number;
                            startedAt: string;
                            modelProvider?: string;
                            modelName?: string;
                            promptTokens?: number;
                            completionTokens?: number;
                            totalTokens?: number;
                            costUsd?: number;
                            evaluation?: Record<string, number>;
                            feedback?: { thumbs?: boolean; rating?: number };
                        }) => {
                            const cost =
                                run.costUsd ??
                                calculateCost(
                                    run.modelName || "gpt-4o",
                                    run.modelProvider,
                                    run.promptTokens,
                                    run.completionTokens
                                );

                            return {
                                id: run.id,
                                input: run.inputText,
                                output: run.outputText || "",
                                status: run.status.toLowerCase() as Run["status"],
                                durationMs: run.durationMs || 0,
                                promptTokens: run.promptTokens || 0,
                                completionTokens: run.completionTokens || 0,
                                totalTokens: run.totalTokens || 0,
                                estimatedCost: cost,
                                modelName: run.modelName || "unknown",
                                toolCalls: [],
                                scores: run.evaluation || {},
                                feedback: run.feedback
                                    ? {
                                          thumbs:
                                              run.feedback.thumbs === true
                                                  ? ("up" as const)
                                                  : run.feedback.thumbs === false
                                                    ? ("down" as const)
                                                    : undefined,
                                          rating: run.feedback.rating
                                      }
                                    : undefined,
                                createdAt: run.startedAt
                            };
                        }
                    );
                    setRuns(transformedRuns);

                    // Select the new run
                    const newRun = transformedRuns.find((r: Run) => r.id === result.newRunId);
                    if (newRun) {
                        setSelectedRun(newRun);
                    }
                }
            } else {
                console.error("Failed to re-run:", result.error);
                alert(`Failed to re-run: ${result.error}`);
            }
        } catch (error) {
            console.error("Error re-running:", error);
            alert("Failed to re-run the agent execution");
        } finally {
            setRerunning(false);
        }
    };

    // Handle exporting a single run
    const handleExportRun = (run: Run) => {
        const exportData = {
            id: run.id,
            input: run.input,
            output: run.output,
            status: run.status,
            durationMs: run.durationMs,
            promptTokens: run.promptTokens,
            completionTokens: run.completionTokens,
            totalTokens: run.totalTokens,
            estimatedCost: run.estimatedCost,
            modelName: run.modelName,
            scores: run.scores,
            feedback: run.feedback,
            createdAt: run.createdAt
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `run-${run.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Handle exporting all runs
    const handleExportAllRuns = () => {
        setExporting(true);
        try {
            const headers = [
                "ID",
                "Input",
                "Output",
                "Status",
                "Duration (ms)",
                "Prompt Tokens",
                "Completion Tokens",
                "Total Tokens",
                "Cost (USD)",
                "Model",
                "Helpfulness",
                "Relevancy",
                "Feedback",
                "Created At"
            ];

            const rows = filteredRuns.map((run) => [
                run.id,
                `"${run.input.replace(/"/g, '""')}"`,
                `"${run.output.replace(/"/g, '""')}"`,
                run.status,
                run.durationMs,
                run.promptTokens,
                run.completionTokens,
                run.totalTokens,
                run.estimatedCost.toFixed(6),
                run.modelName,
                run.scores.helpfulness !== undefined
                    ? (run.scores.helpfulness * 100).toFixed(0) + "%"
                    : "",
                run.scores.relevancy !== undefined
                    ? (run.scores.relevancy * 100).toFixed(0) + "%"
                    : "",
                run.feedback?.thumbs || "",
                run.createdAt
            ]);

            const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${agentSlug}-runs-${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const filteredRuns = runs.filter((run) => {
        if (statusFilter !== "all" && run.status !== statusFilter) return false;
        if (searchQuery && !run.input.toLowerCase().includes(searchQuery.toLowerCase()))
            return false;
        return true;
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Run History</h1>
                    <p className="text-muted-foreground">
                        All executions for this agent ({runs.length} total)
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportAllRuns}
                    disabled={exporting || filteredRuns.length === 0}
                >
                    {exporting ? "Exporting..." : "Export"}
                </Button>
            </div>

            {triggerIdFilter && (
                <Card>
                    <CardContent className="flex items-center justify-between gap-4 py-4 text-sm">
                        <div>
                            Filtering runs for trigger{" "}
                            <span className="font-medium">{triggerIdFilter}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setTriggerIdFilter(null);
                                router.push(`/agents/${agentSlug}/runs`);
                            }}
                        >
                            Clear filter
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="max-w-sm flex-1">
                    <Input
                        placeholder="Search runs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="timeout">Timeout</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="simulation">Simulation</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Runs List & Detail */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Runs List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Runs ({filteredRuns.length})</CardTitle>
                        <CardDescription>Click a run to view details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] space-y-2 overflow-y-auto">
                            {filteredRuns.map((run) => (
                                <div
                                    key={run.id}
                                    onClick={() => setSelectedRun(run)}
                                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                        selectedRun?.id === run.id
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {run.input}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <StatusBadge status={run.status} />
                                                <span className="text-muted-foreground text-xs">
                                                    {(run.durationMs / 1000).toFixed(1)}s
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {run.totalTokens} tokens
                                                </span>
                                                {run.feedback?.thumbs && (
                                                    <span className="text-sm">
                                                        {run.feedback.thumbs === "up" ? "👍" : "👎"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground shrink-0 text-xs">
                                            {new Date(run.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Run Detail */}
                <Card>
                    <CardHeader>
                        <CardTitle>Run Detail</CardTitle>
                        <CardDescription>
                            {selectedRun ? `ID: ${selectedRun.id}` : "Select a run to view details"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedRun ? (
                            <div className="space-y-6">
                                {/* Status & Timing */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-muted-foreground text-sm">Status</p>
                                        <StatusBadge status={selectedRun.status} />
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-sm">Duration</p>
                                        <p className="font-mono">
                                            {(selectedRun.durationMs / 1000).toFixed(2)}s
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-sm">Cost</p>
                                        <p className="font-mono">
                                            ${selectedRun.estimatedCost.toFixed(4)}
                                        </p>
                                    </div>
                                </div>

                                {/* Input */}
                                <div>
                                    <p className="text-muted-foreground mb-1 text-sm">Input</p>
                                    <div className="bg-muted rounded-lg p-3">
                                        <p className="text-sm">{selectedRun.input}</p>
                                    </div>
                                </div>

                                {/* Output */}
                                <div>
                                    <p className="text-muted-foreground mb-1 text-sm">Output</p>
                                    <div className="bg-muted rounded-lg p-3">
                                        <p className="text-sm">{selectedRun.output}</p>
                                    </div>
                                </div>

                                {/* Tool Calls */}
                                {selectedRun.toolCalls.length > 0 && (
                                    <div>
                                        <p className="text-muted-foreground mb-1 text-sm">
                                            Tool Calls
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRun.toolCalls.map((tool, i) => (
                                                <Badge key={i} variant="outline">
                                                    🔧 {tool}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tokens */}
                                <div>
                                    <p className="text-muted-foreground mb-1 text-sm">
                                        Token Usage
                                    </p>
                                    <div className="bg-muted grid grid-cols-3 gap-4 rounded-lg p-3">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Prompt</p>
                                            <p className="font-mono text-sm">
                                                {selectedRun.promptTokens}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">
                                                Completion
                                            </p>
                                            <p className="font-mono text-sm">
                                                {selectedRun.completionTokens}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Total</p>
                                            <p className="font-mono text-sm">
                                                {selectedRun.totalTokens}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Scores */}
                                {Object.keys(selectedRun.scores).length > 0 && (
                                    <div>
                                        <p className="text-muted-foreground mb-1 text-sm">
                                            Evaluation Scores
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {selectedRun.scores.helpfulness !== undefined && (
                                                <div className="bg-muted rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs">
                                                        Helpfulness
                                                    </p>
                                                    <p className="text-xl font-bold">
                                                        {(
                                                            selectedRun.scores.helpfulness * 100
                                                        ).toFixed(0)}
                                                        %
                                                    </p>
                                                </div>
                                            )}
                                            {selectedRun.scores.relevancy !== undefined && (
                                                <div className="bg-muted rounded-lg p-3">
                                                    <p className="text-muted-foreground text-xs">
                                                        Relevancy
                                                    </p>
                                                    <p className="text-xl font-bold">
                                                        {(
                                                            selectedRun.scores.relevancy * 100
                                                        ).toFixed(0)}
                                                        %
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewTrace(selectedRun.id)}
                                    >
                                        View Full Trace
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRerun(selectedRun.id)}
                                        disabled={rerunning}
                                    >
                                        {rerunning ? "Re-running..." : "Re-run"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExportRun(selectedRun)}
                                    >
                                        Export
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground py-12 text-center">
                                <p>Select a run from the list to view details</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
