"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface EvaluationResult {
    id: string;
    runId: string;
    input: string;
    output: string;
    scores: Record<string, number>;
    feedback?: {
        thumbs: "up" | "down";
        comment?: string;
    };
    timestamp: string;
    // New AI auditor fields
    overallGrade?: number | null;
    narrative?: string | null;
    evaluationTier?: string | null;
    confidenceScore?: number | null;
    feedbackJson?: Record<string, { score: number; reasoning: string }> | null;
    auditorModel?: string | null;
    groundTruthUsed?: boolean;
    skillAttributions?: Array<{ skillName: string; impact: string; suggestion: string }> | null;
}

interface EvaluationSummary {
    total: number;
    avgScores: Array<{
        scorer: string;
        avg: number;
        min: number;
        max: number;
        count: number;
    }>;
}

interface FeedbackTheme {
    theme: string;
    count: number;
    sentiment: string;
}

interface Insight {
    id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
}

interface TrendData {
    scorer: string;
    data: Array<{ date: string; score: number }>;
}

export default function EvaluationsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
    const [summary, setSummary] = useState<EvaluationSummary | null>(null);
    const [themes, setThemes] = useState<FeedbackTheme[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [activeTab, setActiveTab] = useState("scorers");
    const [runningEvals, setRunningEvals] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [sourceFilter, setSourceFilter] = useState<"all" | "production" | "simulation">("all");

    const fetchEvaluations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/evaluations?source=${sourceFilter}`
            );
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch evaluations");
            }

            // Transform API response to match our interface
            const transformedEvals: EvaluationResult[] = result.evaluations.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (eval_: any) => ({
                    id: eval_.id,
                    runId: eval_.runId,
                    input: eval_.run?.inputPreview || "",
                    output: eval_.run?.outputPreview || "",
                    scores: eval_.scoresJson || {},
                    timestamp: eval_.createdAt,
                    // AI auditor fields
                    overallGrade: eval_.overallGrade,
                    narrative: eval_.narrative,
                    evaluationTier: eval_.evaluationTier,
                    confidenceScore: eval_.confidenceScore,
                    feedbackJson: eval_.feedbackJson,
                    auditorModel: eval_.auditorModel,
                    groundTruthUsed: eval_.groundTruthUsed,
                    skillAttributions: eval_.skillAttributions
                })
            );

            setEvaluations(transformedEvals);
            setSummary(result.summary);
            setThemes(result.themes || []);
            setInsights(result.insights || []);
            setTrends(result.trends || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load evaluations");
        } finally {
            setLoading(false);
        }
    }, [agentSlug, sourceFilter]);

    useEffect(() => {
        fetchEvaluations();
    }, [fetchEvaluations]);

    const runEvaluations = useCallback(async () => {
        try {
            setRunningEvals(true);
            setStatusMessage(null);
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/evaluations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 20 })
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to run evaluations");
            }

            if (result.evaluated === 0) {
                setStatusMessage({
                    type: "success",
                    message: "No runs to evaluate. All completed runs have already been evaluated."
                });
            } else {
                setStatusMessage({
                    type: "success",
                    message: `Successfully evaluated ${result.evaluated} run(s).${result.failed > 0 ? ` ${result.failed} failed.` : ""}`
                });
                // Refresh the evaluations list
                fetchEvaluations();
            }
        } catch (err) {
            setStatusMessage({
                type: "error",
                message: err instanceof Error ? err.message : "Failed to run evaluations"
            });
        } finally {
            setRunningEvals(false);
            // Auto-clear success messages after 5 seconds
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, [agentSlug, fetchEvaluations]);

    const exportReport = useCallback(() => {
        try {
            setExporting(true);
            setStatusMessage(null);

            // Build CSV content
            const headers = [
                "ID",
                "Run ID",
                "Input",
                "Output",
                ...Object.keys(evaluations[0]?.scores || {}),
                "Feedback",
                "Timestamp"
            ];

            const rows = evaluations.map((eval_) => {
                const scoreValues = Object.keys(evaluations[0]?.scores || {}).map(
                    (key) => ((eval_.scores[key] || 0) * 100).toFixed(1) + "%"
                );
                return [
                    eval_.id,
                    eval_.runId,
                    `"${(eval_.input || "").replace(/"/g, '""')}"`,
                    `"${(eval_.output || "").replace(/"/g, '""')}"`,
                    ...scoreValues,
                    eval_.feedback?.thumbs || "-",
                    new Date(eval_.timestamp).toISOString()
                ];
            });

            const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

            // Create and download file
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `${agentSlug}-evaluations-${new Date().toISOString().split("T")[0]}.csv`
            );
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setStatusMessage({
                type: "success",
                message: `Exported ${evaluations.length} evaluation(s) to CSV.`
            });
        } catch (err) {
            setStatusMessage({
                type: "error",
                message: err instanceof Error ? err.message : "Failed to export report"
            });
        } finally {
            setExporting(false);
            // Auto-clear success messages after 5 seconds
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, [agentSlug, evaluations]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Evaluation Center</h1>
                    <p className="text-muted-foreground">
                        Quality metrics, feedback analysis, and improvement insights
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchEvaluations}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Calculate aggregates from API summary or from evaluations
    const avgScores: Record<string, number> = {};
    if (summary?.avgScores) {
        for (const scorer of summary.avgScores) {
            avgScores[scorer.scorer] = scorer.avg;
        }
    } else if (evaluations.length > 0) {
        // Fallback: calculate from evaluations
        const scoreTotals: Record<string, { sum: number; count: number }> = {};
        for (const eval_ of evaluations) {
            for (const [key, value] of Object.entries(eval_.scores)) {
                if (!scoreTotals[key]) scoreTotals[key] = { sum: 0, count: 0 };
                scoreTotals[key].sum += value;
                scoreTotals[key].count += 1;
            }
        }
        for (const [key, data] of Object.entries(scoreTotals)) {
            avgScores[key] = data.sum / data.count;
        }
    }

    const feedbackStats = {
        total: evaluations.filter((e) => e.feedback).length,
        positive: evaluations.filter((e) => e.feedback?.thumbs === "up").length,
        negative: evaluations.filter((e) => e.feedback?.thumbs === "down").length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Evaluation Center</h1>
                    <p className="text-muted-foreground">
                        Quality metrics, feedback analysis, and improvement insights
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {statusMessage && (
                        <span
                            className={`text-sm ${statusMessage.type === "error" ? "text-destructive" : "text-green-600"}`}
                        >
                            {statusMessage.message}
                        </span>
                    )}
                    <Select
                        value={sourceFilter}
                        onValueChange={(value) =>
                            setSourceFilter(value as "all" | "production" | "simulation")
                        }
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="simulation">Simulation</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={runEvaluations} disabled={runningEvals}>
                        {runningEvals ? "Running..." : "Run Evaluation"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={exportReport}
                        disabled={exporting || evaluations.length === 0}
                    >
                        {exporting ? "Exporting..." : "Export Report"}
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {Object.entries(avgScores).map(([key, value]) => (
                    <Card key={key}>
                        <CardHeader className="pb-2">
                            <CardDescription className="capitalize">{key}</CardDescription>
                            <CardTitle className="text-2xl">{(value * 100).toFixed(0)}%</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                                <div
                                    className="bg-primary h-full"
                                    style={{ width: `${value * 100}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs
                defaultValue="overview"
                value={activeTab}
                onValueChange={(v) => v && setActiveTab(v)}
            >
                <TabsList>
                    <TabsTrigger value="scorers">Scorer Results</TabsTrigger>
                    <TabsTrigger value="auditor">Auditor Reports</TabsTrigger>
                    <TabsTrigger value="feedback">User Feedback</TabsTrigger>
                    <TabsTrigger value="insights">AI Insights</TabsTrigger>
                    <TabsTrigger value="history">Evaluation History</TabsTrigger>
                </TabsList>

                {/* Scorer Results Tab */}
                <TabsContent value="scorers" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Score Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Score Distribution</CardTitle>
                                <CardDescription>Breakdown by score ranges</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {Object.entries(avgScores).map(([key, value]) => (
                                    <div key={key} className="mb-4">
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-sm capitalize">{key}</span>
                                            <span className="text-sm font-medium">
                                                {(value * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="flex h-8 gap-1">
                                            <div
                                                className="rounded bg-red-500/80"
                                                style={{ width: "5%" }}
                                                title="0-60%"
                                            />
                                            <div
                                                className="rounded bg-yellow-500/80"
                                                style={{ width: "15%" }}
                                                title="60-80%"
                                            />
                                            <div
                                                className="rounded bg-green-500/80"
                                                style={{ width: `${value * 80}%` }}
                                                title="80-100%"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Trends */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Score Trends</CardTitle>
                                <CardDescription>Performance over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {trends.length > 0 ? (
                                    <>
                                        {trends.map((trend) => (
                                            <div key={trend.scorer} className="mb-4">
                                                <p className="text-muted-foreground mb-2 text-sm capitalize">
                                                    {trend.scorer}
                                                </p>
                                                <div className="flex h-[120px] items-end gap-1">
                                                    {trend.data.map((d, i) => (
                                                        <div
                                                            key={i}
                                                            className="bg-primary flex-1 rounded-t opacity-80"
                                                            style={{
                                                                height: `${(d.score * 100).toFixed(0)}%`
                                                            }}
                                                            title={`${d.date}: ${(d.score * 100).toFixed(0)}%`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                            <span>14 days ago</span>
                                            <span>Today</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-[200px] items-center justify-center">
                                        <p className="text-muted-foreground text-sm">
                                            No trend data available yet
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Low-scoring runs */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Low-Scoring Runs</CardTitle>
                            <CardDescription>
                                Runs that need attention (avg score &lt; 80%)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {evaluations
                                    .filter((e) => {
                                        const scoreValues = Object.values(e.scores);
                                        const avg =
                                            scoreValues.length > 0
                                                ? scoreValues.reduce((a, b) => a + b, 0) /
                                                  scoreValues.length
                                                : 1;
                                        return avg < 0.8;
                                    })
                                    .slice(0, 5)
                                    .map((eval_) => {
                                        const scoreValues = Object.values(eval_.scores);
                                        const avg =
                                            scoreValues.length > 0
                                                ? scoreValues.reduce((a, b) => a + b, 0) /
                                                  scoreValues.length
                                                : 0;
                                        return (
                                            <div
                                                key={eval_.id}
                                                className="flex items-center gap-4 rounded-lg border p-3"
                                            >
                                                <Badge variant="destructive">
                                                    {(avg * 100).toFixed(0)}%
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm">
                                                        {eval_.input}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {new Date(eval_.timestamp).toLocaleString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.push(
                                                            `/agents/${agentSlug}/runs?run=${eval_.runId}`
                                                        )
                                                    }
                                                >
                                                    View
                                                </Button>
                                            </div>
                                        );
                                    })}
                                {evaluations.filter((e) => {
                                    const scoreValues = Object.values(e.scores);
                                    const avg =
                                        scoreValues.length > 0
                                            ? scoreValues.reduce((a, b) => a + b, 0) /
                                              scoreValues.length
                                            : 1;
                                    return avg < 0.8;
                                }).length === 0 && (
                                    <p className="text-muted-foreground py-4 text-center text-sm">
                                        No low-scoring runs found
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Auditor Reports Tab */}
                <TabsContent value="auditor" className="space-y-6">
                    {(() => {
                        const tier2Evals = evaluations.filter(
                            (e) => e.evaluationTier === "tier2_auditor"
                        );
                        const tier1Count = evaluations.filter(
                            (e) => e.evaluationTier === "tier1_heuristic"
                        ).length;
                        const avgGrade =
                            tier2Evals.length > 0
                                ? tier2Evals.reduce((s, e) => s + (e.overallGrade || 0), 0) /
                                  tier2Evals.length
                                : 0;

                        return (
                            <>
                                {/* Tier overview cards */}
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Tier 2 Reports</CardDescription>
                                            <CardTitle className="text-2xl">
                                                {tier2Evals.length}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground text-xs">
                                                Full AI auditor evaluations
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Tier 1 Pre-screens</CardDescription>
                                            <CardTitle className="text-2xl">{tier1Count}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground text-xs">
                                                Heuristic-only evaluations
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Avg Overall Grade</CardDescription>
                                            <CardTitle className="text-2xl">
                                                {tier2Evals.length > 0
                                                    ? `${(avgGrade * 100).toFixed(0)}%`
                                                    : "N/A"}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                                                <div
                                                    className="bg-primary h-full"
                                                    style={{
                                                        width: `${avgGrade * 100}%`
                                                    }}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>Ground Truth Used</CardDescription>
                                            <CardTitle className="text-2xl">
                                                {tier2Evals.filter((e) => e.groundTruthUsed).length}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground text-xs">
                                                Compared to expected output
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Per-criterion breakdown */}
                                {tier2Evals.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Per-Criterion Scores</CardTitle>
                                            <CardDescription>
                                                Average scores across all audited runs by scorecard
                                                criterion
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {(() => {
                                                const criterionTotals: Record<
                                                    string,
                                                    { sum: number; count: number }
                                                > = {};
                                                for (const e of tier2Evals) {
                                                    if (e.feedbackJson) {
                                                        for (const [key, val] of Object.entries(
                                                            e.feedbackJson
                                                        )) {
                                                            if (!criterionTotals[key])
                                                                criterionTotals[key] = {
                                                                    sum: 0,
                                                                    count: 0
                                                                };
                                                            criterionTotals[key].sum += val.score;
                                                            criterionTotals[key].count++;
                                                        }
                                                    }
                                                }
                                                const entries = Object.entries(criterionTotals)
                                                    .map(([key, data]) => ({
                                                        criterion: key,
                                                        avg: data.sum / data.count,
                                                        count: data.count
                                                    }))
                                                    .sort((a, b) => a.avg - b.avg);

                                                return (
                                                    <div className="space-y-3">
                                                        {entries.map((e) => (
                                                            <div
                                                                key={e.criterion}
                                                                className="space-y-1"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm">
                                                                        {e.criterion.replace(
                                                                            /_/g,
                                                                            " "
                                                                        )}
                                                                    </span>
                                                                    <span className="text-sm font-medium">
                                                                        {(e.avg * 100).toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                                <div className="bg-muted h-2 overflow-hidden rounded-full">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            e.avg >= 0.8
                                                                                ? "bg-green-500"
                                                                                : e.avg >= 0.6
                                                                                  ? "bg-yellow-500"
                                                                                  : "bg-red-500"
                                                                        }`}
                                                                        style={{
                                                                            width: `${e.avg * 100}%`
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {entries.length === 0 && (
                                                            <p className="text-muted-foreground py-4 text-center text-sm">
                                                                No per-criterion data available
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Auditor Narratives */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Auditor Narratives</CardTitle>
                                        <CardDescription>
                                            Written feedback from the AI auditor for each evaluated
                                            run
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {tier2Evals.length > 0 ? (
                                            <div className="space-y-4">
                                                {tier2Evals.slice(0, 10).map((eval_) => (
                                                    <div
                                                        key={eval_.id}
                                                        className="rounded-lg border p-4"
                                                    >
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <Badge
                                                                variant={
                                                                    (eval_.overallGrade || 0) >= 0.8
                                                                        ? "default"
                                                                        : (eval_.overallGrade ||
                                                                                0) >= 0.6
                                                                          ? "secondary"
                                                                          : "destructive"
                                                                }
                                                            >
                                                                {(
                                                                    (eval_.overallGrade || 0) * 100
                                                                ).toFixed(0)}
                                                                %
                                                            </Badge>
                                                            {eval_.confidenceScore && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    Confidence:{" "}
                                                                    {(
                                                                        eval_.confidenceScore * 100
                                                                    ).toFixed(0)}
                                                                    %
                                                                </Badge>
                                                            )}
                                                            {eval_.groundTruthUsed && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    Ground Truth
                                                                </Badge>
                                                            )}
                                                            <span className="text-muted-foreground ml-auto text-xs">
                                                                {new Date(
                                                                    eval_.timestamp
                                                                ).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <p className="mb-2 text-sm">
                                                            <span className="text-muted-foreground">
                                                                Input:{" "}
                                                            </span>
                                                            {eval_.input || "(no input)"}
                                                        </p>
                                                        {eval_.narrative && (
                                                            <div className="bg-muted/50 mt-2 rounded p-3">
                                                                <p className="text-sm whitespace-pre-line">
                                                                    {eval_.narrative}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {/* Per-criterion breakdown for this eval */}
                                                        {eval_.feedbackJson && (
                                                            <div className="mt-3 space-y-1">
                                                                {Object.entries(
                                                                    eval_.feedbackJson
                                                                ).map(([key, val]) => (
                                                                    <div
                                                                        key={key}
                                                                        className="flex items-center gap-2 text-xs"
                                                                    >
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`text-xs ${
                                                                                val.score >= 0.8
                                                                                    ? "text-green-600"
                                                                                    : val.score >=
                                                                                        0.6
                                                                                      ? "text-yellow-600"
                                                                                      : "text-red-600"
                                                                            }`}
                                                                        >
                                                                            {key.replace(/_/g, " ")}
                                                                            :{" "}
                                                                            {(
                                                                                val.score * 100
                                                                            ).toFixed(0)}
                                                                            %
                                                                        </Badge>
                                                                        <span className="text-muted-foreground flex-1 truncate">
                                                                            {val.reasoning}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Skill attributions */}
                                                        {eval_.skillAttributions &&
                                                            eval_.skillAttributions.length > 0 && (
                                                                <div className="mt-3 border-t pt-2">
                                                                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                                                                        Skill Impact:
                                                                    </p>
                                                                    {eval_.skillAttributions.map(
                                                                        (sa, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="text-xs"
                                                                            >
                                                                                <span className="font-medium">
                                                                                    {sa.skillName}
                                                                                </span>
                                                                                {" — "}
                                                                                <span
                                                                                    className={
                                                                                        sa.impact ===
                                                                                        "negative"
                                                                                            ? "text-red-600"
                                                                                            : sa.impact ===
                                                                                                "positive"
                                                                                              ? "text-green-600"
                                                                                              : ""
                                                                                    }
                                                                                >
                                                                                    {sa.impact}
                                                                                </span>
                                                                                {sa.suggestion && (
                                                                                    <span className="text-muted-foreground">
                                                                                        {" "}
                                                                                        (
                                                                                        {
                                                                                            sa.suggestion
                                                                                        }
                                                                                        )
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <p className="text-muted-foreground mb-2 text-sm">
                                                    No AI auditor reports yet
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    Configure a scorecard and run evaluations to see
                                                    detailed auditor reports
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        );
                    })()}
                </TabsContent>

                {/* User Feedback Tab */}
                <TabsContent value="feedback" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Feedback Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Feedback Summary</CardTitle>
                                <CardDescription>
                                    {feedbackStats.total} responses with feedback
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 text-center">
                                    <p className="text-5xl font-bold">
                                        👍{" "}
                                        {feedbackStats.total > 0
                                            ? (
                                                  (feedbackStats.positive / feedbackStats.total) *
                                                  100
                                              ).toFixed(0)
                                            : 0}
                                        %
                                    </p>
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        Positive feedback ratio
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-lg bg-green-500/10 p-4 text-center">
                                        <p className="text-2xl font-bold text-green-600">
                                            {feedbackStats.positive}
                                        </p>
                                        <p className="text-muted-foreground text-sm">Thumbs up</p>
                                    </div>
                                    <div className="rounded-lg bg-red-500/10 p-4 text-center">
                                        <p className="text-2xl font-bold text-red-600">
                                            {feedbackStats.negative}
                                        </p>
                                        <p className="text-muted-foreground text-sm">Thumbs down</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Feedback Themes */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Common Themes</CardTitle>
                                <CardDescription>
                                    AI-identified patterns in feedback
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {themes.length > 0 ? (
                                    <div className="space-y-3">
                                        {themes.map((theme) => (
                                            <div
                                                key={theme.theme}
                                                className="flex items-center gap-3"
                                            >
                                                <span
                                                    className={`h-2 w-2 rounded-full ${
                                                        theme.sentiment === "positive"
                                                            ? "bg-green-500"
                                                            : theme.sentiment === "negative"
                                                              ? "bg-red-500"
                                                              : "bg-gray-500"
                                                    }`}
                                                />
                                                <span className="flex-1 text-sm">
                                                    {theme.theme}
                                                </span>
                                                <Badge variant="outline">{theme.count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground py-4 text-center text-sm">
                                        No feedback themes identified yet
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Feedback */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Feedback</CardTitle>
                            <CardDescription>Latest user responses</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {evaluations
                                    .filter((e) => e.feedback)
                                    .slice(0, 5)
                                    .map((eval_) => (
                                        <div
                                            key={eval_.id}
                                            className="flex items-start gap-4 rounded-lg border p-3"
                                        >
                                            <span className="text-xl">
                                                {eval_.feedback?.thumbs === "up" ? "👍" : "👎"}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-sm">{eval_.input}</p>
                                                {eval_.feedback?.comment && (
                                                    <p className="text-muted-foreground mt-1 text-sm italic">
                                                        &ldquo;{eval_.feedback.comment}&rdquo;
                                                    </p>
                                                )}
                                                <p className="text-muted-foreground mt-2 text-xs">
                                                    {new Date(eval_.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* AI Insights Tab */}
                <TabsContent value="insights">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI-Generated Insights</CardTitle>
                            <CardDescription>
                                Automated analysis and recommendations
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {insights.length > 0 ? (
                                <div className="space-y-6">
                                    {insights.map((insight) => {
                                        // Map insight type to visual style
                                        const typeStyles: Record<
                                            string,
                                            { border: string; bg: string; icon: string }
                                        > = {
                                            performance: {
                                                border: "border-green-500/20",
                                                bg: "bg-green-500/5",
                                                icon: "✓"
                                            },
                                            quality: {
                                                border: "border-green-500/20",
                                                bg: "bg-green-500/5",
                                                icon: "✓"
                                            },
                                            cost: {
                                                border: "border-yellow-500/20",
                                                bg: "bg-yellow-500/5",
                                                icon: "⚠"
                                            },
                                            warning: {
                                                border: "border-yellow-500/20",
                                                bg: "bg-yellow-500/5",
                                                icon: "⚠"
                                            },
                                            info: {
                                                border: "border-blue-500/20",
                                                bg: "bg-blue-500/5",
                                                icon: "💡"
                                            }
                                        };
                                        const style = typeStyles[insight.type] || typeStyles.info;

                                        return (
                                            <div
                                                key={insight.id}
                                                className={`rounded-lg border p-4 ${style.border} ${style.bg}`}
                                            >
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span>{style.icon}</span>
                                                    <span className="font-medium">
                                                        {insight.title}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    {insight.description}
                                                </p>
                                                <p className="text-muted-foreground mt-2 text-xs">
                                                    {new Date(
                                                        insight.createdAt
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-muted-foreground mb-2 text-sm">
                                        No AI-generated insights available yet
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Insights are generated as evaluation data accumulates
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Evaluation History</CardTitle>
                            <CardDescription>All evaluated runs</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {evaluations.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No evaluations found
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="px-4 py-3 text-left font-medium">
                                                    Input
                                                </th>
                                                <th className="px-4 py-3 text-center font-medium">
                                                    Tier
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Grade
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Scores
                                                </th>
                                                <th className="px-4 py-3 text-center font-medium">
                                                    Feedback
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Time
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {evaluations.slice(0, 10).map((eval_) => {
                                                const grade =
                                                    eval_.overallGrade ??
                                                    (() => {
                                                        const scoreValues = Object.values(
                                                            eval_.scores
                                                        );
                                                        return scoreValues.length > 0
                                                            ? scoreValues.reduce(
                                                                  (a, b) => a + b,
                                                                  0
                                                              ) / scoreValues.length
                                                            : 0;
                                                    })();
                                                return (
                                                    <tr
                                                        key={eval_.id}
                                                        className="hover:bg-muted/50 border-b"
                                                    >
                                                        <td className="max-w-xs truncate px-4 py-3">
                                                            {eval_.input || "-"}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                {eval_.evaluationTier ===
                                                                "tier2_auditor"
                                                                    ? "Tier 2"
                                                                    : eval_.evaluationTier ===
                                                                        "tier1_heuristic"
                                                                      ? "Tier 1"
                                                                      : "Legacy"}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">
                                                            {(grade * 100).toFixed(0)}%
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex flex-wrap justify-end gap-1">
                                                                {Object.entries(eval_.scores)
                                                                    .slice(0, 3)
                                                                    .map(([key, value]) => (
                                                                        <Badge
                                                                            key={key}
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {key}:{" "}
                                                                            {(value * 100).toFixed(
                                                                                0
                                                                            )}
                                                                            %
                                                                        </Badge>
                                                                    ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {eval_.feedback
                                                                ? eval_.feedback.thumbs === "up"
                                                                    ? "👍"
                                                                    : "👎"
                                                                : "-"}
                                                        </td>
                                                        <td className="text-muted-foreground px-4 py-3 text-right text-sm">
                                                            {new Date(
                                                                eval_.timestamp
                                                            ).toLocaleTimeString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
