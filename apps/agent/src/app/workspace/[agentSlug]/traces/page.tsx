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
    scores: {
        helpfulness?: number;
        relevancy?: number;
    };
    createdAt: string;
}

// Mock trace data
const mockTraces: Trace[] = [
    {
        id: "trace-001",
        runId: "run-001",
        input: "What's the weather in San Francisco and schedule a meeting for tomorrow?",
        output: "The weather in San Francisco is currently 65°F and partly cloudy. I've scheduled your meeting for tomorrow at 2:00 PM.",
        status: "completed",
        durationMs: 4250,
        model: { provider: "anthropic", name: "claude-sonnet-4", temperature: 0.7 },
        steps: [
            {
                step: 1,
                type: "thinking",
                content:
                    "User wants weather info and to schedule a meeting. I'll need to use two tools.",
                timestamp: new Date(Date.now() - 4000).toISOString(),
                durationMs: 450
            },
            {
                step: 2,
                type: "tool_call",
                content: "Calling weather API for San Francisco",
                timestamp: new Date(Date.now() - 3500).toISOString(),
                durationMs: 850
            },
            {
                step: 3,
                type: "tool_result",
                content: "Weather data received: 65°F, partly cloudy",
                timestamp: new Date(Date.now() - 2650).toISOString()
            },
            {
                step: 4,
                type: "tool_call",
                content: "Scheduling meeting for tomorrow 2:00 PM",
                timestamp: new Date(Date.now() - 2500).toISOString(),
                durationMs: 620
            },
            {
                step: 5,
                type: "tool_result",
                content: "Meeting scheduled successfully",
                timestamp: new Date(Date.now() - 1880).toISOString()
            },
            {
                step: 6,
                type: "thinking",
                content: "Both tasks completed. Composing response.",
                timestamp: new Date(Date.now() - 1700).toISOString(),
                durationMs: 280
            },
            {
                step: 7,
                type: "response",
                content: "Final response generated",
                timestamp: new Date(Date.now() - 1420).toISOString(),
                durationMs: 1420
            }
        ],
        toolCalls: [
            {
                name: "weather-api",
                input: { city: "San Francisco" },
                output: { temp: 65, condition: "partly cloudy" },
                durationMs: 850,
                success: true
            },
            {
                name: "calendar-schedule",
                input: { time: "tomorrow 2:00 PM", title: "Meeting" },
                output: { eventId: "evt-123" },
                durationMs: 620,
                success: true
            }
        ],
        tokens: { prompt: 245, completion: 156, total: 401 },
        scores: { helpfulness: 0.94, relevancy: 0.91 },
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
        id: "trace-002",
        runId: "run-002",
        input: "Analyze the sales data from last quarter",
        output: "Error: Database connection timeout",
        status: "timeout",
        durationMs: 30000,
        model: { provider: "anthropic", name: "claude-sonnet-4", temperature: 0.7 },
        steps: [
            {
                step: 1,
                type: "thinking",
                content: "User wants sales analysis. I'll query the database.",
                timestamp: new Date(Date.now() - 35000).toISOString(),
                durationMs: 320
            },
            {
                step: 2,
                type: "tool_call",
                content: "Querying database for Q4 sales data...",
                timestamp: new Date(Date.now() - 34680).toISOString(),
                durationMs: 30000
            }
        ],
        toolCalls: [
            {
                name: "database-query",
                input: { query: "SELECT * FROM sales WHERE quarter = 'Q4'" },
                error: "Connection timeout after 30s",
                durationMs: 30000,
                success: false
            }
        ],
        tokens: { prompt: 189, completion: 0, total: 189 },
        scores: {},
        createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
    }
];

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
    const { variant, label } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
}

export default function TracesPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [traces, setTraces] = useState<Trace[]>([]);
    const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

    useEffect(() => {
        setTimeout(() => {
            setTraces(mockTraces);
            setSelectedTrace(mockTraces[0]);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

    const handleCopyTrace = async () => {
        if (!selectedTrace) return;
        const text = JSON.stringify(selectedTrace, null, 2);
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
    };

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
                <Button variant="outline">Time Travel Mode</Button>
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
                                    onClick={() => setSelectedTrace(trace)}
                                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                                        selectedTrace?.id === trace.id
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

                                {/* Execution Timeline */}
                                <div>
                                    <p className="mb-2 text-sm font-medium">Execution Timeline</p>
                                    <div className="space-y-2">
                                        {selectedTrace.steps.map((step) => {
                                            const config = stepConfig[step.type];
                                            return (
                                                <div
                                                    key={step.step}
                                                    className={`rounded-lg border p-3 ${config.color}`}
                                                >
                                                    <div className="mb-1 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span>{config.icon}</span>
                                                            <span className="text-sm font-medium">
                                                                Step {step.step}: {config.label}
                                                            </span>
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
                                        })}
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
