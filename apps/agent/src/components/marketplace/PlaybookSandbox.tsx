"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
    Button,
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
import {
    MessageSquareIcon,
    RocketIcon,
    LoaderIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    AlertCircleIcon
} from "lucide-react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";

interface PlaybookSandboxProps {
    playbookSlug: string;
    playbookName: string;
}

interface SandboxInfo {
    available: boolean;
    agentSlug?: string;
    agentName?: string;
    token?: string;
    reason?: string;
}

const MAX_SANDBOX_MESSAGES = 5;

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

function SandboxChat({
    agentSlug,
    agentName,
    token,
    playbookSlug
}: {
    agentSlug: string;
    agentName: string;
    token: string;
    playbookSlug: string;
}) {
    const [messageCount, setMessageCount] = useState(0);
    const isLimitReached = messageCount >= MAX_SANDBOX_MESSAGES;

    const [threadId] = useState<string>(
        () => `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `/api/agents/${agentSlug}/chat/public`,
                body: { threadId },
                headers: { Authorization: `Bearer ${token}` }
            }),
        [agentSlug, token, threadId]
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
        if (isLimitReached || !text.trim()) return;
        setMessageCount((c) => c + 1);
        void sendMessage({ text });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            const text: string = part.text || "";
            return <MessageResponse key={index}>{text}</MessageResponse>;
        }
        if (part.type === "tool-invocation") {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            return <CollapsibleToolCall key={index} toolName={toolName} hasResult={hasResult} />;
        }
        return null;
    };

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-zinc-800 px-4 py-3">
                <div className="flex items-center gap-2">
                    <MessageSquareIcon className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">Chatting with {agentName}</span>
                    <span className="text-muted-foreground text-xs">
                        (Preview &middot; {MAX_SANDBOX_MESSAGES - messageCount} message
                        {MAX_SANDBOX_MESSAGES - messageCount !== 1 ? "s" : ""} remaining)
                    </span>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                {!hasMessages ? (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <MessageSquareIcon className="text-muted-foreground mb-4 h-10 w-10" />
                        <h3 className="mb-2 text-lg font-medium">Try {agentName}</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                            Send a message to see how this agent responds. You have{" "}
                            {MAX_SANDBOX_MESSAGES} preview messages.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {[
                                "What can you do?",
                                "Help me set up my workspace",
                                "What tools do you have?"
                            ].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleSend(s)}
                                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-800"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Conversation className="h-full">
                        <ConversationContent className="mx-auto max-w-3xl px-4">
                            <ConversationScrollButton />
                            {messages.map((message) => (
                                <Message key={message.id} from={message.role}>
                                    <MessageContent>
                                        {message.parts && message.parts.length > 0 ? (
                                            message.parts.map(renderPart)
                                        ) : message.role === "assistant" &&
                                          (isStreaming || isSubmitted) &&
                                          message.id === messages[messages.length - 1]?.id ? (
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
                                agentName={agentName}
                                activeTools={activeTools}
                            />
                        </ConversationContent>
                    </Conversation>
                )}
            </div>

            {isLimitReached && (
                <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-4 text-center">
                    <p className="text-muted-foreground mb-3 text-sm">
                        Preview limit reached. Deploy this playbook for unlimited access.
                    </p>
                    <Link href={`/marketplace/${playbookSlug}/deploy`}>
                        <Button>
                            <RocketIcon className="mr-2 h-4 w-4" />
                            Deploy to Your Workspace
                        </Button>
                    </Link>
                </div>
            )}

            {!isLimitReached && (
                <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
                    <div className="mx-auto max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950">
                        <PromptInput
                            onSubmit={({ text }: { text: string }) => handleSend(text || "")}
                        >
                            <PromptInputBody>
                                <PromptInputTextarea placeholder="Ask anything..." />
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
        </div>
    );
}

export function PlaybookSandbox({ playbookSlug, playbookName }: PlaybookSandboxProps) {
    const [sandboxInfo, setSandboxInfo] = useState<SandboxInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSandboxInfo() {
            try {
                const res = await fetch(`${getApiBase()}/api/playbooks/${playbookSlug}/sandbox`);
                const data = await res.json();
                setSandboxInfo(data);
            } catch {
                setSandboxInfo({ available: false, reason: "Failed to load sandbox" });
            } finally {
                setLoading(false);
            }
        }
        fetchSandboxInfo();
    }, [playbookSlug]);

    if (loading) {
        return (
            <div className="flex h-[500px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50">
                <LoaderIcon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!sandboxInfo?.available || !sandboxInfo.agentSlug || !sandboxInfo.token) {
        return (
            <div className="flex h-[500px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 text-center">
                <AlertCircleIcon className="text-muted-foreground mb-4 h-10 w-10" />
                <h3 className="mb-2 text-lg font-medium">Sandbox Not Available</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                    A live preview isn&apos;t available for this playbook yet. Deploy it to your
                    workspace to try it out.
                </p>
                <Link href={`/marketplace/${playbookSlug}/deploy`}>
                    <Button>
                        <RocketIcon className="mr-2 h-4 w-4" />
                        Deploy {playbookName}
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="h-[600px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <SandboxChat
                agentSlug={sandboxInfo.agentSlug}
                agentName={sandboxInfo.agentName || playbookName}
                token={sandboxInfo.token}
                playbookSlug={playbookSlug}
            />
        </div>
    );
}
