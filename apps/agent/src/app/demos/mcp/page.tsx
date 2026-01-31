"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Textarea
} from "@repo/ui";

interface ToolCall {
    toolName: string;
    args?: unknown;
}

interface McpResult {
    text?: string;
    toolCalls?: ToolCall[];
    error?: string;
}

export default function McpDemoPage() {
    const [query, setQuery] = useState("What is the history of artificial intelligence?");
    const [result, setResult] = useState<McpResult | null>(null);
    const [loading, setLoading] = useState(false);

    const handleQuery = async () => {
        setLoading(true);
        try {
            const res = await fetch("/agent/api/mcp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: query })
            });
            const data = await res.json();
            setResult(data);
        } catch {
            setResult({ error: "Failed to query MCP agent" });
        }
        setLoading(false);
    };

    const examples = [
        {
            query: "What is the history of artificial intelligence?",
            description: "Wikipedia search for AI history"
        },
        {
            query: "Who invented the telephone?",
            description: "Wikipedia article lookup"
        },
        {
            query: "Help me think through the steps to launch a startup",
            description: "Sequential thinking"
        }
    ];

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">MCP Demo</h1>
            <p className="text-muted-foreground mb-8">
                Use external tools via Model Context Protocol servers (Wikipedia, Sequential
                Thinking).
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Query MCP Agent</CardTitle>
                            <CardDescription>
                                The agent has access to Wikipedia and Sequential Thinking tools.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Query</label>
                                <Textarea
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    rows={3}
                                    placeholder="Ask a question..."
                                />
                            </div>
                            <Button onClick={handleQuery} disabled={loading}>
                                {loading ? "Querying..." : "Send Query"}
                            </Button>

                            {result && (
                                <div className="mt-4 space-y-4">
                                    {result.text && (
                                        <div className="bg-primary/5 rounded-md p-4">
                                            <h4 className="mb-2 font-medium">Response:</h4>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {result.text}
                                            </p>
                                        </div>
                                    )}
                                    {result.toolCalls && result.toolCalls.length > 0 && (
                                        <div className="bg-muted rounded-md p-4">
                                            <h4 className="mb-2 font-medium">Tool Calls:</h4>
                                            {result.toolCalls.map((call, i) => (
                                                <div key={i} className="mb-2 text-sm">
                                                    <span className="text-primary font-mono">
                                                        {call.toolName}
                                                    </span>
                                                    <pre className="bg-background mt-1 overflow-auto rounded p-2 text-xs">
                                                        {JSON.stringify(call.args, null, 2)}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {result.error && (
                                        <div className="bg-destructive/10 text-destructive rounded-md p-4">
                                            {result.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Example Queries</CardTitle>
                            <CardDescription>
                                Try these examples to see MCP in action.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {examples.map((ex, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setQuery(ex.query)}
                                        className="hover:bg-muted w-full rounded-md border p-3 text-left transition-colors"
                                    >
                                        <p className="text-sm font-medium">{ex.query}</p>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {ex.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Available MCP Tools</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm">
                                <div className="bg-muted rounded-md p-3">
                                    <p className="font-medium">Wikipedia</p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        Search and retrieve Wikipedia articles
                                    </p>
                                </div>
                                <div className="bg-muted rounded-md p-3">
                                    <p className="font-medium">Sequential Thinking</p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        Break down complex problems step by step
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
