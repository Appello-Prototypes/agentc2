"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getApiBase } from "@/lib/utils";
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
    status: "completed" | "failed" | "timeout" | "running";
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
    const config = {
        completed: { variant: "default" as const, label: "Completed" },
        failed: { variant: "destructive" as const, label: "Failed" },
        timeout: { variant: "secondary" as const, label: "Timeout" },
        running: { variant: "outline" as const, label: "Running" }
    };
    const { variant, label } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
}

export default function RunsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchRuns = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (statusFilter !== "all") {
                    params.append("status", statusFilter.toUpperCase());
                }
                if (searchQuery) {
                    params.append("search", searchQuery);
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
                            modelName?: string;
                            totalTokens?: number;
                            costUsd?: number;
                            evaluation?: Record<string, number>;
                            feedback?: { thumbs?: boolean; rating?: number };
                        }) => ({
                            id: run.id,
                            input: run.inputText,
                            output: run.outputText || "",
                            status: run.status.toLowerCase() as Run["status"],
                            durationMs: run.durationMs || 0,
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: run.totalTokens || 0,
                            estimatedCost: run.costUsd || 0,
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
                        })
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
    }, [agentSlug, statusFilter, searchQuery]);

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
                <Button variant="outline">Export</Button>
            </div>

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
                <Button variant="outline" size="sm">
                    Date Range
                </Button>
                <Button variant="outline" size="sm">
                    More Filters
                </Button>
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
                                    <Button variant="outline" size="sm">
                                        View Full Trace
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        Re-run
                                    </Button>
                                    <Button variant="outline" size="sm">
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
