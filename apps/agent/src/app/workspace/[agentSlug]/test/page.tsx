"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { ToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
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
    Textarea,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
    Message,
    MessageContent,
    MessageResponse,
    MessageActions,
    MessageAction,
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
    Tool,
    ToolHeader,
    ToolContent,
    ToolInput,
    ToolOutput,
    Loader
} from "@repo/ui";
import {
    MessageSquareIcon,
    CopyIcon,
    RefreshCwIcon,
    TrashIcon,
    ThumbsUpIcon,
    ThumbsDownIcon
} from "lucide-react";
import { useFeedback, extractRunIdFromMessage } from "@/hooks/useFeedback";
import { cn } from "@/lib/utils";

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

export default function TestPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("chat");
    const [input, setInput] = useState("");

    // Thread management for isolated test sessions
    const [threadId, setThreadId] = useState<string>(() => `test-${agentSlug}-${Date.now()}`);

    // Context injection
    const [contextVars, setContextVars] = useState({
        userId: "user-123",
        userName: "Test User",
        userEmail: "test@example.com"
    });

    // Test cases
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [runningTests, setRunningTests] = useState(false);
    const [runningTestId, setRunningTestId] = useState<string | null>(null);

    // Use the AI SDK's useChat hook for streaming
    const { messages, setMessages, append, status, reload, stop } = useChat({
        api: `${getApiBase()}/api/agents/${agentSlug}/chat`,
        body: {
            threadId,
            requestContext: contextVars
        }
    });

    const visibleMessages = messages.filter(
        (
            message
        ): message is (typeof messages)[number] & {
            role: "user" | "assistant" | "system";
        } => message.role !== "data"
    );

    // Feedback hook for thumbs up/down on assistant messages
    const { getFeedback, submitFeedback } = useFeedback({ agentSlug });

    // Fetch test cases from API
    const fetchTestCases = useCallback(async () => {
        try {
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/test-cases`);
            const result = await response.json();
            if (result.success) {
                setTestCases(
                    result.testCases.map(
                        (tc: {
                            id: string;
                            name: string;
                            inputText: string;
                            expectedOutput?: string;
                            lastRun?: { passed: boolean; createdAt: string };
                        }) => ({
                            id: tc.id,
                            name: tc.name,
                            input: tc.inputText,
                            expectedOutput: tc.expectedOutput,
                            lastResult: tc.lastRun
                                ? {
                                      passed: tc.lastRun.passed,
                                      output: "",
                                      timestamp: tc.lastRun.createdAt
                                  }
                                : undefined
                        })
                    )
                );
            }
        } catch (error) {
            console.error("Failed to fetch test cases:", error);
        }
    }, [agentSlug]);

    useEffect(() => {
        const init = async () => {
            await fetchTestCases();
            setLoading(false);
        };
        init();
    }, [fetchTestCases]);

    const handleSubmit = async () => {
        if (!input.trim() || status !== "ready") return;
        await append({ role: "user", content: input });
        setInput("");
    };

    const handleClearChat = () => {
        setMessages([]);
        // Create a new thread for fresh conversation
        setThreadId(`test-${agentSlug}-${Date.now()}`);
    };

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const runSingleTest = async (testCase: TestCase) => {
        setRunningTestId(testCase.id);
        try {
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: testCase.input,
                    requestContext: contextVars
                })
            });

            const result = await response.json();
            const output = result.success ? result.response.text : result.error;
            const passed = testCase.expectedOutput
                ? output.toLowerCase().includes(testCase.expectedOutput.toLowerCase())
                : result.success;

            setTestCases((prev) =>
                prev.map((tc) =>
                    tc.id === testCase.id
                        ? {
                              ...tc,
                              lastResult: {
                                  passed,
                                  output,
                                  timestamp: new Date().toISOString()
                              }
                          }
                        : tc
                )
            );
        } catch (error) {
            setTestCases((prev) =>
                prev.map((tc) =>
                    tc.id === testCase.id
                        ? {
                              ...tc,
                              lastResult: {
                                  passed: false,
                                  output:
                                      error instanceof Error
                                          ? error.message
                                          : "Test execution failed",
                                  timestamp: new Date().toISOString()
                              }
                          }
                        : tc
                )
            );
        } finally {
            setRunningTestId(null);
        }
    };

    const runAllTests = async () => {
        setRunningTests(true);
        for (const testCase of testCases) {
            await runSingleTest(testCase);
        }
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
                        <Card className="flex flex-col lg:col-span-3">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Chat Test</CardTitle>
                                        <CardDescription>
                                            Multi-turn conversation testing with streaming
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {status === "streaming" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => stop()}
                                            >
                                                Stop
                                            </Button>
                                        )}
                                        <Button
                                            data-testid="clear-chat"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleClearChat}
                                        >
                                            <TrashIcon className="mr-1 size-4" />
                                            Clear Chat
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col">
                                {/* Conversation using AI SDK components */}
                                <Conversation className="flex-1">
                                    <ConversationContent
                                        data-testid="messages-container"
                                        className="min-h-[400px]"
                                    >
                                        {visibleMessages.length === 0 ? (
                                            <ConversationEmptyState
                                                icon={<MessageSquareIcon className="size-12" />}
                                                title="Start a conversation"
                                                description="Send a message to test the agent's responses. Messages are streamed in real-time."
                                            />
                                        ) : (
                                            visibleMessages.map((message, messageIndex) => (
                                                <div key={message.id} className="space-y-2">
                                                    {message.parts?.map((part, i) => {
                                                        // Handle text messages
                                                        if (part.type === "text") {
                                                            const isLastAssistantMessage =
                                                                message.role === "assistant" &&
                                                                messageIndex ===
                                                                    visibleMessages.length - 1;

                                                            return (
                                                                <Message
                                                                    key={`${message.id}-${i}`}
                                                                    from={message.role}
                                                                    data-testid={
                                                                        message.role === "user"
                                                                            ? "user-message"
                                                                            : "assistant-message"
                                                                    }
                                                                >
                                                                    <MessageContent>
                                                                        <MessageResponse>
                                                                            {part.text}
                                                                        </MessageResponse>
                                                                    </MessageContent>
                                                                    {isLastAssistantMessage &&
                                                                        status === "ready" && (
                                                                            <MessageActions>
                                                                                <MessageAction
                                                                                    tooltip="Copy"
                                                                                    onClick={() =>
                                                                                        handleCopyMessage(
                                                                                            part.text
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <CopyIcon className="size-3" />
                                                                                </MessageAction>
                                                                                <MessageAction
                                                                                    tooltip="Regenerate"
                                                                                    onClick={() =>
                                                                                        reload()
                                                                                    }
                                                                                >
                                                                                    <RefreshCwIcon className="size-3" />
                                                                                </MessageAction>
                                                                                {/* Feedback buttons */}
                                                                                {(() => {
                                                                                    const runId =
                                                                                        extractRunIdFromMessage(
                                                                                            message
                                                                                        );
                                                                                    if (!runId)
                                                                                        return null;
                                                                                    const feedback =
                                                                                        getFeedback(
                                                                                            runId
                                                                                        );
                                                                                    return (
                                                                                        <>
                                                                                            <MessageAction
                                                                                                data-testid="feedback-thumbs-up"
                                                                                                tooltip="Helpful"
                                                                                                onClick={() =>
                                                                                                    submitFeedback(
                                                                                                        runId,
                                                                                                        true
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    feedback.isSubmitting
                                                                                                }
                                                                                            >
                                                                                                <ThumbsUpIcon
                                                                                                    className={cn(
                                                                                                        "size-3",
                                                                                                        feedback.value ===
                                                                                                            true &&
                                                                                                            "text-green-500"
                                                                                                    )}
                                                                                                />
                                                                                            </MessageAction>
                                                                                            <MessageAction
                                                                                                data-testid="feedback-thumbs-down"
                                                                                                tooltip="Not helpful"
                                                                                                onClick={() =>
                                                                                                    submitFeedback(
                                                                                                        runId,
                                                                                                        false
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    feedback.isSubmitting
                                                                                                }
                                                                                            >
                                                                                                <ThumbsDownIcon
                                                                                                    className={cn(
                                                                                                        "size-3",
                                                                                                        feedback.value ===
                                                                                                            false &&
                                                                                                            "text-red-500"
                                                                                                    )}
                                                                                                />
                                                                                            </MessageAction>
                                                                                        </>
                                                                                    );
                                                                                })()}
                                                                            </MessageActions>
                                                                        )}
                                                                </Message>
                                                            );
                                                        }

                                                        // Handle tool invocations
                                                        if (part.type?.startsWith("tool-")) {
                                                            const toolPart =
                                                                part as unknown as ToolUIPart;

                                                            // Hide internal memory management tools from the UI
                                                            const internalTools = [
                                                                "updateWorkingMemory",
                                                                "getWorkingMemory"
                                                            ];
                                                            const toolName =
                                                                toolPart.type?.replace(
                                                                    "tool-",
                                                                    ""
                                                                ) || "";
                                                            if (internalTools.includes(toolName)) {
                                                                return null;
                                                            }

                                                            return (
                                                                <Tool
                                                                    key={`${message.id}-${i}`}
                                                                    defaultOpen={
                                                                        toolPart.state ===
                                                                        "output-error"
                                                                    }
                                                                >
                                                                    <ToolHeader
                                                                        type={toolPart.type}
                                                                        state={
                                                                            toolPart.state ||
                                                                            "output-available"
                                                                        }
                                                                    />
                                                                    <ToolContent>
                                                                        <ToolInput
                                                                            input={toolPart.input}
                                                                        />
                                                                        <ToolOutput
                                                                            output={
                                                                                toolPart.output
                                                                                    ? JSON.stringify(
                                                                                          toolPart.output,
                                                                                          null,
                                                                                          2
                                                                                      )
                                                                                    : undefined
                                                                            }
                                                                            errorText={
                                                                                toolPart.errorText
                                                                            }
                                                                        />
                                                                    </ToolContent>
                                                                </Tool>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </div>
                                            ))
                                        )}

                                        {/* Loading indicator for streaming */}
                                        {(status === "submitted" || status === "streaming") &&
                                            !messages.some(
                                                (m) =>
                                                    m.role === "assistant" &&
                                                    m.parts?.some(
                                                        (p) => p.type === "text" && p.text
                                                    )
                                            ) && <Loader data-testid="sending-indicator" />}
                                    </ConversationContent>
                                    <ConversationScrollButton />
                                </Conversation>

                                {/* Prompt Input using AI SDK components */}
                                <PromptInput onSubmit={handleSubmit} className="mt-4 border-t pt-4">
                                    <PromptInputBody>
                                        <PromptInputTextarea
                                            data-testid="chat-input"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                                            disabled={status !== "ready"}
                                        />
                                    </PromptInputBody>
                                    <PromptInputFooter>
                                        <div className="text-muted-foreground text-xs">
                                            {status === "streaming" && (
                                                <span className="text-primary animate-pulse">
                                                    Streaming response...
                                                </span>
                                            )}
                                            {status === "submitted" && (
                                                <span className="text-muted-foreground">
                                                    Processing...
                                                </span>
                                            )}
                                        </div>
                                        <PromptInputSubmit
                                            data-testid="send-button"
                                            status={status}
                                            disabled={!input.trim()}
                                        />
                                    </PromptInputFooter>
                                </PromptInput>
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

                                {/* Thread Info */}
                                <div className="border-t pt-4">
                                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                                        Session Info
                                    </p>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Thread:</span>
                                            <span className="font-mono">
                                                {threadId.slice(-8)}...
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Messages:</span>
                                            <span>{messages.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status:</span>
                                            <Badge
                                                variant={
                                                    status === "ready" ? "default" : "secondary"
                                                }
                                            >
                                                {status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
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
                                {testCases.length === 0 ? (
                                    <div className="text-muted-foreground py-12 text-center">
                                        <p>No test cases configured</p>
                                        <p className="mt-2 text-sm">
                                            Add test cases to run regression tests
                                        </p>
                                    </div>
                                ) : (
                                    testCases.map((tc) => (
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
                                                        {tc.lastResult?.passed
                                                            ? "Passed"
                                                            : "Failed"}
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
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={runningTestId === tc.id}
                                                    onClick={() => runSingleTest(tc)}
                                                >
                                                    {runningTestId === tc.id ? "Running..." : "Run"}
                                                </Button>
                                                <Button variant="ghost" size="sm">
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
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
