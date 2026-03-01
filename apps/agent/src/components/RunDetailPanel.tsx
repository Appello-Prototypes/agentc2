"use client";

/**
 * RunDetailPanel - Type-aware run detail panel for Agent, Workflow, and Network runs.
 * Agent runs: Overview, Trace, Tools, Errors, Latency tabs (with SSE streaming)
 * Workflow/Network runs: Overview, Steps, Evaluation, Feedback tabs (with polling)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Badge,
    HugeiconsIcon,
    Separator,
    Skeleton,
    Stepper,
    StepItem,
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
import type { StepStatus } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import type { RunDetail, WorkflowStep, NetworkStep } from "./run-detail-utils";
import {
    formatLatency,
    formatTokens,
    formatModelLabel,
    formatCost,
    resolveToolLabel,
    getStatusBadgeVariant
} from "./run-detail-utils";

// ─── SSE Types ──────────────────────────────────────────────────────────────

interface StreamTraceStep {
    index: number;
    type: string;
    content: unknown;
    durationMs?: number;
}

interface StreamToolCall {
    id: string;
    toolKey: string;
    status: "started" | "completed" | "failed";
    inputJson?: unknown;
    outputJson?: unknown;
    error?: string;
    durationMs?: number;
}

// ─── Live stream hook (agent only) ──────────────────────────────────────────

function useRunStream(
    agentSlug: string | undefined,
    runId: string | undefined,
    status: string | undefined,
    kind: string
) {
    const [liveSteps, setLiveSteps] = useState<StreamTraceStep[]>([]);
    const [liveToolCalls, setLiveToolCalls] = useState<StreamToolCall[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [liveStatus, setLiveStatus] = useState<string | undefined>(undefined);
    const eventSourceRef = useRef<EventSource | null>(null);

    const isRunning = status?.toUpperCase() === "RUNNING" || status?.toUpperCase() === "QUEUED";

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    useEffect(() => {
        if (kind !== "agent" || !isRunning || !agentSlug || !runId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset streaming state when run stops
            disconnect();
            return;
        }

        const url = `${getApiBase()}/api/agents/${agentSlug}/runs/${runId}/stream`;
        const es = new EventSource(url);
        eventSourceRef.current = es;
        setIsStreaming(true);
        setLiveSteps([]);
        setLiveToolCalls([]);
        setLiveStatus(undefined);

        es.addEventListener("trace_step", (e) => {
            try {
                const step = JSON.parse(e.data) as StreamTraceStep;
                setLiveSteps((prev) => [...prev, step]);
            } catch {
                /* ignore parse errors */
            }
        });

        es.addEventListener("tool_call", (e) => {
            try {
                const tc = JSON.parse(e.data) as StreamToolCall;
                setLiveToolCalls((prev) => {
                    const idx = prev.findIndex((t) => t.id === tc.id);
                    if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = tc;
                        return next;
                    }
                    return [...prev, tc];
                });
            } catch {
                /* ignore parse errors */
            }
        });

        es.addEventListener("status_change", (e) => {
            try {
                const data = JSON.parse(e.data) as { status: string };
                setLiveStatus(data.status);
            } catch {
                /* ignore parse errors */
            }
        });

        es.addEventListener("complete", () => {
            disconnect();
        });

        es.onerror = () => {
            disconnect();
        };

        return () => {
            disconnect();
        };
    }, [kind, isRunning, agentSlug, runId, disconnect]);

    return { liveSteps, liveToolCalls, isStreaming, liveStatus };
}

// ─── Polling hook (workflow/network) ────────────────────────────────────────

function useRunPolling(kind: string, status: string | undefined, onRefresh?: () => void) {
    const [isPolling, setIsPolling] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isActive =
        kind !== "agent" &&
        (status?.toUpperCase() === "RUNNING" || status?.toUpperCase() === "QUEUED");

    useEffect(() => {
        if (isActive && onRefresh) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync polling state with effect lifecycle
            setIsPolling(true);
            intervalRef.current = setInterval(() => {
                onRefresh();
            }, 5000);
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync polling state with effect lifecycle
            setIsPolling(false);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, onRefresh]);

    return { isPolling };
}

// ─── Step status mapping ────────────────────────────────────────────────────

function mapStepStatus(step: WorkflowStep, suspendedStep?: string | null): StepStatus {
    if (step.status === "COMPLETED") return "completed";
    if (step.status === "FAILED") return "failed";
    if (suspendedStep && step.stepId === suspendedStep) return "suspended";
    if (step.status === "RUNNING") return "active";
    return "pending";
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface RunDetailPanelProps {
    runDetail: RunDetail | null;
    loading: boolean;
    inputText?: string;
    outputText?: string | null;
    status?: string;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    sessionId?: string | null;
    threadId?: string | null;
    instanceName?: string | null;
    instanceSlug?: string | null;
    agentSlug?: string;
    runId?: string;
    kind?: "agent" | "workflow" | "network";
    primitiveName?: string;
    onRefresh?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

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
    threadId,
    instanceName,
    instanceSlug,
    agentSlug,
    runId,
    kind = "agent",
    primitiveName,
    onRefresh
}: RunDetailPanelProps) {
    const [detailTab, setDetailTab] = useState("overview");
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    const { liveSteps, liveToolCalls, isStreaming } = useRunStream(agentSlug, runId, status, kind);
    const { isPolling } = useRunPolling(kind, runDetail?.status || status, onRefresh);

    const feedbackList = useMemo(() => {
        const feedback = runDetail?.feedback;
        if (!feedback) return [];
        return Array.isArray(feedback) ? feedback : [feedback];
    }, [runDetail]);

    const evaluationScores = useMemo(() => {
        if (kind === "workflow" && runDetail?.workflowEvaluation) {
            const eval_ = runDetail.workflowEvaluation;
            const scores: Record<string, number> = {};
            if (eval_.stepSuccessRate != null) scores["Step Success Rate"] = eval_.stepSuccessRate;
            if (eval_.outputQuality != null) scores["Output Quality"] = eval_.outputQuality;
            if (eval_.durationScore != null) scores["Duration Score"] = eval_.durationScore;
            if (eval_.overallScore != null) scores["Overall Score"] = eval_.overallScore;
            return Object.keys(scores).length > 0 ? scores : null;
        }
        if (kind === "network" && runDetail?.networkEvaluation) {
            const eval_ = runDetail.networkEvaluation;
            const scores: Record<string, number> = {};
            if (eval_.routingScore != null) scores["Routing Score"] = eval_.routingScore;
            if (eval_.agentScores) {
                for (const [agentKey, score] of Object.entries(eval_.agentScores)) {
                    scores[agentKey] = score;
                }
            }
            return Object.keys(scores).length > 0 ? scores : null;
        }
        const evaluation = runDetail?.evaluation;
        const evaluationScoresJson = Array.isArray(evaluation)
            ? evaluation[0]?.scoresJson
            : evaluation?.scoresJson;
        const traceScores =
            typeof runDetail?.trace?.scoresJson === "object"
                ? (runDetail?.trace?.scoresJson as Record<string, unknown>)
                : null;
        return evaluationScoresJson || traceScores;
    }, [runDetail, kind]);

    const evaluationNarrative = useMemo(() => {
        if (kind === "workflow") return runDetail?.workflowEvaluation?.narrative || null;
        if (kind === "network") return runDetail?.networkEvaluation?.narrative || null;
        return null;
    }, [runDetail, kind]);

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

    // Deduplicate workflow steps by stepId (keep latest iteration)
    const deduplicatedWorkflowSteps = useMemo(() => {
        const steps = runDetail?.workflowSteps || [];
        if (steps.length === 0) return [];
        const stepMap = new Map<string, WorkflowStep>();
        for (const step of steps) {
            stepMap.set(step.stepId, step);
        }
        return Array.from(stepMap.values());
    }, [runDetail]);

    // Auto-select first step for workflow/network detail
    useEffect(() => {
        if (kind === "workflow" && deduplicatedWorkflowSteps.length > 0 && !selectedStepId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: auto-select first step when steps load
            setSelectedStepId(deduplicatedWorkflowSteps[0]!.stepId);
        }
    }, [kind, deduplicatedWorkflowSteps, selectedStepId]);

    // Reset selected step when run changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset step selection when a different run is selected
        setSelectedStepId(null);
    }, [runId]);

    const isAgentKind = kind === "agent";

    return (
        <Tabs
            defaultValue="overview"
            value={detailTab}
            onValueChange={(value) => setDetailTab(value ?? "overview")}
            className="flex h-full flex-col"
        >
            <TabsList className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto">
                {isStreaming && (
                    <div className="flex items-center gap-1.5 pr-2" title="Live streaming">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                        </span>
                        <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                            LIVE
                        </span>
                    </div>
                )}
                {isPolling && (
                    <div className="flex items-center gap-1.5 pr-2" title="Polling for updates">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                        </span>
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            POLLING
                        </span>
                    </div>
                )}
                <TabsTrigger value="overview" className="shrink-0 gap-2">
                    <HugeiconsIcon icon={icons.file!} className="size-4" />
                    Overview
                </TabsTrigger>
                {isAgentKind ? (
                    <>
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
                    </>
                ) : (
                    <>
                        <TabsTrigger value="steps" className="shrink-0 gap-2">
                            <HugeiconsIcon icon={icons.activity!} className="size-4" />
                            Steps
                        </TabsTrigger>
                        <TabsTrigger value="evaluation" className="shrink-0 gap-2">
                            <HugeiconsIcon icon={icons["chart-evaluation"]!} className="size-4" />
                            Evaluation
                        </TabsTrigger>
                        <TabsTrigger value="feedback" className="shrink-0 gap-2">
                            <HugeiconsIcon icon={icons.star!} className="size-4" />
                            Feedback
                        </TabsTrigger>
                    </>
                )}
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
                            {kind !== "agent" && primitiveName && (
                                <div className="bg-muted/30 rounded-lg border p-3">
                                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                        {kind === "workflow" ? "Workflow" : "Network"}
                                    </h3>
                                    <span className="text-sm font-medium">{primitiveName}</span>
                                    {runDetail?.environment && (
                                        <Badge variant="outline" className="ml-2">
                                            {runDetail.environment}
                                        </Badge>
                                    )}
                                </div>
                            )}
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="flex flex-col">
                                    <h3 className="mb-2 text-sm font-semibold">
                                        {isAgentKind ? "User Input" : "Input"}
                                    </h3>
                                    <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                        <pre className="font-mono text-xs whitespace-pre-wrap">
                                            {effectiveInput}
                                        </pre>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="mb-2 text-sm font-semibold">
                                        {isAgentKind ? "Agent Response" : "Output"}
                                    </h3>
                                    <div className="bg-muted/20 flex-1 overflow-auto rounded-lg border p-3">
                                        <pre className="font-mono text-xs whitespace-pre-wrap">
                                            {effectiveOutput || "No output"}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            {(instanceName || runDetail?.instanceName) && (
                                <div className="bg-muted/30 rounded-lg border p-3">
                                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                        Instance
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {instanceName ?? runDetail?.instanceName}
                                        </span>
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
                                            {instanceSlug ?? runDetail?.instanceSlug}
                                        </code>
                                    </div>
                                </div>
                            )}

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

                            {isAgentKind && (
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
                                            <strong>
                                                {formatTokens(effectiveCompletionTokens)}
                                            </strong>
                                        </span>
                                        <span>
                                            Total:{" "}
                                            <strong>{formatTokens(effectiveTotalTokens)}</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!isAgentKind && (effectiveTotalTokens || runDetail?.costUsd) && (
                                <div className="flex flex-wrap gap-4 text-sm">
                                    {effectiveTotalTokens != null && (
                                        <span>
                                            Tokens:{" "}
                                            <strong>{formatTokens(effectiveTotalTokens)}</strong>
                                        </span>
                                    )}
                                    {runDetail?.costUsd != null && (
                                        <span>
                                            Cost: <strong>{formatCost(runDetail.costUsd)}</strong>
                                        </span>
                                    )}
                                </div>
                            )}

                            {isAgentKind && (
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
                            )}

                            {isAgentKind && evaluationScores && (
                                <div>
                                    <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                        Evaluation Scores
                                    </h3>
                                    <ScoreCards scores={evaluationScores} />
                                </div>
                            )}

                            {isAgentKind && feedbackList.length > 0 && (
                                <div>
                                    <Separator className="my-4" />
                                    <h3 className="mb-2 text-sm font-semibold">User Feedback</h3>
                                    <FeedbackList items={feedbackList} />
                                </div>
                            )}
                        </TabsContent>

                        {/* ─── Agent: Trace Tab ─── */}
                        {isAgentKind && (
                            <TabsContent value="trace" className="mt-0 space-y-4">
                                {liveSteps.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex size-2">
                                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                                                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                                            </span>
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                Live trace
                                            </span>
                                        </div>
                                        {liveSteps.map((step, idx) => (
                                            <div
                                                key={`live-${idx}`}
                                                className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900/30 dark:bg-green-950/10"
                                            >
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex size-7 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                            {step.index + 1}
                                                        </span>
                                                        <Badge variant="outline">{step.type}</Badge>
                                                    </div>
                                                    <span className="text-muted-foreground text-sm">
                                                        {step.durationMs
                                                            ? formatLatency(step.durationMs)
                                                            : "..."}
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
                                )}
                                {(() => {
                                    const steps = runDetail?.trace?.steps ?? [];
                                    const stepsJson = runDetail?.trace?.stepsJson as
                                        | unknown[]
                                        | null;
                                    const hasSteps = steps.length > 0;
                                    const hasStepsJson =
                                        Array.isArray(stepsJson) && stepsJson.length > 0;

                                    const turnSteps: unknown[] = [];
                                    if (
                                        !hasSteps &&
                                        !hasStepsJson &&
                                        Array.isArray(runDetail?.turns)
                                    ) {
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
                                                                : JSON.stringify(
                                                                      step.content,
                                                                      null,
                                                                      2
                                                                  )}
                                                        </pre>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    const jsonSteps = hasStepsJson
                                        ? stepsJson
                                        : hasTurnSteps
                                          ? turnSteps
                                          : null;
                                    if (jsonSteps) {
                                        return (
                                            <div className="space-y-3">
                                                {jsonSteps.map((step: unknown, idx: number) => {
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
                                                                    {typeof s.durationMs ===
                                                                    "number"
                                                                        ? formatLatency(
                                                                              s.durationMs
                                                                          )
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
                        )}

                        {/* ─── Agent: Tools Tab ─── */}
                        {isAgentKind && (
                            <TabsContent value="tools" className="mt-0 space-y-4">
                                {liveToolCalls.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex size-2">
                                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                                                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                                            </span>
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                Live tool calls
                                            </span>
                                        </div>
                                        {liveToolCalls.map((tc, idx) => (
                                            <div
                                                key={tc.id}
                                                className={`rounded-lg border p-4 ${
                                                    tc.status === "started"
                                                        ? "animate-pulse border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/10"
                                                        : tc.status === "failed"
                                                          ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10"
                                                          : "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10"
                                                }`}
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                            {idx + 1}
                                                        </span>
                                                        <div>
                                                            <span className="font-semibold">
                                                                {tc.toolKey}
                                                            </span>
                                                            <div className="text-xs">
                                                                {tc.status === "started" && (
                                                                    <span className="text-blue-600">
                                                                        Running...
                                                                    </span>
                                                                )}
                                                                {tc.status === "completed" && (
                                                                    <span className="text-green-600">
                                                                        Completed
                                                                    </span>
                                                                )}
                                                                {tc.status === "failed" && (
                                                                    <span className="text-red-600">
                                                                        Failed
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-muted-foreground text-sm">
                                                        {tc.durationMs
                                                            ? formatLatency(tc.durationMs)
                                                            : "..."}
                                                    </span>
                                                </div>
                                                {tc.inputJson != null && (
                                                    <pre className="bg-background max-h-32 overflow-auto rounded border p-3 text-xs">
                                                        {JSON.stringify(tc.inputJson, null, 2)}
                                                    </pre>
                                                )}
                                                {tc.error ? (
                                                    <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
                                                        {String(tc.error)}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {runDetail?.trace?.toolCalls &&
                                runDetail.trace.toolCalls.length > 0 ? (
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
                        )}

                        {/* ─── Agent: Errors Tab ─── */}
                        {isAgentKind && (
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
                                                        <Badge variant="outline">
                                                            {event.type}
                                                        </Badge>
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
                                            No errors, retries, or guardrail events recorded for
                                            this run.
                                        </p>
                                    )}
                            </TabsContent>
                        )}

                        {/* ─── Agent: Latency Tab ─── */}
                        {isAgentKind && (
                            <TabsContent value="latency" className="mt-0 space-y-4">
                                {(() => {
                                    const steps = runDetail?.trace?.steps ?? [];
                                    const stepsJson = runDetail?.trace?.stepsJson as
                                        | unknown[]
                                        | null;
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
                        )}

                        {/* ─── Workflow/Network: Steps Tab ─── */}
                        {!isAgentKind && (
                            <TabsContent value="steps" className="mt-0 space-y-4">
                                {kind === "workflow" && deduplicatedWorkflowSteps.length > 0 ? (
                                    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                                        <div className="overflow-y-auto">
                                            <Stepper orientation="vertical">
                                                {deduplicatedWorkflowSteps.map((step, idx) => {
                                                    const stepStatus = mapStepStatus(
                                                        step,
                                                        runDetail?.suspendedStep
                                                    );
                                                    const allIterations = (
                                                        runDetail?.workflowSteps || []
                                                    ).filter((s) => s.stepId === step.stepId);
                                                    const iterCount = allIterations.length;
                                                    return (
                                                        <StepItem
                                                            key={step.stepId}
                                                            status={stepStatus}
                                                            stepNumber={idx + 1}
                                                            label={step.stepName || step.stepId}
                                                            description={`${step.stepType} · ${formatLatency(step.durationMs)}`}
                                                            iterationBadge={
                                                                iterCount > 1
                                                                    ? `${iterCount}x`
                                                                    : undefined
                                                            }
                                                            isLast={
                                                                idx ===
                                                                deduplicatedWorkflowSteps.length - 1
                                                            }
                                                            onClick={() =>
                                                                setSelectedStepId(step.stepId)
                                                            }
                                                            className={
                                                                selectedStepId === step.stepId
                                                                    ? "bg-muted/50 rounded-md"
                                                                    : ""
                                                            }
                                                        />
                                                    );
                                                })}
                                            </Stepper>
                                        </div>
                                        <div>
                                            {(() => {
                                                const selected = deduplicatedWorkflowSteps.find(
                                                    (s) => s.stepId === selectedStepId
                                                );
                                                if (!selected) {
                                                    return (
                                                        <p className="text-muted-foreground text-sm">
                                                            Select a step to view details.
                                                        </p>
                                                    );
                                                }
                                                return (
                                                    <WorkflowStepDetail
                                                        step={selected}
                                                        suspendedStep={runDetail?.suspendedStep}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : kind === "network" &&
                                  (runDetail?.networkSteps || []).length > 0 ? (
                                    <div className="space-y-3">
                                        {(runDetail?.networkSteps || []).map((step) => (
                                            <NetworkStepCard key={step.id} step={step} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No steps recorded for this run.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        )}

                        {/* ─── Workflow/Network: Evaluation Tab ─── */}
                        {!isAgentKind && (
                            <TabsContent value="evaluation" className="mt-0 space-y-6">
                                {evaluationScores ? (
                                    <>
                                        <ScoreCards scores={evaluationScores} />
                                        {evaluationNarrative && (
                                            <div>
                                                <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                                                    Narrative
                                                </h3>
                                                <div className="bg-muted/20 rounded-lg border p-4">
                                                    <p className="text-sm whitespace-pre-wrap">
                                                        {evaluationNarrative}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No evaluation data available for this run.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        )}

                        {/* ─── Workflow/Network: Feedback Tab ─── */}
                        {!isAgentKind && (
                            <TabsContent value="feedback" className="mt-0 space-y-4">
                                {feedbackList.length > 0 ? (
                                    <FeedbackList items={feedbackList} />
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No feedback submitted for this run.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        )}
                    </>
                )}
            </div>
        </Tabs>
    );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function ScoreCards({ scores }: { scores: Record<string, unknown> }) {
    return (
        <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(scores).map(([key, value]) => {
                const score =
                    typeof value === "number"
                        ? value
                        : typeof value === "object" && value && "score" in value
                          ? Number((value as { score: number }).score)
                          : 0;
                return (
                    <div key={key} className="bg-muted/20 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{key}</span>
                            <span className="text-sm font-semibold">
                                {(score * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function FeedbackList({
    items
}: {
    items: Array<{
        id: string;
        thumbs: boolean | null;
        rating: number | null;
        comment: string | null;
        createdAt: string;
    }>;
}) {
    return (
        <div className="space-y-3">
            {items.map((fb) => (
                <div key={fb.id} className="bg-muted/20 rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                        {fb.rating !== null && <span>Rating: {fb.rating}</span>}
                        {fb.thumbs !== null && (
                            <span>{fb.thumbs ? "Thumbs up" : "Thumbs down"}</span>
                        )}
                        <span className="text-muted-foreground text-xs">
                            {new Date(fb.createdAt).toLocaleString()}
                        </span>
                    </div>
                    {fb.comment && <p className="mt-2">{fb.comment}</p>}
                </div>
            ))}
        </div>
    );
}

function WorkflowStepDetail({
    step,
    suspendedStep
}: {
    step: WorkflowStep;
    suspendedStep?: string | null;
}) {
    const isSuspended = suspendedStep === step.stepId;
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{step.stepName || step.stepId}</h3>
                <Badge variant={getStatusBadgeVariant(step.status)}>{step.status}</Badge>
                <Badge variant="outline">{step.stepType}</Badge>
                {isSuspended && (
                    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                        Suspended
                    </Badge>
                )}
            </div>
            {step.durationMs != null && (
                <p className="text-muted-foreground text-xs">
                    Duration: {formatLatency(step.durationMs)}
                </p>
            )}
            {step.inputJson != null && (
                <div>
                    <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Input
                    </h4>
                    <pre className="bg-muted/20 max-h-48 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                        {typeof step.inputJson === "string"
                            ? step.inputJson
                            : JSON.stringify(step.inputJson, null, 2)}
                    </pre>
                </div>
            )}
            {step.outputJson != null && (
                <div>
                    <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Output
                    </h4>
                    <pre className="bg-muted/20 max-h-48 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                        {typeof step.outputJson === "string"
                            ? step.outputJson
                            : JSON.stringify(step.outputJson, null, 2)}
                    </pre>
                </div>
            )}
            {step.errorJson != null && (
                <div>
                    <h4 className="mb-1 text-xs font-medium text-red-600 uppercase">Error</h4>
                    <pre className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                        {typeof step.errorJson === "string"
                            ? step.errorJson
                            : JSON.stringify(step.errorJson, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function NetworkStepCard({ step }: { step: NetworkStep }) {
    const stepTypeColors: Record<string, string> = {
        routing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
        agent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        tool: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    };
    return (
        <div className="bg-muted/30 rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-medium">
                        {step.stepNumber + 1}
                    </span>
                    <Badge
                        className={
                            stepTypeColors[step.stepType] ||
                            "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }
                    >
                        {step.stepType}
                    </Badge>
                    {step.primitiveType && step.primitiveId && (
                        <span className="text-muted-foreground text-xs">
                            {step.primitiveType}: {step.primitiveId}
                        </span>
                    )}
                    <Badge variant={getStatusBadgeVariant(step.status)}>{step.status}</Badge>
                </div>
                <span className="text-muted-foreground text-sm">
                    {formatLatency(step.durationMs)}
                </span>
            </div>
            {step.routingDecision != null && step.stepType === "routing" && (
                <div className="mt-2">
                    <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Routing Decision
                    </h4>
                    <pre className="bg-background max-h-32 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                        {JSON.stringify(step.routingDecision, null, 2)}
                    </pre>
                </div>
            )}
            {step.outputJson != null && step.stepType !== "routing" && (
                <div className="mt-2">
                    <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Output
                    </h4>
                    <pre className="bg-background max-h-32 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
                        {typeof step.outputJson === "string"
                            ? step.outputJson
                            : JSON.stringify(step.outputJson, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
