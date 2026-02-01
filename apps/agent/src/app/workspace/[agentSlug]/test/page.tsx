"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Textarea,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    durationMs?: number;
    toolCalls?: string[];
    tokens?: number;
}

interface TestCase {
    id: string;
    name: string;
    input: string;
    expectedOutput?: string;
    lastResult?: {
        passed: boolean;
        output: string;
        timestamp: string;
    };
}

const mockTestCases: TestCase[] = [
    {
        id: "tc-1",
        name: "Weather Query",
        input: "What's the weather in New York?",
        expectedOutput: "weather information",
        lastResult: {
            passed: true,
            output: "The weather in New York is...",
            timestamp: new Date().toISOString()
        }
    },
    {
        id: "tc-2",
        name: "Math Calculation",
        input: "Calculate 15% of 250",
        expectedOutput: "37.5",
        lastResult: {
            passed: true,
            output: "15% of 250 is 37.5",
            timestamp: new Date().toISOString()
        }
    },
    {
        id: "tc-3",
        name: "Error Handling",
        input: "Search for [invalid query]",
        expectedOutput: "error message",
        lastResult: {
            passed: false,
            output: "Unexpected response format",
            timestamp: new Date().toISOString()
        }
    }
];

export default function TestPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState("chat");

    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");

    // Context injection
    const [contextVars, setContextVars] = useState({
        userId: "user-123",
        userName: "Test User",
        userEmail: "test@example.com"
    });

    // Test cases
    const [testCases] = useState<TestCase[]>(mockTestCases);
    const [runningTests, setRunningTests] = useState(false);

    useEffect(() => {
        setTimeout(() => setLoading(false), 500);
    }, [agentSlug]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!inputValue.trim() || sending) return;

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: "user",
            content: inputValue,
            timestamp: new Date().toISOString()
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setSending(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));

        const assistantMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: `This is a simulated response to: "${userMessage.content}"\n\nIn a real implementation, this would call your agent API and stream the response.`,
            timestamp: new Date().toISOString(),
            durationMs: 1500 + Math.floor(Math.random() * 1500),
            toolCalls: Math.random() > 0.5 ? ["web-search"] : [],
            tokens: 150 + Math.floor(Math.random() * 200)
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setSending(false);
    };

    const clearChat = () => {
        setMessages([]);
    };

    const runAllTests = async () => {
        setRunningTests(true);
        // Simulate running tests
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setRunningTests(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Testing Sandbox</h1>
                    <p className="text-muted-foreground">
                        Interactive testing and regression suites
                    </p>
                </div>
            </div>

            <Tabs defaultValue="chat" value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
                <TabsList>
                    <TabsTrigger value="chat">Interactive Chat</TabsTrigger>
                    <TabsTrigger value="cases">Test Cases</TabsTrigger>
                    <TabsTrigger value="comparison">A/B Comparison</TabsTrigger>
                </TabsList>

                {/* Interactive Chat Tab */}
                <TabsContent value="chat">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                        {/* Chat Panel */}
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Chat Test</CardTitle>
                                        <CardDescription>
                                            Multi-turn conversation testing
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={clearChat}>
                                        Clear Chat
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Messages */}
                                <div className="bg-muted/30 mb-4 h-[400px] space-y-4 overflow-y-auto rounded-lg p-4">
                                    {messages.length === 0 ? (
                                        <div className="text-muted-foreground py-12 text-center">
                                            <p>Start a conversation to test the agent</p>
                                            <p className="mt-2 text-sm">
                                                Messages will appear here
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg p-3 ${
                                                        msg.role === "user"
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted"
                                                    }`}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap">
                                                        {msg.content}
                                                    </p>
                                                    {msg.role === "assistant" && (
                                                        <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
                                                            {msg.durationMs && (
                                                                <span>
                                                                    {(
                                                                        msg.durationMs / 1000
                                                                    ).toFixed(1)}
                                                                    s
                                                                </span>
                                                            )}
                                                            {msg.tokens && (
                                                                <span>• {msg.tokens} tokens</span>
                                                            )}
                                                            {msg.toolCalls &&
                                                                msg.toolCalls.length > 0 && (
                                                                    <span>
                                                                        • 🔧{" "}
                                                                        {msg.toolCalls.join(", ")}
                                                                    </span>
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {sending && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-lg p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-primary h-2 w-2 animate-bounce rounded-full" />
                                                    <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:0.1s]" />
                                                    <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:0.2s]" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="flex gap-2">
                                    <Textarea
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }}
                                        placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
                                        rows={2}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={sendMessage}
                                        disabled={sending || !inputValue.trim()}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Context Panel */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Context Injection</CardTitle>
                                <CardDescription>Template variables</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-muted-foreground text-sm">User ID</label>
                                    <Input
                                        value={contextVars.userId}
                                        onChange={(e) =>
                                            setContextVars((p) => ({
                                                ...p,
                                                userId: e.target.value
                                            }))
                                        }
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-muted-foreground text-sm">
                                        User Name
                                    </label>
                                    <Input
                                        value={contextVars.userName}
                                        onChange={(e) =>
                                            setContextVars((p) => ({
                                                ...p,
                                                userName: e.target.value
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-muted-foreground text-sm">
                                        User Email
                                    </label>
                                    <Input
                                        value={contextVars.userEmail}
                                        onChange={(e) =>
                                            setContextVars((p) => ({
                                                ...p,
                                                userEmail: e.target.value
                                            }))
                                        }
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="w-full">
                                    + Add Variable
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Test Cases Tab */}
                <TabsContent value="cases">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Test Cases</CardTitle>
                                    <CardDescription>
                                        Saved test scenarios for regression testing
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline">+ Add Test Case</Button>
                                    <Button onClick={runAllTests} disabled={runningTests}>
                                        {runningTests ? "Running..." : "Run All Tests"}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {testCases.map((tc) => (
                                    <div
                                        key={tc.id}
                                        className="flex items-start gap-4 rounded-lg border p-4"
                                    >
                                        <div
                                            className={`mt-1.5 h-3 w-3 rounded-full ${
                                                tc.lastResult?.passed
                                                    ? "bg-green-500"
                                                    : "bg-red-500"
                                            }`}
                                        />
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <p className="font-medium">{tc.name}</p>
                                                <Badge
                                                    variant={
                                                        tc.lastResult?.passed
                                                            ? "default"
                                                            : "destructive"
                                                    }
                                                >
                                                    {tc.lastResult?.passed ? "Passed" : "Failed"}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                        Input
                                                    </p>
                                                    <p className="bg-muted rounded p-2 text-sm">
                                                        {tc.input}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                        Expected Contains
                                                    </p>
                                                    <p className="bg-muted rounded p-2 text-sm">
                                                        {tc.expectedOutput}
                                                    </p>
                                                </div>
                                            </div>
                                            {tc.lastResult && (
                                                <div className="mt-2">
                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                        Last Output
                                                    </p>
                                                    <p className="bg-muted line-clamp-2 rounded p-2 text-sm">
                                                        {tc.lastResult.output}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <Button variant="ghost" size="sm">
                                                Run
                                            </Button>
                                            <Button variant="ghost" size="sm">
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* A/B Comparison Tab */}
                <TabsContent value="comparison">
                    <Card>
                        <CardHeader>
                            <CardTitle>A/B Comparison</CardTitle>
                            <CardDescription>
                                Compare responses between versions or configurations
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                {/* Version A */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium">Version A (Current)</h3>
                                        <Badge>v4</Badge>
                                    </div>
                                    <div className="bg-muted min-h-[200px] rounded-lg p-4">
                                        <p className="text-muted-foreground text-sm">
                                            Response will appear here...
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Latency</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Tokens</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Quality</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Version B */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium">Version B</h3>
                                        <select className="rounded border px-2 py-1 text-sm">
                                            <option>v3</option>
                                            <option>v2</option>
                                            <option>v1</option>
                                        </select>
                                    </div>
                                    <div className="bg-muted min-h-[200px] rounded-lg p-4">
                                        <p className="text-muted-foreground text-sm">
                                            Response will appear here...
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Latency</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Tokens</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                        <div className="bg-muted rounded p-2">
                                            <p className="text-muted-foreground text-xs">Quality</p>
                                            <p className="font-mono">-</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <Textarea placeholder="Enter test prompt to compare..." rows={3} />
                                <Button className="w-full">Run Comparison</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
