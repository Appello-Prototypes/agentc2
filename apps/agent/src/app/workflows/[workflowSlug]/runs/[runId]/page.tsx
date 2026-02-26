"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Skeleton,
    Stepper,
    StepItem,
    Textarea,
    type StepStatus
} from "@repo/ui";
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

/* ---------- Types ---------- */

interface RunStep {
    id: string;
    stepId: string;
    stepType: string;
    stepName?: string | null;
    status: string;
    inputJson?: unknown;
    outputJson?: unknown;
    errorJson?: unknown;
    durationMs?: number | null;
    iterationIndex?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;
}

interface RunDetail {
    id: string;
    status: string;
    inputJson?: unknown;
    outputJson?: unknown;
    startedAt: string;
    completedAt?: string | null;
    suspendedAt?: string | null;
    suspendedStep?: string | null;
    suspendDataJson?: Record<string, unknown> | null;
    durationMs?: number | null;
    environment?: string | null;
    triggerType?: string | null;
    steps: RunStep[];
}

/* ---------- Helpers ---------- */

function formatDuration(ms?: number | null) {
    if (!ms || ms <= 0) return "--";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s % 60)}s`;
}

function mapStepStatus(step: RunStep, run: RunDetail): StepStatus {
    const status = step.status.toUpperCase();
    if (status === "COMPLETED") return "completed";
    if (status === "FAILED") return "failed";
    if (run.suspendedStep === step.stepId) return "suspended";
    if (status === "RUNNING") return "active";
    return "pending";
}

function runStatusVariant(status: string) {
    const s = status.toUpperCase();
    if (s === "COMPLETED") return "default" as const;
    if (s === "FAILED" || s === "CANCELLED") return "destructive" as const;
    return "secondary" as const;
}

function displayRunStatus(run: RunDetail) {
    if (run.suspendedAt) return "suspended";
    return run.status.toLowerCase();
}

function tryPrettyJson(value: unknown): string {
    if (value === null || value === undefined) return "--";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function extractTextContent(output: unknown): string | null {
    if (!output || typeof output !== "object") return null;
    const obj = output as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.result === "string") return obj.result;
    return null;
}

/* ---------- Component ---------- */

export default function WorkflowRunDetailPage() {
    const params = useParams();
    const router = useRouter();
    const workflowSlug = params.workflowSlug as string;
    const runId = params.runId as string;

    const [run, setRun] = useState<RunDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [resumeLoading, setResumeLoading] = useState(false);
    const [feedback, setFeedback] = useState("");

    const fetchRun = useCallback(
        async (silent = false) => {
            try {
                if (!silent) setLoading(true);
                const res = await fetch(
                    `${getApiBase()}/api/workflows/${workflowSlug}/runs/${runId}`
                );
                const data = await res.json();
                if (data.run) setRun(data.run);
            } catch (err) {
                console.error("Failed to load run:", err);
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [workflowSlug, runId]
    );

    useEffect(() => {
        fetchRun();
    }, [fetchRun]);

    // Poll while run is active/suspended
    useEffect(() => {
        if (!run) return;
        const s = run.status.toUpperCase();
        if (s === "COMPLETED" || s === "FAILED" || s === "CANCELLED") return;
        const interval = setInterval(() => fetchRun(true), 5000);
        return () => clearInterval(interval);
    }, [run, fetchRun]);

    // Auto-select first incomplete step or suspended step
    useEffect(() => {
        if (!run || selectedStepId) return;
        if (run.suspendedStep) {
            setSelectedStepId(run.suspendedStep);
            return;
        }
        const incomplete = run.steps.find((s) => s.status.toUpperCase() !== "COMPLETED");
        setSelectedStepId(incomplete?.stepId ?? run.steps[0]?.stepId ?? null);
    }, [run, selectedStepId]);

    const handleResume = async (data: Record<string, unknown>) => {
        if (!run) return;
        setResumeLoading(true);
        try {
            await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/runs/${runId}/resume`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeData: data })
            });
            setFeedback("");
            await fetchRun();
        } catch (err) {
            console.error("Resume failed:", err);
        } finally {
            setResumeLoading(false);
        }
    };

    /* --- Deduplicate steps by stepId (keep latest iteration) --- */
    const deduplicatedSteps = run
        ? Object.values(
              run.steps.reduce(
                  (acc, step) => {
                      const existing = acc[step.stepId];
                      if (
                          !existing ||
                          (step.iterationIndex ?? 0) > (existing.iterationIndex ?? 0)
                      ) {
                          acc[step.stepId] = step;
                      }
                      return acc;
                  },
                  {} as Record<string, RunStep>
              )
          )
        : [];

    const selectedStep = run?.steps.find((s) => s.stepId === selectedStepId);

    const iterationsForStep = selectedStepId
        ? run?.steps
              .filter((s) => s.stepId === selectedStepId)
              .sort((a, b) => (a.iterationIndex ?? 0) - (b.iterationIndex ?? 0))
        : [];

    const isSuspended = run?.suspendedAt && run.suspendedStep === selectedStepId;

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    if (!run) {
        return <div className="text-muted-foreground text-sm">Run not found.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/workflows/${workflowSlug}/runs`)}
                    >
                        <ArrowLeftIcon className="mr-1 size-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">Run {run.id.slice(0, 8)}...</h1>
                        <p className="text-muted-foreground text-xs">
                            Started {new Date(run.startedAt).toLocaleString()} ·{" "}
                            {formatDuration(run.durationMs)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={runStatusVariant(run.status)}>{displayRunStatus(run)}</Badge>
                    <Button variant="outline" size="sm" onClick={() => fetchRun()}>
                        <RefreshCwIcon className="mr-1 size-3" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Main grid */}
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                {/* Left: Stepper */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Steps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stepper orientation="vertical">
                            {deduplicatedSteps.map((step, idx) => {
                                const status = mapStepStatus(step, run);
                                const allIterations = run.steps.filter(
                                    (s) => s.stepId === step.stepId
                                );
                                const iterCount = allIterations.length;
                                return (
                                    <StepItem
                                        key={step.stepId}
                                        status={status}
                                        stepNumber={idx + 1}
                                        label={step.stepName || step.stepId}
                                        description={`${step.stepType} · ${formatDuration(step.durationMs)}`}
                                        iterationBadge={iterCount > 1 ? `${iterCount}x` : undefined}
                                        isLast={idx === deduplicatedSteps.length - 1}
                                        onClick={() => setSelectedStepId(step.stepId)}
                                        className={
                                            selectedStepId === step.stepId
                                                ? "bg-muted/50 rounded-md"
                                                : ""
                                        }
                                    />
                                );
                            })}
                        </Stepper>
                    </CardContent>
                </Card>

                {/* Right: Step detail */}
                <div className="space-y-4">
                    {selectedStep ? (
                        <>
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm">
                                            {selectedStep.stepName || selectedStep.stepId}
                                        </CardTitle>
                                        <Badge
                                            variant={
                                                selectedStep.status.toUpperCase() === "COMPLETED"
                                                    ? "default"
                                                    : selectedStep.status.toUpperCase() === "FAILED"
                                                      ? "destructive"
                                                      : "secondary"
                                            }
                                        >
                                            {isSuspended
                                                ? "suspended"
                                                : selectedStep.status.toLowerCase()}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                                        <span>Type: {selectedStep.stepType}</span>
                                        <span>
                                            Duration: {formatDuration(selectedStep.durationMs)}
                                        </span>
                                        {selectedStep.startedAt && (
                                            <span>
                                                Started:{" "}
                                                {new Date(
                                                    selectedStep.startedAt
                                                ).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Output: prefer rendered text for agent steps */}
                                    {selectedStep.outputJson != null && (
                                        <div>
                                            <div className="text-muted-foreground mb-1 text-xs font-medium">
                                                Output
                                            </div>
                                            {extractTextContent(selectedStep.outputJson) ? (
                                                <div className="prose prose-sm dark:prose-invert max-h-96 overflow-auto rounded-md border p-3">
                                                    <pre className="text-xs whitespace-pre-wrap">
                                                        {extractTextContent(
                                                            selectedStep.outputJson
                                                        )}
                                                    </pre>
                                                </div>
                                            ) : (
                                                <pre className="max-h-96 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                                                    {tryPrettyJson(selectedStep.outputJson)}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {/* Error */}
                                    {selectedStep.errorJson != null && (
                                        <div>
                                            <div className="text-destructive mb-1 text-xs font-medium">
                                                Error
                                            </div>
                                            <pre className="border-destructive/20 bg-destructive/5 max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                                                {tryPrettyJson(selectedStep.errorJson)}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Input */}
                                    {selectedStep.inputJson != null && (
                                        <details>
                                            <summary className="text-muted-foreground cursor-pointer text-xs">
                                                Input
                                            </summary>
                                            <pre className="mt-1 max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                                                {tryPrettyJson(selectedStep.inputJson)}
                                            </pre>
                                        </details>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Iteration history for dowhile steps */}
                            {iterationsForStep && iterationsForStep.length > 1 && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">
                                            Iteration History ({iterationsForStep.length}{" "}
                                            iterations)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {iterationsForStep.map((iter, idx) => (
                                            <div
                                                key={`${iter.stepId}-${iter.iterationIndex ?? idx}`}
                                                className="rounded-md border p-3"
                                            >
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-medium">
                                                        Iteration {(iter.iterationIndex ?? idx) + 1}
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            iter.status.toUpperCase() ===
                                                            "COMPLETED"
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {iter.status.toLowerCase()}
                                                    </Badge>
                                                </div>
                                                <pre className="max-h-32 overflow-auto text-xs whitespace-pre-wrap">
                                                    {tryPrettyJson(iter.outputJson)}
                                                </pre>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Approval panel for suspended human steps */}
                            {isSuspended && (
                                <Card className="border-amber-500">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm text-amber-600">
                                            Awaiting Approval
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {run.suspendDataJson?.prompt != null && (
                                            <p className="text-sm">
                                                {String(run.suspendDataJson.prompt)}
                                            </p>
                                        )}

                                        <div>
                                            <label className="mb-1 block text-xs font-medium">
                                                Feedback (optional for revision)
                                            </label>
                                            <Textarea
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                placeholder="Provide feedback or revision instructions..."
                                                className="h-20"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() =>
                                                    handleResume({
                                                        approved: true
                                                    })
                                                }
                                                disabled={resumeLoading}
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                                {resumeLoading ? "Processing..." : "Approve"}
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    handleResume({
                                                        approved: false,
                                                        feedback
                                                    })
                                                }
                                                disabled={resumeLoading}
                                                variant="outline"
                                                className="flex-1"
                                            >
                                                {resumeLoading ? "..." : "Request Revision"}
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    handleResume({
                                                        approved: false,
                                                        rejected: true,
                                                        reason: feedback || "Rejected by reviewer"
                                                    })
                                                }
                                                disabled={resumeLoading}
                                                variant="destructive"
                                            >
                                                {resumeLoading ? "..." : "Reject"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card>
                            <CardContent className="py-8">
                                <p className="text-muted-foreground text-center text-sm">
                                    Select a step to view details.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
