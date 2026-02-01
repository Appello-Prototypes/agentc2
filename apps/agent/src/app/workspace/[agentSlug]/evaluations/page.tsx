"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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
    TabsTrigger
} from "@repo/ui";

interface EvaluationResult {
    id: string;
    runId: string;
    input: string;
    output: string;
    scores: {
        helpfulness: number;
        relevancy: number;
        completeness: number;
        tone: number;
    };
    feedback?: {
        thumbs: "up" | "down";
        comment?: string;
    };
    timestamp: string;
}

// Mock data
const mockEvaluations: EvaluationResult[] = Array.from({ length: 20 }, (_, i) => ({
    id: `eval-${i + 1}`,
    runId: `run-${i + 1}`,
    input: `Test query ${i + 1}: What is the meaning of life?`,
    output: `This is a sample response for evaluation ${i + 1}...`,
    scores: {
        helpfulness: 0.7 + Math.random() * 0.3,
        relevancy: 0.75 + Math.random() * 0.25,
        completeness: 0.65 + Math.random() * 0.35,
        tone: 0.85 + Math.random() * 0.15
    },
    feedback:
        Math.random() > 0.7
            ? {
                  thumbs: Math.random() > 0.2 ? "up" : "down",
                  comment: Math.random() > 0.5 ? "Good response" : undefined
              }
            : undefined,
    timestamp: new Date(Date.now() - i * 1000 * 60 * 30).toISOString()
}));

const feedbackThemes = [
    { theme: "Accurate information", count: 45, sentiment: "positive" },
    { theme: "Too verbose", count: 23, sentiment: "negative" },
    { theme: "Helpful examples", count: 38, sentiment: "positive" },
    { theme: "Missing context", count: 15, sentiment: "negative" },
    { theme: "Clear explanations", count: 52, sentiment: "positive" }
];

export default function EvaluationsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
    const [activeTab, setActiveTab] = useState("scorers");

    useEffect(() => {
        setTimeout(() => {
            setEvaluations(mockEvaluations);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    // Calculate aggregates
    const avgScores = {
        helpfulness:
            evaluations.reduce((sum, e) => sum + e.scores.helpfulness, 0) / evaluations.length,
        relevancy: evaluations.reduce((sum, e) => sum + e.scores.relevancy, 0) / evaluations.length,
        completeness:
            evaluations.reduce((sum, e) => sum + e.scores.completeness, 0) / evaluations.length,
        tone: evaluations.reduce((sum, e) => sum + e.scores.tone, 0) / evaluations.length
    };

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
                <div className="flex gap-2">
                    <Button variant="outline">Run Evaluation</Button>
                    <Button variant="outline">Export Report</Button>
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
                                <div className="flex h-[200px] items-end gap-1">
                                    {[85, 87, 84, 88, 91, 89, 92, 90, 93, 91, 94, 92, 95, 93].map(
                                        (v, i) => (
                                            <div
                                                key={i}
                                                className="bg-primary flex-1 rounded-t opacity-80"
                                                style={{ height: `${v}%` }}
                                                title={`${v}%`}
                                            />
                                        )
                                    )}
                                </div>
                                <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                    <span>14 days ago</span>
                                    <span>Today</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Low-scoring runs */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Low-Scoring Runs</CardTitle>
                            <CardDescription>
                                Runs that need attention (score &lt; 80%)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {evaluations
                                    .filter((e) => e.scores.helpfulness < 0.8)
                                    .slice(0, 5)
                                    .map((eval_) => (
                                        <div
                                            key={eval_.id}
                                            className="flex items-center gap-4 rounded-lg border p-3"
                                        >
                                            <Badge variant="destructive">
                                                {(eval_.scores.helpfulness * 100).toFixed(0)}%
                                            </Badge>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm">{eval_.input}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {new Date(eval_.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                View
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
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
                                <div className="space-y-3">
                                    {feedbackThemes.map((theme) => (
                                        <div key={theme.theme} className="flex items-center gap-3">
                                            <span
                                                className={`h-2 w-2 rounded-full ${
                                                    theme.sentiment === "positive"
                                                        ? "bg-green-500"
                                                        : "bg-red-500"
                                                }`}
                                            />
                                            <span className="flex-1 text-sm">{theme.theme}</span>
                                            <Badge variant="outline">{theme.count}</Badge>
                                        </div>
                                    ))}
                                </div>
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
                            <div className="space-y-6">
                                {[
                                    {
                                        type: "success",
                                        title: "Strong Performance on Factual Queries",
                                        description:
                                            "The agent scores 94% on relevancy for factual questions. This is likely due to the comprehensive web-search tool integration."
                                    },
                                    {
                                        type: "warning",
                                        title: "Completeness Score Dropping",
                                        description:
                                            "Completeness scores have decreased 8% this week. Consider reviewing recent instruction changes or increasing max tokens."
                                    },
                                    {
                                        type: "info",
                                        title: "Optimization Opportunity",
                                        description:
                                            "23% of negative feedback mentions 'too verbose'. Consider adding conciseness guidelines to the system instructions."
                                    },
                                    {
                                        type: "success",
                                        title: "Improved Tone Consistency",
                                        description:
                                            "Tone scores have increased 5% since v4, correlating with the updated personality guidelines."
                                    }
                                ].map((insight, i) => (
                                    <div
                                        key={i}
                                        className={`rounded-lg border p-4 ${
                                            insight.type === "success"
                                                ? "border-green-500/20 bg-green-500/5"
                                                : insight.type === "warning"
                                                  ? "border-yellow-500/20 bg-yellow-500/5"
                                                  : "border-blue-500/20 bg-blue-500/5"
                                        }`}
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <span>
                                                {insight.type === "success"
                                                    ? "✓"
                                                    : insight.type === "warning"
                                                      ? "⚠"
                                                      : "💡"}
                                            </span>
                                            <span className="font-medium">{insight.title}</span>
                                        </div>
                                        <p className="text-muted-foreground text-sm">
                                            {insight.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
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
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                Input
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Helpfulness
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Relevancy
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Completeness
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Tone
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
                                        {evaluations.slice(0, 10).map((eval_) => (
                                            <tr
                                                key={eval_.id}
                                                className="hover:bg-muted/50 border-b"
                                            >
                                                <td className="max-w-xs truncate px-4 py-3">
                                                    {eval_.input}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {(eval_.scores.helpfulness * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {(eval_.scores.relevancy * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {(eval_.scores.completeness * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {(eval_.scores.tone * 100).toFixed(0)}%
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {eval_.feedback
                                                        ? eval_.feedback.thumbs === "up"
                                                            ? "👍"
                                                            : "👎"
                                                        : "-"}
                                                </td>
                                                <td className="text-muted-foreground px-4 py-3 text-right text-sm">
                                                    {new Date(eval_.timestamp).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
