"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button, Card, CardContent, Input, Badge, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { BotIcon, LoaderIcon, SendIcon } from "lucide-react";

interface TestStepProps {
    agentSlug: string;
    agentName: string;
    modelName: string;
    templateId: string | null;
    onContinue: () => void;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

const MODEL_DISPLAY: Record<string, string> = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-3-5-20241022": "Claude Haiku 3.5"
};

const SUGGESTED_MESSAGES: Record<string, string[]> = {
    "general-assistant": [
        "What can you help me with?",
        "Summarize the benefits of AI agents",
        "What's 15% of 2,340?"
    ],
    "customer-support": [
        "I have a billing question",
        "How do I reset my password?",
        "I'm having trouble with my account"
    ],
    "research-assistant": [
        "Research the latest trends in AI",
        "Compare pros and cons of remote work",
        "What are the key findings on productivity?"
    ],
    "data-analyst": [
        "What's the compound growth rate of 100 to 250 over 5 years?",
        "Help me interpret a dataset",
        "Calculate the average of 42, 67, 89, 23, 55"
    ],
    default: [
        "What can you help me with?",
        "Tell me about your capabilities",
        "Help me with a quick task"
    ]
};

export function TestStep({
    agentSlug,
    agentName,
    modelName,
    templateId,
    onContinue
}: TestStepProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const suggestions = useMemo(() => {
        return SUGGESTED_MESSAGES[templateId || "default"] || SUGGESTED_MESSAGES["default"]!;
    }, [templateId]);

    const displayModel = MODEL_DISPLAY[modelName] || modelName;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (text?: string) => {
        const userMessage = (text || input).trim();
        if (!userMessage || isLoading) return;

        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: userMessage }],
                    threadId: `onboarding-test-${agentSlug}`
                })
            });

            if (!response.ok) throw new Error("Failed to send message");

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader");

            let assistantMessage = "";
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = new TextDecoder().decode(value);
                const lines = text.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === "text-delta" && data.delta) {
                                assistantMessage += data.delta;
                                setMessages((prev) => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1] = {
                                        role: "assistant",
                                        content: assistantMessage
                                    };
                                    return newMessages;
                                });
                            }
                        } catch {
                            // Ignore parse errors from partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, something went wrong. Please try again." }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Test your agent</h2>
                <p className="text-muted-foreground text-sm">
                    Your agent &quot;{agentName}&quot; is ready. Send a message to try it out.
                </p>
            </div>

            <Card className="overflow-hidden">
                {/* Chat header */}
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                    <div className="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-full">
                        <BotIcon className="text-primary size-3.5" />
                    </div>
                    <span className="text-sm font-medium">{agentName}</span>
                    <Badge variant="outline" className="text-[10px]">
                        {displayModel}
                    </Badge>
                </div>

                {/* Chat messages */}
                <CardContent className="h-72 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <p className="text-muted-foreground mb-4 text-sm">
                                Try one of these to get started:
                            </p>
                            <div className="flex flex-col gap-2">
                                {suggestions.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(suggestion)}
                                        className="bg-muted/50 hover:bg-muted rounded-lg px-4 py-2 text-left text-sm transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                            message.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted"
                                        }`}
                                    >
                                        {message.content || <Skeleton className="h-4 w-32" />}
                                    </div>
                                </div>
                            ))}
                            {/* Streaming indicator */}
                            {isLoading &&
                                messages.length > 0 &&
                                messages[messages.length - 1]?.role === "user" && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted flex items-center gap-2 rounded-lg px-4 py-2">
                                            <LoaderIcon className="size-3.5 animate-spin" />
                                            <span className="text-muted-foreground text-xs">
                                                Thinking...
                                            </span>
                                        </div>
                                    </div>
                                )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </CardContent>

                {/* Input */}
                <div className="border-t p-3">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            className="text-sm"
                        />
                        <Button
                            size="icon"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isLoading}
                        >
                            <SendIcon className="size-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button onClick={onContinue}>
                    {messages.length > 0 ? "Finish Setup" : "Skip for Now"}
                </Button>
            </div>
        </div>
    );
}
