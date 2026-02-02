"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
    Skeleton,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@repo/ui";

interface ExecutionStep {
    step: number;
    type: "thinking" | "tool_call" | "tool_result" | "response";
    content: string;
    timestamp: string;
    durationMs?: number;
}

interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
    success: boolean;
    error?: string;
}

interface Trace {
    id: string;
    runId: string;
    input: string;
    output: string;
    status: "completed" | "failed" | "timeout";
    durationMs: number;
    model: {
        provider: string;
        name: string;
        temperature: number;
    };
    steps: ExecutionStep[];
    toolCalls: ToolCall[];
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    scores: Record<string, number>;
    createdAt: string;
}

const stepConfig: Record<string, { color: string; icon: string; label: string }> = {
    thinking: {
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        icon: "💭",
        label: "Thinking"
    },
    tool_call: {
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        icon: "🔧",
        label: "Tool Call"
    },
    tool_result: {
        color: "bg-green-500/20 text-green-400 border-green-500/30",
        icon: "📥",
        label: "Tool Result"
    },
    response: {
        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        icon: "💬",
        label: "Response"
    }
};

function StatusBadge({ status }: { status: Trace["status"] }) {
    const config = {
        completed: { variant: "default" as const, label: "Completed" },
        failed: { variant: "destructive" as const, label: "Failed" },
        timeout: { variant: "secondary" as const, label: "Timeout" }
    };
    const { variant, label } = config[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
}

export default function TracesPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [traces, setTraces] = useState<Trace[]>([]);
    const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
    const [timeTravelEnabled, setTimeTravelEnabled] = useState(false);
    const [timeTravelStep, setTimeTravelStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Fetch runs and their traces
    const fetchTraces = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // First, get the runs list
            const runsRes = await fetch(`${getApiBase()}/api/agents/${agentSlug}/runs?limit=20`);
            const runsResult = await runsRes.json();

            if (!runsResult.success) {
                throw new Error(runsResult.error || "Failed to fetch runs");
            }

            // Transform runs into trace objects (without full trace details)
            const transformedTraces: Trace[] = runsResult.runs.map(
                (run: {
                    id: string;
                    status: string;
                    inputText: string;
                    outputText?: string;
                    durationMs?: number;
                    modelProvider?: string;
                    modelName?: string;
                    startedAt: string;
                    totalTokens?: number;
                }) => ({
                    id: `trace-${run.id}`,
                    runId: run.id,
                    input: run.inputText,
                    output: run.outputText || "",
                    status: run.status.toLowerCase() as Trace["status"],
                    durationMs: run.durationMs || 0,
                    model: {
                        provider: run.modelProvider || "unknown",
                        name: run.modelName || "unknown",
                        temperature: 0.7
                    },
                    steps: [],
                    toolCalls: [],
                    tokens: { prompt: 0, completion: 0, total: run.totalTokens || 0 },
                    scores: {},
                    createdAt: run.startedAt
                })
            );

            setTraces(transformedTraces);
            // Select first trace if available (details loaded separately)
            if (transformedTraces.length > 0) {
                setSelectedTrace(transformedTraces[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load traces");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    // Load full trace details for a specific run
    const loadTraceDetails = useCallback(
        async (runId: string, baseTrace: Trace) => {
            try {
                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/runs/${runId}/trace`
                );
                const result = await response.json();

                if (result.success && result.trace) {
                    const traceData = result.trace;
                    const detailedTrace: Trace = {
                        ...baseTrace,
                        steps: (traceData.steps || []).map(
                            (s: {
                                stepNumber: number;
                                type: string;
                                content: string;
                                timestamp: string;
                                durationMs?: number;
                            }) => ({
                                step: s.stepNumber,
                                type: s.type as ExecutionStep["type"],
                                content: s.content,
                                timestamp: s.timestamp,
                                durationMs: s.durationMs
                            })
                        ),
                        toolCalls: (traceData.toolCalls || []).map(
                            (tc: {
                                toolKey: string;
                                inputJson: Record<string, unknown>;
                                outputJson?: unknown;
                                success: boolean;
                                error?: string;
                                durationMs?: number;
                            }) => ({
                                name: tc.toolKey,
                                input: tc.inputJson as Record<string, unknown>,
                                output: tc.outputJson,
                                success: tc.success,
                                error: tc.error,
                                durationMs: tc.durationMs
                            })
                        ),
                        tokens: traceData.tokensJson || baseTrace.tokens,
                        scores: traceData.scoresJson || {}
                    };
                    setSelectedTrace(detailedTrace);
                } else {
                    setSelectedTrace(baseTrace);
                }
            } catch (err) {
                console.error("Failed to load trace details:", err);
                setSelectedTrace(baseTrace);
            }
        },
        [agentSlug]
    );

    useEffect(() => {
        fetchTraces();
    }, [fetchTraces]);

    const handleCopyTrace = async () => {
        if (!selectedTrace) return;
        const text = JSON.stringify(selectedTrace, null, 2);
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
    };

    const handleTraceSelect = (trace: Trace) => {
        loadTraceDetails(trace.runId, trace);
        // Reset time travel when changing traces
        setTimeTravelEnabled(false);
        setTimeTravelStep(0);
        setIsPlaying(false);
    };

    // Toggle time travel mode
    const handleTimeTravelToggle = () => {
        if (timeTravelEnabled) {
            // Exiting time travel - show all steps
            setTimeTravelEnabled(false);
            setIsPlaying(false);
        } else {
            // Entering time travel - start at step 0
            setTimeTravelEnabled(true);
            setTimeTravelStep(0);
            setIsPlaying(false);
        }
    };

    // Time travel controls
    const handleStepForward = () => {
        if (selectedTrace && timeTravelStep < selectedTrace.steps.length) {
            setTimeTravelStep((prev) => prev + 1);
        }
    };

    const handleStepBackward = () => {
        if (timeTravelStep > 0) {
            setTimeTravelStep((prev) => prev - 1);
        }
    };

    const handlePlayPause = () => {
        setIsPlaying((prev) => !prev);
    };

    const handleReset = () => {
        setTimeTravelStep(0);
        setIsPlaying(false);
    };

    // Auto-play effect
    useEffect(() => {
        if (!isPlaying || !selectedTrace) return;

        const maxStep = selectedTrace.steps.length;
        if (timeTravelStep >= maxStep) {
            setIsPlaying(false);
            return;
        }

        const timer = setTimeout(() => {
            setTimeTravelStep((prev) => prev + 1);
        }, 1000); // 1 second per step

        return () => clearTimeout(timer);
    }, [isPlaying, timeTravelStep, selectedTrace]);

    // Get visible steps based on time travel mode
    const visibleSteps =
        timeTravelEnabled && selectedTrace
            ? selectedTrace.steps.slice(0, timeTravelStep)
            : selectedTrace?.steps || [];

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Trace Explorer</h1>
                    <p className="text-muted-foreground">
                        Deep dive into execution traces with time-travel debugging
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchTraces}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Trace Explorer</h1>
                    <p className="text-muted-foreground">
                        Deep dive into execution traces with time-travel debugging
                    </p>
                </div>
                <Button
                    variant={timeTravelEnabled ? "default" : "outline"}
                    onClick={handleTimeTravelToggle}
                    disabled={!selectedTrace || selectedTrace.steps.length === 0}
                >
                    {timeTravelEnabled ? "⏹ Exit Time Travel" : "⏱ Time Travel Mode"}
                </Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <Input
                    placeholder="Search traces by input or output..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                />
                <Button variant="outline" size="sm">
                    Filter
                </Button>
            </div>

            {/* Trace List & Detail */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Trace List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Traces</CardTitle>
                        <CardDescription>Select a trace to inspect</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] space-y-2 overflow-y-auto">
                            {traces.map((trace) => (
                                <div
                                    key={trace.id}
                                    onClick={() => handleTraceSelect(trace)}
                                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                        selectedTrace?.runId === trace.runId
                                            ? "border-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {trace.input}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <StatusBadge status={trace.status} />
                                                <span className="text-muted-foreground text-xs">
                                                    {(trace.durationMs / 1000).toFixed(1)}s
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {trace.steps.length} steps
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {trace.toolCalls.length} tools
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {new Date(trace.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Trace Detail */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle>Trace Detail</CardTitle>
                                <CardDescription className="font-mono text-xs">
                                    {selectedTrace?.id || "Select a trace"}
                                </CardDescription>
                            </div>
                            {selectedTrace && (
                                <Button variant="outline" size="sm" onClick={handleCopyTrace}>
                                    {copyStatus === "copied" ? "Copied!" : "Copy JSON"}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {selectedTrace ? (
                            <div className="max-h-[600px] space-y-6 overflow-y-auto">
                                {/* Summary */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-muted-foreground text-xs">Status</p>
                                        <StatusBadge status={selectedTrace.status} />
                                    </div>
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-muted-foreground text-xs">Duration</p>
                                        <p className="font-mono text-sm">
                                            {(selectedTrace.durationMs / 1000).toFixed(2)}s
                                        </p>
                                    </div>
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-muted-foreground text-xs">Tokens</p>
                                        <p className="font-mono text-sm">
                                            {selectedTrace.tokens.total}
                                        </p>
                                    </div>
                                    <div className="bg-muted rounded p-2 text-center">
                                        <p className="text-muted-foreground text-xs">Quality</p>
                                        <p className="font-mono text-sm">
                                            {selectedTrace.scores.helpfulness
                                                ? `${(selectedTrace.scores.helpfulness * 100).toFixed(0)}%`
                                                : "-"}
                                        </p>
                                    </div>
                                </div>

                                {/* Model */}
                                <div className="bg-muted rounded-lg p-3">
                                    <p className="text-muted-foreground mb-1 text-xs">Model</p>
                                    <p className="font-mono text-sm">
                                        {selectedTrace.model.provider}/{selectedTrace.model.name}
                                        <span className="text-muted-foreground">
                                            {" "}
                                            (temp: {selectedTrace.model.temperature})
                                        </span>
                                    </p>
                                </div>

                                {/* Input */}
                                <div>
                                    <p className="mb-1 text-sm font-medium">👤 Input</p>
                                    <div className="bg-muted rounded-lg p-3">
                                        <p className="text-sm">{selectedTrace.input}</p>
                                    </div>
                                </div>

                                {/* Time Travel Controls */}
                                {timeTravelEnabled && (
                                    <div className="bg-primary/10 border-primary/30 rounded-lg border p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-sm font-medium">
                                                ⏱ Time Travel Mode
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Step {timeTravelStep} / {selectedTrace.steps.length}
                                            </p>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="bg-muted mb-3 h-2 w-full overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full transition-all duration-300"
                                                style={{
                                                    width:
                                                        selectedTrace.steps.length > 0
                                                            ? `${(timeTravelStep / selectedTrace.steps.length) * 100}%`
                                                            : "0%"
                                                }}
                                            />
                                        </div>
                                        {/* Controls */}
                                        <div className="flex items-center justify-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleReset}
                                                disabled={timeTravelStep === 0}
                                            >
                                                ⏮ Reset
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleStepBackward}
                                                disabled={timeTravelStep === 0}
                                            >
                                                ◀ Back
                                            </Button>
                                            <Button
                                                variant={isPlaying ? "destructive" : "default"}
                                                size="sm"
                                                onClick={handlePlayPause}
                                                disabled={
                                                    timeTravelStep >= selectedTrace.steps.length
                                                }
                                            >
                                                {isPlaying ? "⏸ Pause" : "▶ Play"}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleStepForward}
                                                disabled={
                                                    timeTravelStep >= selectedTrace.steps.length
                                                }
                                            >
                                                Next ▶
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Execution Timeline */}
                                <div>
                                    <p className="mb-2 text-sm font-medium">
                                        Execution Timeline
                                        {timeTravelEnabled && (
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                (showing {visibleSteps.length} of{" "}
                                                {selectedTrace.steps.length} steps)
                                            </span>
                                        )}
                                    </p>
                                    <div className="space-y-2">
                                        {visibleSteps.length === 0 && timeTravelEnabled ? (
                                            <div className="text-muted-foreground rounded-lg border py-4 text-center text-sm">
                                                Click &quot;Next&quot; or &quot;Play&quot; to step
                                                through the execution
                                            </div>
                                        ) : (
                                            visibleSteps.map((step, index) => {
                                                const config = stepConfig[step.type];
                                                const isLatestStep =
                                                    timeTravelEnabled &&
                                                    index === visibleSteps.length - 1;
                                                return (
                                                    <div
                                                        key={step.step}
                                                        className={`rounded-lg border p-3 transition-all ${config.color} ${
                                                            isLatestStep
                                                                ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                                                                : ""
                                                        }`}
                                                    >
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span>{config.icon}</span>
                                                                <span className="text-sm font-medium">
                                                                    Step {step.step}: {config.label}
                                                                </span>
                                                                {isLatestStep && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="text-xs"
                                                                    >
                                                                        Current
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs opacity-70">
                                                                {step.durationMs && (
                                                                    <span>{step.durationMs}ms</span>
                                                                )}
                                                                <span>
                                                                    {new Date(
                                                                        step.timestamp
                                                                    ).toLocaleTimeString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm opacity-90">
                                                            {step.content}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Tool Calls */}
                                {selectedTrace.toolCalls.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-sm font-medium">
                                            Tool Calls ({selectedTrace.toolCalls.length})
                                        </p>
                                        <Accordion className="w-full">
                                            {selectedTrace.toolCalls.map((tc, i) => (
                                                <AccordionItem key={i} value={`tool-${i}`}>
                                                    <AccordionTrigger className="py-2 hover:no-underline">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`h-2 w-2 rounded-full ${tc.success ? "bg-green-500" : "bg-red-500"}`}
                                                            />
                                                            <span className="font-mono text-sm">
                                                                {tc.name}
                                                            </span>
                                                            {tc.durationMs && (
                                                                <span className="text-muted-foreground text-xs">
                                                                    {tc.durationMs}ms
                                                                </span>
                                                            )}
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="space-y-2 pl-4">
                                                            <div>
                                                                <p className="text-muted-foreground mb-1 text-xs">
                                                                    INPUT
                                                                </p>
                                                                <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">
                                                                    {JSON.stringify(
                                                                        tc.input,
                                                                        null,
                                                                        2
                                                                    )}
                                                                </pre>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground mb-1 text-xs">
                                                                    {tc.error ? "ERROR" : "OUTPUT"}
                                                                </p>
                                                                <pre
                                                                    className={`overflow-x-auto rounded p-2 text-xs ${tc.error ? "bg-red-500/10" : "bg-muted"}`}
                                                                >
                                                                    {tc.error ||
                                                                        JSON.stringify(
                                                                            tc.output,
                                                                            null,
                                                                            2
                                                                        )}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </div>
                                )}

                                {/* Output */}
                                <div>
                                    <p className="mb-1 text-sm font-medium">🤖 Output</p>
                                    <div className="bg-primary/10 rounded-lg p-3">
                                        <p className="text-sm">{selectedTrace.output}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm">
                                        ⏪ Replay from Start
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        🔄 Re-run
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        📤 Export
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground py-12 text-center">
                                Select a trace from the list
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
