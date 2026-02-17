"use client";

/**
 * RunDetailPanel - Shared 5-tab run detail panel used by both Live Runs and Triggers pages.
 * Shows Overview, Trace, Tools, Errors, and Latency for a given RunDetail.
 */

import { useMemo, useState } from "react";
import {
    Badge,
    HugeiconsIcon,
    Separator,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    icons
} from "@repo/ui";
import type { RunDetail } from "./run-detail-utils";
import {
    formatLatency,
    formatTokens,
    formatModelLabel,
    resolveToolLabel
} from "./run-detail-utils";

export interface RunDetailPanelProps {
    /** Full run detail data (null when no run loaded) */
    runDetail: RunDetail | null;
    /** Whether run detail is currently loading */
    loading: boolean;
    /** Input text to display (from table row, available before detail loads) */
    inputText?: string;
    /** Output text fallback (from table row, available before detail loads) */
    outputText?: string | null;
    /** Run status (from table row, available before detail loads) */
    status?: string;
    /** Token counts from table row (available before detail loads) */
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    /** Session/thread IDs if available */
    sessionId?: string | null;
    threadId?: string | null;
}

export default function RunDetailPanel({
    runDetail,
    loading,
    inputText,
    outputText,
    status,
    promptTokens,
    completionTokens,
    totalTokens,
    sessionId,
    threadId
}: RunDetailPanelProps) {
    const [detailTab, setDetailTab] = useState("overview");

    const feedbackList = useMemo(() => {
        const feedback = runDetail?.feedback;
        if (!feedback) return [];
        return Array.isArray(feedback) ? feedback : [feedback];
    }, [runDetail]);

    const evaluationScores = useMemo(() => {
        const evaluation = runDetail?.evaluation;
        const evaluationScoresJson = Array.isArray(evaluation)
            ? evaluation[0]?.scoresJson
            : evaluation?.scoresJson;
        const traceScores =
            typeof runDetail?.trace?.scoresJson === "object"
                ? (runDetail?.trace?.scoresJson as Record<string, unknown>)
                : null;
        return evaluationScoresJson || traceScores;
    }, [runDetail]);

    const toolErrors = useMemo(() => {
        return (runDetail?.trace?.toolCalls || []).filter((toolCall) => !toolCall.success);
    }, [runDetail]);

    const guardrailEvents = useMemo(() => {
        return runDetail?.guardrailEvents || [];
    }, [runDetail]);

    const effectiveInput = runDetail?.inputText || inputText || "";
    const effectiveOutput = runDetail?.outputText || outputText || null;
    const effectiveStatus = runDetail?.status || status || "";
    const effectivePromptTokens = runDetail?.promptTokens ?? promptTokens;
    const effectiveCompletionTokens = runDetail?.completionTokens ?? completionTokens;
    const effectiveTotalTokens = runDetail?.totalTokens ?? totalTokens;

    return (
        <Tabs
            defaultValue="overview"
            value={detailTab}
            onValueChange={(value) => setDetailTab(value ?? "overview")}
            className="flex h-full flex-col"
        >
            <TabsList className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto">
                <TabsTrigger value="overview" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons.file!} className="size-4" />
                    Overview
                </TabsTrigger>
                <TabsTrigger value="trace" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons.activity!} className="size-4" />
                    Trace
                </TabsTrigger>
                <TabsTrigger value="tools" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons.settings!} className="size-4" />
                    Tools
                </TabsTrigger>
                <TabsTrigger value="errors" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons["alert-diamond"]!} className="size-4" />
                    Errors
                </TabsTrigger>
                <TabsTrigger value="latency" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons.clock!} className="size-4" />
                    Latency
                </TabsTrigger>
            </TabsList>

            <div className="mt-4 flex-1 overflow-y-auto">
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                ) : (
                    <>
                        {/* ─── Overview Tab ─── */}
                        <TabsContent value="overview" className="mt-0 space-y-6">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="flex flex-col">
                                    <h3 className="mb-2 text-sm font-semibold">User Input</h3>
                                    <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                        <pre className="font-mono text-xs whitespace-pre-wrap">
                                            {effectiveInput}
                                        </pre>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="mb-2 text-sm font-semibold">Agent Response</h3>
                                    <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                        <pre className="font-mono text-xs whitespace-pre-wrap">
                                            {effectiveOutput || "No output"}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            {(sessionId || threadId) && (
                                <div className="grid grid-cols-2 gap-4">
                                    {sessionId && (
                                        <div>
                                            <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                                Session ID
                                            </h3>
                                            <code className="bg-muted rounded px-2 py-1 text-xs">
                                                {sessionId}
                                            </code>
                                        </div>
                                    )}
                                    {threadId && (
                                        <div>
                                            <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                                Thread ID
                                            </h3>
                                            <code className="bg-muted rounded px-2 py-1 text-xs">
                                                {threadId}
                                            </code>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                    Token Breakdown
                                </h3>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <span>
                                        Prompt:{" "}
                                        <strong>{formatTokens(effectivePromptTokens)}</strong>
                                    </span>
                                    <span>
                                        Completion:{" "}
                                        <strong>{formatTokens(effectiveCompletionTokens)}</strong>
                                    </span>
                                    <span>
                                        Total: <strong>{formatTokens(effectiveTotalTokens)}</strong>
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                    System Context
                                </h3>
                                {runDetail?.version ? (
                                    <div className="bg-muted/20 rounded-lg border p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                v{runDetail.version.version}
                                            </Badge>
                                            <Badge variant="outline">
                                                {formatModelLabel(
                                                    runDetail.version.modelName,
                                                    runDetail.version.modelProvider
                                                )}
                                            </Badge>
                                        </div>
                                        <pre className="bg-background mt-3 max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                                            {runDetail.version.instructions}
                                        </pre>
                                        {Array.isArray(runDetail.version.snapshot?.tools) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {(
                                                    runDetail.version.snapshot?.tools as Array<
                                                        string | { toolId?: string }
                                                    >
                                                ).map((tool, idx) => {
                                                    const label =
                                                        typeof tool === "string"
                                                            ? tool
                                                            : tool.toolId || "unknown";
                                                    return (
                                                        <Badge
                                                            key={`${label}-${idx}`}
                                                            variant="outline"
                                                        >
                                                            {label}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No version snapshot available for this run.
                                    </p>
                                )}
                            </div>

                            {evaluationScores && (
                                <div>
                                    <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                        Evaluation Scores
                                    </h3>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {Object.entries(evaluationScores).map(([key, value]) => {
                                            const score =
                                                typeof value === "number"
                                                    ? value
                                                    : typeof value === "object" &&
                                                        value &&
                                                        "score" in value
                                                      ? Number((value as { score: number }).score)
                                                      : 0;
                                            return (
                                                <div
                                                    key={key}
                                                    className="bg-muted/20 rounded-lg border p-3"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">
                                                            {key}
                                                        </span>
                                                        <span className="text-sm font-semibold">
                                                            {(score * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {feedbackList.length > 0 && (
                                <div>
                                    <Separator className="my-4" />
                                    <h3 className="mb-2 text-sm font-semibold">User Feedback</h3>
                                    <div className="space-y-3">
                                        {feedbackList.map((fb) => (
                                            <div
                                                key={fb.id}
                                                className="bg-muted/20 rounded-lg border p-3 text-sm"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {fb.rating !== null && (
                                                        <span>Rating: {fb.rating}</span>
                                                    )}
                                                    {fb.thumbs !== null && (
                                                        <span>
                                                            {fb.thumbs
                                                                ? "Thumbs up"
                                                                : "Thumbs down"}
                                                        </span>
                                                    )}
                                                    <span className="text-muted-foreground text-xs">
                                                        {new Date(fb.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                {fb.comment && <p className="mt-2">{fb.comment}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* ─── Trace Tab ─── */}
                        <TabsContent value="trace" className="mt-0 space-y-4">
                            {(() => {
                                const steps = runDetail?.trace?.steps ?? [];
                                const stepsJson = runDetail?.trace?.stepsJson as unknown[] | null;
                                const hasSteps = steps.length > 0;
                                const hasStepsJson =
                                    Array.isArray(stepsJson) && stepsJson.length > 0;

                                // Fallback: aggregate stepsJson from turns when trace-level steps are empty
                                const turnSteps: unknown[] = [];
                                if (!hasSteps && !hasStepsJson && Array.isArray(runDetail?.turns)) {
                                    for (const turn of runDetail.turns) {
                                        if (Array.isArray(turn.stepsJson)) {
                                            turnSteps.push(...(turn.stepsJson as unknown[]));
                                        }
                                    }
                                }
                                const hasTurnSteps = turnSteps.length > 0;

                                if (hasSteps) {
                                    return (
                                        <div className="space-y-3">
                                            {steps.map((step, idx) => (
                                                <div
                                                    key={step.id}
                                                    className="bg-muted/30 rounded-lg border p-4"
                                                >
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                {idx + 1}
                                                            </span>
                                                            <Badge variant="outline">
                                                                {step.type}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-muted-foreground text-sm">
                                                            {step.durationMs
                                                                ? formatLatency(step.durationMs)
                                                                : "-"}
                                                        </span>
                                                    </div>
                                                    <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                                                        {typeof step.content === "string"
                                                            ? step.content
                                                            : JSON.stringify(step.content, null, 2)}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                }

                                if (hasStepsJson) {
                                    return (
                                        <div className="space-y-3">
                                            {stepsJson.map((step: unknown, idx: number) => {
                                                const s = step as Record<string, unknown>;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="bg-muted/30 rounded-lg border p-4"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                    {idx + 1}
                                                                </span>
                                                                <Badge variant="outline">
                                                                    {String(s.type || "step")}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-muted-foreground text-sm">
                                                                {typeof s.durationMs === "number"
                                                                    ? formatLatency(s.durationMs)
                                                                    : "-"}
                                                            </span>
                                                        </div>
                                                        <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                                                            {JSON.stringify(s, null, 2)}
                                                        </pre>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                if (hasTurnSteps) {
                                    return (
                                        <div className="space-y-3">
                                            {turnSteps.map((step: unknown, idx: number) => {
                                                const s = step as Record<string, unknown>;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="bg-muted/30 rounded-lg border p-4"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                                    {idx + 1}
                                                                </span>
                                                                <Badge variant="outline">
                                                                    {String(s.type || "step")}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-muted-foreground text-sm">
                                                                {typeof s.durationMs === "number"
                                                                    ? formatLatency(s.durationMs)
                                                                    : "-"}
                                                            </span>
                                                        </div>
                                                        <pre className="bg-background max-h-48 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
                                                            {JSON.stringify(s, null, 2)}
                                                        </pre>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                return (
                                    <div className="py-8 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No trace steps available for this run.
                                        </p>
                                    </div>
                                );
                            })()}
                        </TabsContent>

                        {/* ─── Tools Tab ─── */}
                        <TabsContent value="tools" className="mt-0 space-y-4">
                            {runDetail?.trace?.toolCalls && runDetail.trace.toolCalls.length > 0 ? (
                                <div className="space-y-4">
                                    {runDetail.trace.toolCalls.map((toolCall, idx) => (
                                        <div
                                            key={toolCall.id}
                                            className="bg-muted/30 rounded-lg border p-4"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">
                                                                {resolveToolLabel(toolCall)}
                                                            </span>
                                                            {toolCall.mcpServerId && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {toolCall.mcpServerId}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-muted-foreground text-xs">
                                                            {toolCall.success ? (
                                                                <span className="text-green-600">
                                                                    Success
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-600">
                                                                    Failed
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    {toolCall.durationMs
                                                        ? formatLatency(toolCall.durationMs)
                                                        : "-"}
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                        Input
                                                    </h4>
                                                    <pre className="bg-background max-h-32 overflow-auto rounded border p-3 text-xs">
                                                        {JSON.stringify(
                                                            toolCall.inputJson,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                        Output
                                                    </h4>
                                                    {toolCall.success ? (
                                                        <pre className="bg-background max-h-32 overflow-auto rounded border p-3 text-xs">
                                                            {JSON.stringify(
                                                                toolCall.outputJson,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    ) : (
                                                        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
                                                            {toolCall.error || "Unknown error"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-muted-foreground text-sm">
                                        No tool calls for this run.
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        {/* ─── Errors Tab ─── */}
                        <TabsContent value="errors" className="mt-0 space-y-4">
                            {effectiveStatus.toUpperCase() === "FAILED" && (
                                <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10">
                                    <p className="font-semibold">Run failed</p>
                                    <p className="mt-2">
                                        {effectiveOutput || "No error output captured."}
                                    </p>
                                </div>
                            )}

                            {toolErrors.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold">Tool Errors</h3>
                                    <div className="mt-2 space-y-3">
                                        {toolErrors.map((toolCall) => (
                                            <div
                                                key={toolCall.id}
                                                className="bg-muted/20 rounded-lg border p-3 text-sm"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {resolveToolLabel(toolCall)}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {toolCall.durationMs
                                                            ? formatLatency(toolCall.durationMs)
                                                            : "-"}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-xs text-red-600">
                                                    {toolCall.error || "Unknown error"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {guardrailEvents.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold">Guardrail Events</h3>
                                    <div className="mt-2 space-y-3">
                                        {guardrailEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="bg-muted/20 rounded-lg border p-3 text-sm"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {event.guardrailKey}
                                                    </span>
                                                    <Badge variant="outline">{event.type}</Badge>
                                                </div>
                                                <p className="text-muted-foreground mt-2 text-xs">
                                                    {event.reason}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {toolErrors.length === 0 &&
                                guardrailEvents.length === 0 &&
                                effectiveStatus.toUpperCase() !== "FAILED" && (
                                    <p className="text-muted-foreground text-sm">
                                        No errors, retries, or guardrail events recorded for this
                                        run.
                                    </p>
                                )}
                        </TabsContent>

                        {/* ─── Latency Tab ─── */}
                        <TabsContent value="latency" className="mt-0 space-y-4">
                            {(() => {
                                const steps = runDetail?.trace?.steps ?? [];
                                const stepsJson = runDetail?.trace?.stepsJson as unknown[] | null;
                                const rawSteps =
                                    steps.length > 0
                                        ? steps
                                        : Array.isArray(stepsJson)
                                          ? stepsJson
                                          : [];

                                if (rawSteps.length === 0) {
                                    return (
                                        <p className="text-muted-foreground text-sm">
                                            No latency data available for this run.
                                        </p>
                                    );
                                }

                                const normalizedSteps = rawSteps.map((step, idx) => {
                                    if (typeof step === "object" && step) {
                                        const s = step as Record<string, unknown>;
                                        return {
                                            number: Number(s.stepNumber ?? s.step ?? idx + 1),
                                            type: String(s.type || "step"),
                                            durationMs:
                                                typeof s.durationMs === "number"
                                                    ? s.durationMs
                                                    : null,
                                            content: s.content ?? s
                                        };
                                    }
                                    return {
                                        number: idx + 1,
                                        type: "step",
                                        durationMs: null,
                                        content: step
                                    };
                                });

                                return (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>#</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">
                                                    Duration
                                                </TableHead>
                                                <TableHead>Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {normalizedSteps.map((step) => (
                                                <TableRow key={`${step.type}-${step.number}`}>
                                                    <TableCell>{step.number}</TableCell>
                                                    <TableCell>{step.type}</TableCell>
                                                    <TableCell className="text-right">
                                                        {step.durationMs
                                                            ? formatLatency(step.durationMs)
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <pre className="bg-muted/20 max-h-24 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                                                            {typeof step.content === "string"
                                                                ? step.content
                                                                : JSON.stringify(
                                                                      step.content,
                                                                      null,
                                                                      2
                                                                  )}
                                                        </pre>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                );
                            })()}
                        </TabsContent>
                    </>
                )}
            </div>
        </Tabs>
    );
}
