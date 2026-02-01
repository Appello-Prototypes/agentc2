"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Skeleton,
    Tool,
    ToolHeader,
    ToolContent,
    ToolInput,
    ToolOutput,
    Task,
    TaskTrigger,
    TaskContent,
    TaskItem,
    Loader,
    CodeBlock,
    CodeBlockHeader,
    CodeBlockTitle,
    CodeBlockFilename,
    CodeBlockActions,
    CodeBlockCopyButton
} from "@repo/ui";

/**
 * Format a trace as markdown for copying to clipboard
 */
function formatTraceForCopy(trace: Trace): string {
    const lines: string[] = [
        `# Voice Agent Trace`,
        ``,
        `**ID:** ${trace.traceId}`,
        `**Timestamp:** ${trace.timestamp}`,
        `**Duration:** ${(trace.durationMs / 1000).toFixed(2)}s`,
        ``,
        `## Model Configuration`,
        `- **Provider:** ${trace.model.provider}`,
        `- **Model:** ${trace.model.name}`,
        trace.model.temperature !== undefined
            ? `- **Temperature:** ${trace.model.temperature}`
            : "",
        trace.tokens
            ? `- **Tokens:** ${trace.tokens.prompt} prompt, ${trace.tokens.completion} completion (${trace.tokens.total} total)`
            : "",
        ``,
        `## User Input`,
        "```",
        trace.input,
        "```",
        ``,
        `## Execution Timeline`,
        ``
    ];

    for (const step of trace.steps) {
        const typeLabel = {
            thinking: "THINKING",
            tool_call: "TOOL CALL",
            tool_result: "TOOL RESULT",
            response: "RESPONSE"
        }[step.type];

        lines.push(`### Step ${step.step}: ${typeLabel}`);
        lines.push(`*${new Date(step.timestamp).toLocaleTimeString()}*`);
        lines.push(``);
        lines.push(step.content);
        lines.push(``);
    }

    if (trace.toolCalls.length > 0) {
        lines.push(`## Tool Calls (${trace.toolCalls.length})`);
        lines.push(``);

        for (const tc of trace.toolCalls) {
            lines.push(`### ${tc.name}`);
            lines.push(`**Status:** ${tc.success ? "Success" : "Failed"}`);
            if (tc.error) {
                lines.push(`**Error:** ${tc.error}`);
            }
            lines.push(``);
            lines.push(`**Input:**`);
            lines.push("```json");
            lines.push(JSON.stringify(tc.input, null, 2));
            lines.push("```");
            lines.push(``);
            lines.push(`**Output:**`);
            lines.push("```json");
            lines.push(
                typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2)
            );
            lines.push("```");
            lines.push(``);
        }
    }

    lines.push(`## Agent Response`);
    lines.push("```");
    lines.push(trace.output);
    lines.push("```");
    lines.push(``);

    lines.push(`## Evaluation Scores`);
    lines.push(
        `- **Helpfulness:** ${trace.scores.helpfulness ? `${(trace.scores.helpfulness.score * 100).toFixed(0)}% (${trace.scores.helpfulness.reasoning})` : "N/A"}`
    );
    lines.push(
        `- **Relevancy:** ${trace.scores.relevancy ? `${(trace.scores.relevancy.score * 100).toFixed(0)}%` : "Pending"}`
    );
    lines.push(``);

    lines.push(`## Available Tools (${trace.availableTools.length})`);
    lines.push(trace.availableTools.join(", "));
    lines.push(``);

    lines.push(`## Metadata`);
    lines.push(`- **Source:** ${trace.metadata.source}`);
    if (trace.metadata.agentId) {
        lines.push(`- **Agent ID:** ${trace.metadata.agentId}`);
    }
    if (trace.metadata.maxSteps) {
        lines.push(`- **Max Steps:** ${trace.metadata.maxSteps}`);
    }

    return lines.filter((l) => l !== "").join("\n");
}

// Types matching trace-store.ts
interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
    success: boolean;
    error?: string;
}

interface ExecutionStep {
    step: number;
    type: "thinking" | "tool_call" | "tool_result" | "response";
    content: string;
    timestamp: string;
    toolCall?: ToolCall;
}

interface Trace {
    traceId: string;
    timestamp: string;
    input: string;
    output: string;
    model: {
        provider: string;
        name: string;
        temperature?: number;
    };
    availableTools: string[];
    toolCalls: ToolCall[];
    steps: ExecutionStep[];
    durationMs: number;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    scores: {
        helpfulness?: { score: number; reasoning: string };
        relevancy?: { score: number };
    };
    metadata: {
        source: string;
        agentId?: string;
        maxSteps?: number;
    };
}

interface Server {
    name: string;
    toolCount: number;
    tools: Array<{ name: string; description: string }>;
}

interface ToolsResponse {
    success: boolean;
    totalTools: number;
    serverCount: number;
    servers: Server[];
}

interface TracesResponse {
    traces: Trace[];
    stats: {
        totalTraces: number;
        avgDurationMs: number;
        avgHelpfulness: number | null;
        avgRelevancy: number | null;
        toolUsage: Record<string, number>;
        modelsUsed?: string[];
    };
}

// Step type colors and icons
const stepConfig: Record<string, { color: string; icon: string; label: string }> = {
    thinking: { color: "bg-blue-500/20 text-blue-400", icon: "💭", label: "Thinking" },
    tool_call: { color: "bg-yellow-500/20 text-yellow-400", icon: "🔧", label: "Tool Call" },
    tool_result: { color: "bg-green-500/20 text-green-400", icon: "📥", label: "Tool Result" },
    response: { color: "bg-purple-500/20 text-purple-400", icon: "💬", label: "Response" }
};

export default function ObservabilityPage() {
    const [activeTab, setActiveTab] = useState("traces");
    const [tools, setTools] = useState<ToolsResponse | null>(null);
    const [traces, setTraces] = useState<TracesResponse | null>(null);
    const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
    const [loading, setLoading] = useState({ tools: true, traces: true });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

    const handleCopyTrace = useCallback(async () => {
        if (!selectedTrace) return;
        const text = formatTraceForCopy(selectedTrace);
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
    }, [selectedTrace]);

    const fetchTools = useCallback(async () => {
        try {
            const res = await fetch("/api/demos/live-agent-mcp/tools-list");
            const data = await res.json();
            setTools(data);
        } catch (error) {
            console.error("Failed to fetch tools:", error);
        } finally {
            setLoading((prev) => ({ ...prev, tools: false }));
        }
    }, []);

    const fetchTraces = useCallback(async () => {
        try {
            const res = await fetch("/api/demos/live-agent-mcp/traces");
            const data = await res.json();
            setTraces(data);
            // Update selected trace if it exists
            if (selectedTrace) {
                const updated = data.traces.find((t: Trace) => t.traceId === selectedTrace.traceId);
                if (updated) setSelectedTrace(updated);
            }
        } catch (error) {
            console.error("Failed to fetch traces:", error);
        } finally {
            setLoading((prev) => ({ ...prev, traces: false }));
        }
    }, [selectedTrace]);

    useEffect(() => {
        fetchTools();
        fetchTraces();
    }, [fetchTools, fetchTraces]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchTraces, 3000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchTraces]);

    return (
        <div className="container mx-auto space-y-6 py-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Voice Agent Observability</h1>
                    <p className="text-muted-foreground">
                        Full tracing: model, tools, reasoning, and execution steps
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={autoRefresh ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? "⏸ Auto-refresh" : "▶ Auto-refresh"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchTraces}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                {/* Agent Card with Edit Link */}
                <Card className="border-primary/50 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Active Agent</CardDescription>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <span className="truncate font-mono">
                                {traces?.traces[0]?.metadata.agentId || "mcp-agent"}
                            </span>
                            <a
                                href={`/agent/demos/agents/manage?agent=${traces?.traces[0]?.metadata.agentId || "mcp-agent"}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:bg-primary/20 rounded p-1 transition-colors"
                                title="Edit agent in new tab"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-primary"
                                >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </a>
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Conversations</CardDescription>
                        <CardTitle className="text-2xl">
                            {traces?.stats.totalTraces ?? "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Duration</CardDescription>
                        <CardTitle className="text-2xl">
                            {traces?.stats.avgDurationMs
                                ? `${(traces.stats.avgDurationMs / 1000).toFixed(1)}s`
                                : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Helpfulness</CardDescription>
                        <CardTitle className="text-2xl">
                            {traces?.stats.avgHelpfulness
                                ? `${(traces.stats.avgHelpfulness * 100).toFixed(0)}%`
                                : "-"}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Available Tools</CardDescription>
                        <CardTitle className="text-2xl">{tools?.totalTools ?? "-"}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Model</CardDescription>
                        <CardTitle className="truncate text-lg">
                            {traces?.stats.modelsUsed?.[0] || "gpt-4o-mini"}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Main Tabs */}
            <Tabs
                defaultValue="traces"
                value={activeTab}
                onValueChange={(v) => v && setActiveTab(v)}
            >
                <TabsList>
                    <TabsTrigger value="traces">Conversations</TabsTrigger>
                    <TabsTrigger value="detail">Trace Detail</TabsTrigger>
                    <TabsTrigger value="tools">All MCP Tools</TabsTrigger>
                </TabsList>

                {/* Traces Tab */}
                <TabsContent value="traces" className="space-y-4">
                    {loading.traces ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-24 w-full" />
                            ))}
                        </div>
                    ) : traces?.traces.length === 0 ? (
                        <Card>
                            <CardContent className="text-muted-foreground py-12 text-center">
                                <p className="text-lg">No conversations yet</p>
                                <p className="mt-2 text-sm">
                                    Talk to Grace in the Voice demo to see traces here
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {traces?.traces.map((trace) => (
                                <Card
                                    key={trace.traceId}
                                    className={`hover:bg-muted/50 cursor-pointer transition-all ${
                                        selectedTrace?.traceId === trace.traceId
                                            ? "ring-primary ring-2"
                                            : ""
                                    }`}
                                    onClick={() => {
                                        setSelectedTrace(trace);
                                        setActiveTab("detail");
                                    }}
                                >
                                    <CardContent className="py-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <p className="font-medium">{trace.input}</p>
                                                <p className="text-muted-foreground line-clamp-2 text-sm">
                                                    {trace.output}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {trace.model.name}
                                                    </Badge>
                                                    {trace.toolCalls.map((tc, i) => (
                                                        <Badge
                                                            key={i}
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
                                                            🔧 {tc.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <Badge>
                                                    {(trace.durationMs / 1000).toFixed(1)}s
                                                </Badge>
                                                {trace.scores.helpfulness && (
                                                    <span className="text-muted-foreground text-xs">
                                                        {(
                                                            trace.scores.helpfulness.score * 100
                                                        ).toFixed(0)}
                                                        % helpful
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(trace.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Detail Tab */}
                <TabsContent value="detail" className="space-y-4">
                    {selectedTrace ? (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {/* Left Column: Conversation & Metadata */}
                            <div className="space-y-4">
                                {/* Conversation */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle>Conversation</CardTitle>
                                                <CardDescription className="font-mono text-xs">
                                                    {selectedTrace.traceId}
                                                </CardDescription>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCopyTrace}
                                                className="shrink-0"
                                            >
                                                {copyStatus === "copied" ? "Copied!" : "Copy Trace"}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <p className="text-muted-foreground mb-1 text-sm font-medium">
                                                👤 User Input
                                            </p>
                                            <p className="bg-muted rounded-lg p-3">
                                                {selectedTrace.input}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground mb-1 text-sm font-medium">
                                                🤖 Agent Response
                                            </p>
                                            <p className="bg-primary/10 rounded-lg p-3">
                                                {selectedTrace.output}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Model & Config */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Model Configuration</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-muted-foreground text-sm">
                                                    Provider
                                                </p>
                                                <p className="font-mono">
                                                    {selectedTrace.model.provider}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-sm">
                                                    Model
                                                </p>
                                                <p className="font-mono">
                                                    {selectedTrace.model.name}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-sm">
                                                    Duration
                                                </p>
                                                <p className="font-mono">
                                                    {(selectedTrace.durationMs / 1000).toFixed(2)}s
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-sm">
                                                    Max Steps
                                                </p>
                                                <p className="font-mono">
                                                    {selectedTrace.metadata.maxSteps || 5}
                                                </p>
                                            </div>
                                            {selectedTrace.tokens && (
                                                <>
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Prompt Tokens
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedTrace.tokens.prompt}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">
                                                            Completion Tokens
                                                        </p>
                                                        <p className="font-mono">
                                                            {selectedTrace.tokens.completion}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Scores */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Evaluation Scores</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-sm">
                                                    Helpfulness
                                                </p>
                                                <p className="text-2xl font-bold">
                                                    {selectedTrace.scores.helpfulness
                                                        ? `${(selectedTrace.scores.helpfulness.score * 100).toFixed(0)}%`
                                                        : "-"}
                                                </p>
                                                {selectedTrace.scores.helpfulness?.reasoning && (
                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                        {selectedTrace.scores.helpfulness.reasoning}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-sm">
                                                    Relevancy
                                                </p>
                                                <p className="text-2xl font-bold">
                                                    {selectedTrace.scores.relevancy
                                                        ? `${(selectedTrace.scores.relevancy.score * 100).toFixed(0)}%`
                                                        : "Pending..."}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Execution Steps */}
                            <div className="space-y-4">
                                {/* Execution Timeline */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Execution Timeline</CardTitle>
                                        <CardDescription>
                                            Step-by-step agent reasoning and tool usage
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {selectedTrace.steps.map((step) => (
                                                <div
                                                    key={step.step}
                                                    className={`rounded-lg p-3 ${stepConfig[step.type]?.color || "bg-muted"}`}
                                                >
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <span>{stepConfig[step.type]?.icon}</span>
                                                        <span className="text-sm font-medium">
                                                            Step {step.step}:{" "}
                                                            {stepConfig[step.type]?.label}
                                                        </span>
                                                        <span className="ml-auto text-xs opacity-60">
                                                            {new Date(
                                                                step.timestamp
                                                            ).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm">{step.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Tool Calls Detail */}
                                {selectedTrace.toolCalls.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                Tool Calls ({selectedTrace.toolCalls.length})
                                            </CardTitle>
                                            <CardDescription>
                                                Detailed input/output for each tool
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Accordion className="w-full">
                                                {selectedTrace.toolCalls.map((tc, i) => (
                                                    <AccordionItem key={i} value={`tool-${i}`}>
                                                        <AccordionTrigger className="hover:no-underline">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`h-2 w-2 rounded-full ${tc.success ? "bg-green-500" : "bg-red-500"}`}
                                                                />
                                                                <span className="font-mono text-sm">
                                                                    {tc.name}
                                                                </span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                                                                        INPUT
                                                                    </p>
                                                                    <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                                                                        {JSON.stringify(
                                                                            tc.input,
                                                                            null,
                                                                            2
                                                                        )}
                                                                    </pre>
                                                                </div>
                                                                <div>
                                                                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                                                                        OUTPUT
                                                                    </p>
                                                                    <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs">
                                                                        {typeof tc.output ===
                                                                        "string"
                                                                            ? tc.output
                                                                            : JSON.stringify(
                                                                                  tc.output,
                                                                                  null,
                                                                                  2
                                                                              )}
                                                                    </pre>
                                                                </div>
                                                                {tc.error && (
                                                                    <div>
                                                                        <p className="mb-1 text-xs font-medium text-red-400">
                                                                            ERROR
                                                                        </p>
                                                                        <p className="text-sm text-red-400">
                                                                            {tc.error}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Available Tools */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Available Tools ({selectedTrace.availableTools.length})
                                        </CardTitle>
                                        <CardDescription>
                                            Tools the agent could have used
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex max-h-40 flex-wrap gap-1 overflow-auto">
                                            {selectedTrace.availableTools.map((tool) => (
                                                <Badge
                                                    key={tool}
                                                    variant={
                                                        selectedTrace.toolCalls.some(
                                                            (tc) => tc.name === tool
                                                        )
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    className="text-xs"
                                                >
                                                    {tool}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="text-muted-foreground py-12 text-center">
                                <p className="text-lg">Select a conversation to see details</p>
                                <p className="mt-2 text-sm">
                                    Click on any trace in the Conversations tab
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Tools Tab */}
                <TabsContent value="tools" className="space-y-4">
                    {loading.tools ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} className="h-32 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {tools?.servers.map((server) => (
                                <Card key={server.name}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg capitalize">
                                                {server.name}
                                            </CardTitle>
                                            <Badge>{server.toolCount} tools</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion>
                                            <AccordionItem value="tools" className="border-0">
                                                <AccordionTrigger className="py-2 text-sm">
                                                    View tools
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <ul className="max-h-60 space-y-2 overflow-auto">
                                                        {server.tools.map((tool) => (
                                                            <li key={tool.name} className="text-sm">
                                                                <p className="text-primary font-mono text-xs">
                                                                    {tool.name}
                                                                </p>
                                                                {tool.description && (
                                                                    <p className="text-muted-foreground line-clamp-2 text-xs">
                                                                        {tool.description}
                                                                    </p>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
