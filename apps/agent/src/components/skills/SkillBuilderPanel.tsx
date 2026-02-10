"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
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
    PromptInputTools,
    StreamingStatus,
    type PromptInputMessage
} from "@repo/ui";

const SKILL_BUILDER_SLUG = "skill-builder";

export interface SkillBuilderPanelProps {
    agentId: string;
    agentSlug: string;
    onSkillCreated: () => void;
}

export function SkillBuilderPanel({ agentId, agentSlug, onSkillCreated }: SkillBuilderPanelProps) {
    const [threadId] = useState(() => `skill-build-${agentSlug}-${Date.now()}`);
    const lastScannedRef = useRef(0);
    const onSkillCreatedRef = useRef(onSkillCreated);
    useEffect(() => {
        onSkillCreatedRef.current = onSkillCreated;
    }, [onSkillCreated]);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${getApiBase()}/api/agents/${SKILL_BUILDER_SLUG}/chat`,
                body: {
                    threadId,
                    requestContext: {
                        userId: "skill-builder",
                        mode: "live",
                        agentSlug,
                        agentId
                    }
                }
            }),
        [threadId, agentSlug, agentId]
    );

    const { messages, sendMessage, status, stop } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

    // Watch messages for skill-create tool invocations
    useEffect(() => {
        for (let i = lastScannedRef.current; i < messages.length; i++) {
            const message = messages[i];
            if (!message || message.role !== "assistant") continue;

            for (const part of message.parts || []) {
                if (part.type !== "tool-invocation") continue;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const toolPart = part as any;
                const toolName = toolPart.toolInvocation?.toolName;
                const hasResult = "result" in (toolPart.toolInvocation || {});

                if (
                    hasResult &&
                    (toolName === "skill-create" || toolName === "agent-attach-skill")
                ) {
                    onSkillCreatedRef.current();
                }
            }
        }
        lastScannedRef.current = messages.length;
    }, [messages]);

    // Also fire callback when streaming completes (in case result arrived at end)
    const prevStatusRef = useRef(status);
    useEffect(() => {
        const wasStreaming =
            prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
        const isNowIdle = status !== "streaming" && status !== "submitted";
        prevStatusRef.current = status;

        if (wasStreaming && isNowIdle) {
            for (const message of messages) {
                if (message.role !== "assistant") continue;
                for (const part of message.parts || []) {
                    if (part.type !== "tool-invocation") continue;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const toolPart = part as any;
                    const toolName = toolPart.toolInvocation?.toolName;
                    const hasResult = "result" in (toolPart.toolInvocation || {});
                    if (
                        hasResult &&
                        (toolName === "skill-create" || toolName === "agent-attach-skill")
                    ) {
                        onSkillCreatedRef.current();
                    }
                }
            }
        }
    }, [status, messages]);

    const handleSend = useCallback(
        (message: PromptInputMessage) => {
            if (!message.text.trim()) return;
            void sendMessage({ text: message.text });
        },
        [sendMessage]
    );

    const handleExampleClick = useCallback(
        (text: string) => {
            void sendMessage({ text });
        },
        [sendMessage]
    );

    const hasVisibleContent = messages.some((m) =>
        m.parts?.some(
            (p) => (p.type === "text" && p.text.trim().length > 0) || p.type === "tool-invocation"
        )
    );
    const showWelcome = !hasVisibleContent;

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="shrink-0 border-b px-4 py-3">
                <h2 className="text-foreground text-sm font-semibold tracking-tight">
                    Skill Builder
                </h2>
                <p className="text-muted-foreground text-[11px]">
                    Create a skill for <code className="bg-muted rounded px-1">{agentSlug}</code>
                </p>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <Conversation>
                    <ConversationContent>
                        <ConversationScrollButton />

                        {showWelcome && (
                            <div className="p-4">
                                <p className="text-muted-foreground text-sm">
                                    Describe the skill you want to create. I will help you craft the
                                    instructions, suggest a name, and optionally attach documents or
                                    tools.
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                                    {[
                                        "Create a customer support skill that handles billing inquiries",
                                        "Build a research skill that summarizes web content",
                                        "Create a sales outreach skill for writing follow-up emails"
                                    ].map((example) => (
                                        <button
                                            key={example}
                                            onClick={() => handleExampleClick(example)}
                                            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <Message key={message.id} from={message.role}>
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
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                const toolPart = part as any;
                                                const hasResult =
                                                    "result" in (toolPart.toolInvocation || {});
                                                return (
                                                    <div
                                                        key={index}
                                                        className="my-2 flex items-center gap-2"
                                                    >
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {toolPart.toolInvocation?.toolName}
                                                        </Badge>
                                                        {hasResult && (
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

                        {!showWelcome && (
                            <StreamingStatus
                                status={submitStatus}
                                hasVisibleContent={hasVisibleContent}
                            />
                        )}
                    </ConversationContent>
                </Conversation>
            </div>

            {/* Input */}
            <div className="shrink-0 border-t p-3">
                <PromptInput onSubmit={handleSend}>
                    <PromptInputBody>
                        <PromptInputTextarea
                            placeholder="Describe the skill you want to create..."
                            disabled={isStreaming}
                        />
                    </PromptInputBody>
                    <PromptInputFooter>
                        <PromptInputTools />
                        <PromptInputSubmit status={submitStatus} onStop={stop} />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
}
