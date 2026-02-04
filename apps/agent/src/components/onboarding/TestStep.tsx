"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Card, CardContent, Input, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface TestStepProps {
    agentSlug: string;
    agentName: string;
    onContinue: () => void;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function TestStep({ agentSlug, agentName, onContinue }: TestStepProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: userMessage }],
                    threadId: `onboarding-${Date.now()}`
                })
            });

            if (!response.ok) throw new Error("Failed to send message");

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader");

            let assistantMessage = "";

            // Add empty assistant message
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            // Stream the response
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
                            // Ignore parse errors
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
                <p className="text-muted-foreground">
                    Your agent &quot;{agentName}&quot; is ready! Try it out below.
                </p>
            </div>

            <Card className="overflow-hidden">
                {/* Chat messages */}
                <CardContent className="h-80 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                        <div className="text-muted-foreground flex h-full flex-col items-center justify-center text-center">
                            <p className="text-lg">Send a message to get started</p>
                            <p className="mt-2 text-sm">
                                Try asking: &quot;What can you help me with?&quot;
                            </p>
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
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </CardContent>

                {/* Input */}
                <div className="border-t p-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <Button onClick={sendMessage} disabled={!input.trim() || isLoading}>
                            Send
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
