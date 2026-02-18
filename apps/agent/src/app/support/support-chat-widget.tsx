"use client";

import { useState, useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    Message,
    MessageContent,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
    StreamingStatus,
    type ToolActivity
} from "@repo/ui";
import { MessageCircle, X, LoaderIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

const AGENT_SLUG = "support-desk";

function CollapsibleToolCall({ toolName, hasResult }: { toolName: string; hasResult: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const displayName = toolName.replace(/-/g, " ").replace(/_/g, " ");

    if (!hasResult) {
        return (
            <div className="text-muted-foreground my-1 flex items-center gap-1.5 text-sm">
                <LoaderIcon className="size-3.5 animate-spin" />
                <span>Using {displayName}...</span>
            </div>
        );
    }

    return (
        <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground my-1 flex items-center gap-1 text-sm transition-colors"
        >
            {expanded ? (
                <ChevronDownIcon className="size-3.5" />
            ) : (
                <ChevronRightIcon className="size-3.5" />
            )}
            <span>{displayName}</span>
        </button>
    );
}

export function SupportChatWidget() {
    const [open, setOpen] = useState(false);

    const [threadId] = useState<string>(
        () => `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `/api/agents/${AGENT_SLUG}/chat`,
                body: { threadId }
            }),
        [threadId]
    );

    const { messages, sendMessage, status, stop } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const hasMessages = messages.length > 0;
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

    const activeTools: ToolActivity[] = useMemo(() => {
        if (!submitStatus) return [];
        const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        if (!lastAssistant?.parts) return [];
        return lastAssistant.parts
            .filter(
                (p) =>
                    p.type === "tool-invocation" &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    !("result" in ((p as any).toolInvocation || {}))
            )
            .map((p, idx) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inv = (p as any).toolInvocation || {};
                return {
                    id: inv.toolCallId || `tool-${idx}`,
                    name: inv.toolName || "unknown",
                    status: "running" as const
                };
            });
    }, [messages, submitStatus]);

    const handleSend = (text: string) => {
        if (!text.trim()) return;
        void sendMessage({ text });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            return <MessageResponse key={index}>{part.text || ""}</MessageResponse>;
        }
        if (part.type === "tool-invocation") {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            return <CollapsibleToolCall key={index} toolName={toolName} hasResult={hasResult} />;
        }
        return null;
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(!open)}
                className={`fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all ${
                    open
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
            >
                {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="bg-background border-border fixed right-6 bottom-24 z-50 flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border shadow-2xl">
                    {/* Header */}
                    <div className="border-border flex items-center justify-between border-b px-4 py-3">
                        <div>
                            <h3 className="text-sm font-semibold">Support Assistant</h3>
                            <p className="text-muted-foreground text-xs">
                                Report bugs, request features, or ask questions
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="min-h-0 flex-1">
                        {!hasMessages ? (
                            <div className="flex h-full flex-col items-center justify-center px-6">
                                <MessageCircle className="text-muted-foreground/30 mb-3 h-10 w-10" />
                                <p className="text-foreground/80 mb-1 text-sm font-medium">
                                    How can we help?
                                </p>
                                <p className="text-muted-foreground mb-4 text-center text-xs">
                                    Describe your issue and I&apos;ll create a support ticket for
                                    you, or help you find answers.
                                </p>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {["Report a bug", "Request a feature", "View my tickets"].map(
                                        (s) => (
                                            <button
                                                key={s}
                                                onClick={() => handleSend(s)}
                                                className="border-border/60 text-foreground/80 hover:bg-accent rounded-full border px-3 py-1.5 text-xs transition-colors"
                                            >
                                                {s}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ) : (
                            <Conversation className="h-full">
                                <ConversationContent className="px-4">
                                    <ConversationScrollButton />
                                    {messages.map((message) => (
                                        <Message key={message.id} from={message.role}>
                                            <MessageContent>
                                                {message.parts && message.parts.length > 0 ? (
                                                    message.parts.map(renderPart)
                                                ) : message.role === "assistant" &&
                                                  (isStreaming || isSubmitted) &&
                                                  message.id ===
                                                      messages[messages.length - 1]?.id ? (
                                                    <div className="flex flex-col gap-2 py-1">
                                                        <div className="bg-muted/60 h-3 w-3/4 animate-pulse rounded" />
                                                        <div className="bg-muted/40 h-3 w-1/2 animate-pulse rounded" />
                                                    </div>
                                                ) : (
                                                    <MessageResponse>
                                                        {String(
                                                            (
                                                                message as unknown as {
                                                                    content?: string;
                                                                }
                                                            ).content || ""
                                                        )}
                                                    </MessageResponse>
                                                )}
                                            </MessageContent>
                                        </Message>
                                    ))}
                                    <StreamingStatus
                                        status={submitStatus}
                                        hasVisibleContent={(() => {
                                            const lastAssistant = [...messages]
                                                .reverse()
                                                .find((m) => m.role === "assistant");
                                            return (
                                                lastAssistant?.parts?.some(
                                                    (p) =>
                                                        p.type === "text" &&
                                                        (p as { text: string }).text.length > 0
                                                ) ?? false
                                            );
                                        })()}
                                        agentName="Support Desk"
                                        activeTools={activeTools}
                                    />
                                </ConversationContent>
                            </Conversation>
                        )}
                    </div>

                    {/* Input */}
                    <div className="border-border shrink-0 border-t px-3 py-2">
                        <PromptInput
                            onSubmit={({ text }: { text: string }) => handleSend(text || "")}
                        >
                            <PromptInputBody>
                                <PromptInputTextarea placeholder="Describe your issue..." />
                            </PromptInputBody>
                            <PromptInputFooter>
                                <div />
                                <PromptInputSubmit
                                    className="shrink-0"
                                    status={submitStatus}
                                    onStop={stop}
                                />
                            </PromptInputFooter>
                        </PromptInput>
                    </div>
                </div>
            )}
        </>
    );
}
