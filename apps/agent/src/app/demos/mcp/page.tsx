"use client";

import { useState, useEffect } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea,
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@repo/ui";

// Types matching the API responses
interface McpStep {
    stepNumber: number;
    type: "tool-call" | "text" | "tool-result";
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
    text?: string;
    finishReason?: string;
    timestamp: number;
}

interface McpResponse {
    text: string;
    steps: McpStep[];
    toolCalls: Array<{ toolName: string; args: unknown }>;
    toolResults: Array<{ toolName: string; result: unknown }>;
    reasoning?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason: string;
    error?: string;
}

interface McpToolInfo {
    name: string;
    description: string;
    serverId: string;
    inputSchema?: unknown;
}

interface McpServerStatus {
    id: string;
    name: string;
    description: string;
    category: string;
    status: "connected" | "disconnected" | "error" | "missing_config";
    tools: McpToolInfo[];
    error?: string;
    requiresAuth: boolean;
    missingEnvVars?: string[];
}

interface McpStatusResponse {
    servers: McpServerStatus[];
    totalTools: number;
    connectedServers: number;
    timestamp: number;
}

// Status badge component
function StatusBadge({ status }: { status: McpServerStatus["status"] }) {
    const variants: Record<McpServerStatus["status"], { label: string; className: string }> = {
        connected: {
            label: "Connected",
            className: "bg-green-500/10 text-green-600 border-green-500/20"
        },
        disconnected: {
            label: "Disconnected",
            className: "bg-gray-500/10 text-gray-600 border-gray-500/20"
        },
        error: { label: "Error", className: "bg-red-500/10 text-red-600 border-red-500/20" },
        missing_config: {
            label: "Missing Config",
            className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
        }
    };

    const variant = variants[status];
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variant.className}`}
        >
            {variant.label}
        </span>
    );
}

// Category badge component
function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
        knowledge: "bg-blue-500/10 text-blue-600",
        web: "bg-purple-500/10 text-purple-600",
        crm: "bg-orange-500/10 text-orange-600",
        productivity: "bg-green-500/10 text-green-600",
        communication: "bg-pink-500/10 text-pink-600",
        automation: "bg-cyan-500/10 text-cyan-600"
    };

    return (
        <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[category] || "bg-gray-500/10 text-gray-600"}`}
        >
            {category}
        </span>
    );
}

// Step visualization component
function ExecutionStep({ step }: { step: McpStep }) {
    const [isOpen, setIsOpen] = useState(false);

    const getStepIcon = () => {
        switch (step.type) {
            case "tool-call":
                return "🔧";
            case "tool-result":
                return "📥";
            case "text":
                return "💬";
            default:
                return "•";
        }
    };

    const getStepColor = () => {
        switch (step.type) {
            case "tool-call":
                return "border-l-blue-500 bg-blue-500/5";
            case "tool-result":
                return "border-l-green-500 bg-green-500/5";
            case "text":
                return "border-l-purple-500 bg-purple-500/5";
            default:
                return "border-l-gray-500 bg-gray-500/5";
        }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full">
                <div
                    className={`hover:bg-muted/50 flex items-center gap-3 rounded-md border-l-4 p-3 transition-colors ${getStepColor()}`}
                >
                    <span className="text-lg">{getStepIcon()}</span>
                    <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-medium">
                                Step {step.stepNumber}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {step.type}
                            </Badge>
                            {step.toolName && (
                                <code className="text-primary bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                                    {step.toolName}
                                </code>
                            )}
                        </div>
                        {step.text && (
                            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                                {step.text.substring(0, 100)}...
                            </p>
                        )}
                    </div>
                    <svg
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="bg-muted/30 mt-2 ml-8 rounded-md border p-3">
                    {step.toolArgs !== undefined && (
                        <div className="mb-3">
                            <p className="text-muted-foreground mb-1 text-xs font-medium">
                                Input Arguments:
                            </p>
                            <pre className="bg-background overflow-auto rounded p-2 text-xs">
                                {JSON.stringify(step.toolArgs, null, 2)}
                            </pre>
                        </div>
                    )}
                    {step.toolResult !== undefined && (
                        <div className="mb-3">
                            <p className="text-muted-foreground mb-1 text-xs font-medium">
                                Result:
                            </p>
                            <pre className="bg-background max-h-64 overflow-auto rounded p-2 text-xs">
                                {typeof step.toolResult === "string"
                                    ? step.toolResult
                                    : JSON.stringify(step.toolResult, null, 2)}
                            </pre>
                        </div>
                    )}
                    {step.text && (
                        <div>
                            <p className="text-muted-foreground mb-1 text-xs font-medium">Text:</p>
                            <p className="text-sm whitespace-pre-wrap">{step.text}</p>
                        </div>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function McpDemoPage() {
    const [query, setQuery] = useState("What is the history of artificial intelligence?");
    const [result, setResult] = useState<McpResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [serverStatus, setServerStatus] = useState<McpStatusResponse | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [selectedServer, setSelectedServer] = useState<string | null>(null);

    // Fetch MCP server status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/mcp/status");
                if (res.ok) {
                    const data = await res.json();
                    setServerStatus(data);
                }
            } catch (error) {
                console.error("Failed to fetch MCP status:", error);
            } finally {
                setStatusLoading(false);
            }
        };

        fetchStatus();
    }, []);

    const handleQuery = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/mcp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: query, maxSteps: 10 })
            });
            const data = await res.json();
            setResult(data);
        } catch {
            setResult({
                text: "",
                steps: [],
                toolCalls: [],
                toolResults: [],
                finishReason: "error",
                error: "Failed to query MCP agent"
            });
        }
        setLoading(false);
    };

    const examples = [
        {
            query: "What is the history of artificial intelligence?",
            description: "Wikipedia search",
            server: "wikipedia"
        },
        {
            query: "Scrape the content from https://example.com",
            description: "Firecrawl web scraping",
            server: "firecrawl"
        },
        {
            query: "Get my recent HubSpot contacts",
            description: "HubSpot CRM lookup",
            server: "hubspot"
        },
        {
            query: "Show me my recent Jira issues",
            description: "Jira issue search",
            server: "jira"
        },
        {
            query: "What meetings did I have this week?",
            description: "Fathom meeting lookup",
            server: "fathom"
        },
        {
            query: "Navigate to https://example.com and take a screenshot",
            description: "Playwright browser automation",
            server: "playwright"
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">MCP Demo</h1>
                <p className="text-muted-foreground">
                    Model Context Protocol (MCP) enables agents to use external tools. This demo
                    shows how agents connect to MCP servers and execute tools with full visibility
                    into the execution chain.
                </p>
            </div>

            {/* Server Status Overview */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">MCP Servers</CardTitle>
                            <CardDescription>Connected servers and available tools</CardDescription>
                        </div>
                        {serverStatus && (
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                    <span className="text-foreground font-medium">
                                        {serverStatus.connectedServers}
                                    </span>
                                    /{serverStatus.servers.length} servers connected
                                </span>
                                <span className="text-muted-foreground">
                                    <span className="text-foreground font-medium">
                                        {serverStatus.totalTools}
                                    </span>{" "}
                                    tools available
                                </span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {statusLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                        </div>
                    ) : serverStatus ? (
                        <Accordion
                            value={selectedServer ? [selectedServer] : []}
                            onValueChange={(value) => setSelectedServer(value[0] ?? null)}
                        >
                            <div className="grid gap-2">
                                {serverStatus.servers.map((server) => (
                                    <AccordionItem
                                        key={server.id}
                                        value={server.id}
                                        className="rounded-lg border"
                                    >
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                            <div className="flex flex-1 items-center gap-3">
                                                <div className="flex-1 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {server.name}
                                                        </span>
                                                        <CategoryBadge category={server.category} />
                                                        <StatusBadge status={server.status} />
                                                    </div>
                                                    <p className="text-muted-foreground mt-0.5 text-sm">
                                                        {server.description}
                                                    </p>
                                                </div>
                                                <span className="text-muted-foreground text-sm">
                                                    {server.tools.length} tools
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="px-4 pb-3">
                                                {server.error && (
                                                    <div className="bg-destructive/10 text-destructive mb-3 rounded-md p-2 text-sm">
                                                        {server.error}
                                                    </div>
                                                )}
                                                {server.tools.length > 0 ? (
                                                    <div className="grid gap-2">
                                                        {server.tools.map((tool) => (
                                                            <div
                                                                key={tool.name}
                                                                className="bg-muted/30 rounded-md border p-2"
                                                            >
                                                                <code className="text-primary font-mono text-sm">
                                                                    {server.id}_{tool.name}
                                                                </code>
                                                                <p className="text-muted-foreground mt-1 text-xs">
                                                                    {tool.description}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground text-sm">
                                                        No tools available.{" "}
                                                        {server.status === "missing_config"
                                                            ? "Configure the required environment variables to enable this server."
                                                            : "Server may not be running."}
                                                    </p>
                                                )}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </div>
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground py-4 text-center">
                            Failed to load server status
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Query Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    {/* Query Input */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Query Agent</CardTitle>
                            <CardDescription>
                                Ask a question and watch the agent use MCP tools to find the answer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                rows={3}
                                placeholder="Ask a question..."
                                className="resize-none"
                            />
                            <div className="flex items-center gap-4">
                                <Button onClick={handleQuery} disabled={loading || !query.trim()}>
                                    {loading ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                                            Processing...
                                        </>
                                    ) : (
                                        "Run Query"
                                    )}
                                </Button>
                                {result && (
                                    <span className="text-muted-foreground text-sm">
                                        {result.steps.length} steps executed
                                        {result.usage && ` • ${result.usage.totalTokens} tokens`}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Execution Chain */}
                    {result && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    Execution Chain
                                    <Badge variant={result.error ? "destructive" : "default"}>
                                        {result.finishReason}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Step-by-step visualization of how the agent processed your
                                    query.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {result.error && (
                                    <div className="bg-destructive/10 text-destructive mb-4 rounded-md p-3">
                                        <p className="font-medium">Error</p>
                                        <p className="text-sm">{result.error}</p>
                                    </div>
                                )}

                                {result.steps.length > 0 ? (
                                    <div className="space-y-2">
                                        {result.steps.map((step, index) => (
                                            <ExecutionStep key={index} step={step} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground py-4 text-center">
                                        No execution steps recorded.
                                    </p>
                                )}

                                {/* Final Response */}
                                {result.text && (
                                    <div className="bg-primary/5 mt-6 rounded-lg border p-4">
                                        <p className="mb-2 text-sm font-medium">Final Response:</p>
                                        <p className="text-sm whitespace-pre-wrap">{result.text}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Examples Sidebar */}
                <div>
                    <Card className="sticky top-4">
                        <CardHeader>
                            <CardTitle>Example Queries</CardTitle>
                            <CardDescription>Click to try these examples.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {examples.map((ex, i) => {
                                    const server = serverStatus?.servers.find(
                                        (s) => s.id === ex.server
                                    );
                                    const isAvailable = server?.status === "connected";

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setQuery(ex.query)}
                                            disabled={loading}
                                            className={`w-full rounded-md border p-3 text-left transition-colors ${
                                                isAvailable ? "hover:bg-muted" : "opacity-50"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <p className="text-sm leading-tight font-medium">
                                                        {ex.query}
                                                    </p>
                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                        {ex.description}
                                                    </p>
                                                </div>
                                                {!isAvailable && (
                                                    <span className="text-xs text-yellow-600">
                                                        Not configured
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
