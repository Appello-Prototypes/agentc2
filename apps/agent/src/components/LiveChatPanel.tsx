"use client";

import { useState, useEffect, useCallback } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    cn,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
    Message,
    MessageContent,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
    Loader
} from "@repo/ui";
import { MessageSquareIcon, XIcon, MinimizeIcon, MaximizeIcon, RefreshCwIcon } from "lucide-react";

interface Agent {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    type: "SYSTEM" | "USER";
}

interface LiveChatPanelProps {
    /** Initial agent slug to select */
    initialAgentSlug?: string;
    /** Callback when panel is closed */
    onClose?: () => void;
    /** Whether panel is minimized */
    minimized?: boolean;
    /** Callback to toggle minimize state */
    onMinimizeToggle?: () => void;
}

export function LiveChatPanel({
    initialAgentSlug,
    onClose,
    minimized = false,
    onMinimizeToggle
}: LiveChatPanelProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentSlug, setSelectedAgentSlug] = useState<string>(initialAgentSlug || "");
    const [loading, setLoading] = useState(true);
    const [threadId, setThreadId] = useState<string>(() => `live-${Date.now()}`);
    const [input, setInput] = useState("");

    // Use the AI SDK's useChat hook for streaming
    const { messages, setMessages, sendMessage, status, stop } = useChat({
        transport: new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${selectedAgentSlug}/chat`,
            body: {
                threadId,
                requestContext: {
                    userId: "live-user",
                    mode: "live"
                }
            }
        })
    });

    // Fetch available agents
    useEffect(() => {
        async function fetchAgents() {
            try {
                const res = await fetch(`${getApiBase()}/api/agents`);
                const data = await res.json();
                if (data.success && data.agents) {
                    setAgents(data.agents);
                    // Auto-select first agent if none provided
                    if (!selectedAgentSlug && data.agents.length > 0) {
                        setSelectedAgentSlug(data.agents[0].slug);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch agents:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAgents();
    }, [selectedAgentSlug]);

    // Handle agent change - reset thread
    const handleAgentChange = useCallback(
        (newSlug: string | null) => {
            if (!newSlug) return;
            setSelectedAgentSlug(newSlug);
            setMessages([]);
            setThreadId(`live-${newSlug}-${Date.now()}`);
        },
        [setMessages]
    );

    // Handle send message
    const handleSend = useCallback(() => {
        if (!input.trim() || !selectedAgentSlug) return;

        sendMessage({ text: input });
        setInput("");
    }, [input, selectedAgentSlug, sendMessage]);

    // Start new conversation
    const handleNewConversation = useCallback(() => {
        setMessages([]);
        setThreadId(`live-${selectedAgentSlug}-${Date.now()}`);
    }, [selectedAgentSlug, setMessages]);

    const isStreaming = status === "streaming";
    const selectedAgent = agents.find((a) => a.slug === selectedAgentSlug);

    if (minimized) {
        return (
            <div className="bg-background fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border px-4 py-2 shadow-lg">
                <MessageSquareIcon className="text-primary size-5" />
                <span className="text-sm font-medium">Live Chat</span>
                {selectedAgent && (
                    <Badge variant="outline" className="text-xs">
                        {selectedAgent.name}
                    </Badge>
                )}
                <Button variant="ghost" size="icon" className="size-7" onClick={onMinimizeToggle}>
                    <MaximizeIcon className="size-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-background fixed top-0 right-0 z-50 flex h-full w-[420px] flex-col border-l shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <MessageSquareIcon className="text-primary size-5" />
                    <span className="font-semibold">Live Chat</span>
                    <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        LIVE
                    </Badge>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={handleNewConversation}
                        title="New conversation"
                    >
                        <RefreshCwIcon className="size-4" />
                    </Button>
                    {onMinimizeToggle && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={onMinimizeToggle}
                            title="Minimize"
                        >
                            <MinimizeIcon className="size-4" />
                        </Button>
                    )}
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={onClose}
                            title="Close"
                        >
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Agent Selector */}
            <div className="border-b px-4 py-2">
                <Select
                    value={selectedAgentSlug}
                    onValueChange={handleAgentChange}
                    disabled={loading}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an agent">
                            {selectedAgent ? (
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            "size-2 rounded-full",
                                            selectedAgent.isActive
                                                ? "bg-green-500"
                                                : "bg-muted-foreground"
                                        )}
                                    />
                                    <span>{selectedAgent.name}</span>
                                </div>
                            ) : (
                                "Select an agent"
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {agents.map((agent) => (
                            <SelectItem key={agent.slug} value={agent.slug}>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            "size-2 rounded-full",
                                            agent.isActive ? "bg-green-500" : "bg-muted-foreground"
                                        )}
                                    />
                                    <span>{agent.name}</span>
                                    {agent.type === "SYSTEM" && (
                                        <Badge
                                            variant="outline"
                                            className="text-muted-foreground h-4 px-1 text-[9px]"
                                        >
                                            System
                                        </Badge>
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden">
                <Conversation>
                    <ConversationContent>
                        <ConversationScrollButton />

                        {messages.length === 0 ? (
                            <ConversationEmptyState>
                                <div className="text-center">
                                    <MessageSquareIcon className="text-muted-foreground mx-auto mb-3 size-12" />
                                    <h3 className="mb-1 text-lg font-medium">
                                        {selectedAgent
                                            ? `Chat with ${selectedAgent.name}`
                                            : "Select an Agent"}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {selectedAgent
                                            ? "Send a message to start the conversation. This runs the full agent workflow in production mode."
                                            : "Choose an agent above to start chatting."}
                                    </p>
                                </div>
                            </ConversationEmptyState>
                        ) : (
                            messages.map((message) => (
                                <Message
                                    key={message.id}
                                    from={message.role as "user" | "assistant"}
                                >
                                    <MessageContent>
                                        {message.parts && message.parts.length > 0 ? (
                                            message.parts.map((part, index) => {
                                                if (part.type === "text") {
                                                    return (
                                                        <MessageResponse key={index}>
                                                            {part.text}
                                                        </MessageResponse>
                                                    );
                                                }

                                                if (part.type === "tool-invocation") {
                                                    // Show tool calls as a simple badge
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const toolPart = part as any;
                                                    return (
                                                        <div
                                                            key={index}
                                                            className="my-2 flex items-center gap-2"
                                                        >
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Tool:{" "}
                                                                {toolPart.toolInvocation?.toolName}
                                                            </Badge>
                                                            {"result" in
                                                                (toolPart.toolInvocation || {}) && (
                                                                <Badge className="bg-green-100 text-xs text-green-800">
                                                                    Done
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            })
                                        ) : (
                                            <MessageResponse>
                                                {/* Fallback for messages without parts */}
                                                {String(
                                                    (message as unknown as { content?: string })
                                                        .content || ""
                                                )}
                                            </MessageResponse>
                                        )}
                                    </MessageContent>
                                </Message>
                            ))
                        )}

                        {isStreaming && (
                            <div className="flex justify-center py-2">
                                <Loader />
                            </div>
                        )}
                    </ConversationContent>
                </Conversation>
            </div>

            {/* Input Area */}
            <div className="border-t p-3">
                <PromptInput onSubmit={handleSend}>
                    <PromptInputBody>
                        <PromptInputTextarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                selectedAgentSlug ? "Type a message..." : "Select an agent to start"
                            }
                            disabled={!selectedAgentSlug || isStreaming}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                    </PromptInputBody>
                    <PromptInputFooter>
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>
                                {isStreaming ? (
                                    <Button variant="ghost" size="sm" onClick={stop}>
                                        Stop generating
                                    </Button>
                                ) : (
                                    "Press Enter to send"
                                )}
                            </span>
                            <PromptInputSubmit disabled={!input.trim() || !selectedAgentSlug} />
                        </div>
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}
