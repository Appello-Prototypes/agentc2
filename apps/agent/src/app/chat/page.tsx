"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/utils";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import {
    Button,
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
import { MessageSquareIcon, CopyIcon, RefreshCwIcon } from "lucide-react";

export default function ChatPage() {
    const [input, setInput] = useState<string>("");

    const { messages, setMessages, sendMessage, status, regenerate } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat"
        })
    });

    // Load message history on mount
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/chat`);
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

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
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
                        <ConversationEmptyState
                            icon={<MessageSquareIcon className="size-12" />}
                            title="Welcome to the AI Assistant"
                            description="Ask me anything! I can help with questions, calculations, and more."
                        />
                    ) : (
                        messages.map((message, messageIndex) => (
                            <div key={message.id} className="space-y-2">
                                {message.parts?.map((part, i) => {
                                    // Handle text messages
                                    if (part.type === "text") {
                                        const isLastAssistantMessage =
                                            message.role === "assistant" &&
                                            messageIndex === messages.length - 1;

                                        return (
                                            <Message key={`${message.id}-${i}`} from={message.role}>
                                                <MessageContent>
                                                    <MessageResponse>{part.text}</MessageResponse>
                                                </MessageContent>
                                                {isLastAssistantMessage && status === "ready" && (
                                                    <MessageActions>
                                                        <MessageAction
                                                            tooltip="Copy"
                                                            onClick={() =>
                                                                handleCopyMessage(part.text)
                                                            }
                                                        >
                                                            <CopyIcon className="size-3" />
                                                        </MessageAction>
                                                        <MessageAction
                                                            tooltip="Regenerate"
                                                            onClick={() => regenerate()}
                                                        >
                                                            <RefreshCwIcon className="size-3" />
                                                        </MessageAction>
                                                    </MessageActions>
                                                )}
                                            </Message>
                                        );
                                    }

                                    // Handle tool invocations
                                    if (part.type?.startsWith("tool-")) {
                                        const toolPart = part as ToolUIPart;

                                        // Hide internal memory management tools from the UI
                                        const internalTools = [
                                            "updateWorkingMemory",
                                            "getWorkingMemory"
                                        ];
                                        const toolName = toolPart.type?.replace("tool-", "") || "";
                                        if (internalTools.includes(toolName)) {
                                            return null;
                                        }

                                        return (
                                            <Tool
                                                key={`${message.id}-${i}`}
                                                defaultOpen={toolPart.state === "output-error"}
                                            >
                                                <ToolHeader
                                                    type={toolPart.type}
                                                    state={toolPart.state || "output-available"}
                                                />
                                                <ToolContent>
                                                    <ToolInput input={toolPart.input} />
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
                    {status === "submitted" && <Loader />}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            {/* Input */}
            <PromptInput onSubmit={handleSubmit} className="border-t p-4">
                <PromptInputBody>
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                        disabled={status !== "ready"}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <PromptInputSubmit status={status} disabled={!input.trim()} />
                </PromptInputFooter>
            </PromptInput>
        </div>
    );
}
