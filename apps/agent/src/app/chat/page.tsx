"use client";

import { useEffect, useState } from "react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import { Button } from "@repo/ui";

import {
    PromptInput,
    PromptInputBody,
    PromptInputTextarea
} from "@/components/ai-elements/prompt-input";

import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";

import {
    Tool,
    ToolHeader,
    ToolContent,
    ToolInput,
    ToolOutput
} from "@/components/ai-elements/tool";

export default function ChatPage() {
    const [input, setInput] = useState<string>("");

    const { messages, setMessages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/agent/api/chat"
        })
    });

    // Load message history on mount
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await fetch("/agent/api/chat");
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) {
                        setMessages([...data]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch message history:", error);
            }
        };
        fetchMessages();
    }, [setMessages]);

    const handleSubmit = async () => {
        if (!input.trim()) return;

        sendMessage({ text: input });
        setInput("");
    };

    const handleClearHistory = () => {
        setMessages([]);
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <h1 className="text-lg font-semibold">AI Assistant</h1>
                    <p className="text-muted-foreground text-sm">Powered by Mastra + Claude</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearHistory}>
                    Clear Chat
                </Button>
            </div>

            {/* Conversation */}
            <Conversation className="flex-1">
                <ConversationContent>
                    {messages.length === 0 ? (
                        <div className="text-muted-foreground flex h-full items-center justify-center">
                            <div className="space-y-2 text-center">
                                <p className="text-lg">Welcome to the AI Assistant</p>
                                <p className="text-sm">
                                    Ask me anything! I can help with questions, calculations, and
                                    more.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div key={message.id} className="space-y-2">
                                {message.parts?.map((part, i) => {
                                    // Handle text messages
                                    if (part.type === "text") {
                                        return (
                                            <Message key={`${message.id}-${i}`} from={message.role}>
                                                <MessageContent>
                                                    <MessageResponse>{part.text}</MessageResponse>
                                                </MessageContent>
                                            </Message>
                                        );
                                    }

                                    // Handle tool invocations
                                    if (part.type?.startsWith("tool-")) {
                                        const toolPart = part as ToolUIPart;
                                        return (
                                            <Tool key={`${message.id}-${i}`}>
                                                <ToolHeader
                                                    type={toolPart.type}
                                                    state={toolPart.state || "output-available"}
                                                />
                                                <ToolContent>
                                                    <ToolInput input={toolPart.input || {}} />
                                                    <ToolOutput
                                                        output={toolPart.output}
                                                        errorText={toolPart.errorText}
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

                    {/* Loading indicator */}
                    {status === "streaming" && (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <span className="animate-pulse">●</span>
                            <span>Assistant is thinking...</span>
                        </div>
                    )}
                </ConversationContent>
            </Conversation>

            {/* Input */}
            <PromptInput onSubmit={handleSubmit}>
                <PromptInputBody>
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                        disabled={status !== "ready"}
                    />
                    <Button
                        type="submit"
                        disabled={status !== "ready" || !input.trim()}
                        className="shrink-0"
                    >
                        Send
                    </Button>
                </PromptInputBody>
            </PromptInput>
        </div>
    );
}
