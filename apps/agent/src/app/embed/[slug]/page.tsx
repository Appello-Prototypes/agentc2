"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    Queue,
    QueueSection,
    QueueSectionTrigger,
    QueueSectionLabel,
    QueueSectionContent,
    QueueList,
    QueueItem,
    QueueItemIndicator,
    QueueItemContent,
    QueueItemDescription,
    type ToolActivity
} from "@repo/ui";
import { SparklesIcon, ChevronDownIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface EmbedConfig {
    greeting: string;
    suggestions: string[];
    theme: "dark" | "light";
    showToolActivity: boolean;
    showModeSelector: boolean;
    showModelSelector: boolean;
    showFileUpload: boolean;
    showVoiceInput: boolean;
    showConversationSidebar: boolean;
    showSignupCTA: boolean;
    signupProviders: string[];
    poweredByBadge: boolean;
    maxMessagesPerSession: number;
}

interface EmbedData {
    slug: string;
    name: string;
    config: EmbedConfig;
}

// ── Inline sub-components ────────────────────────────────────────────────

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

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="border-border/60 text-foreground/80 hover:bg-accent hover:text-foreground inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 py-2 text-sm transition-colors"
        >
            {label}
        </button>
    );
}

function TermsFooter() {
    return (
        <p className="text-muted-foreground/40 px-4 py-2 text-center text-[11px]">
            By messaging C2, you agree to our{" "}
            <a
                href="https://agentc2.ai/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/50"
            >
                Terms
            </a>{" "}
            and have read our{" "}
            <a
                href="https://agentc2.ai/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/50"
            >
                Privacy Policy
            </a>
            .
        </p>
    );
}

// ── Chat wrapper: only renders useChat once transport is available ───────

function EmbedChat({
    embedData,
    token,
    slug,
    isInternal
}: {
    embedData: EmbedData;
    token: string;
    slug: string;
    isInternal: boolean;
}) {
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [messageCount, setMessageCount] = useState(0);

    // Ephemeral thread ID (stable for session)
    const [threadId] = useState<string>(
        () => `embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

    // Transport for public chat API
    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `/api/agents/${slug}/chat/public`,
                body: { threadId },
                headers: { Authorization: `Bearer ${token}` }
            }),
        [slug, token, threadId]
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

    const safeConfig = embedData.config;

    // Check session message limit
    const maxMessages = safeConfig.maxMessagesPerSession || 0;
    const isLimitReached = maxMessages > 0 && messageCount >= maxMessages;

    // Derive active tool calls for StreamingStatus
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

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleSend = (text: string) => {
        if (isLimitReached || !text.trim()) return;
        setShowSuggestions(false);
        setMessageCount((c) => c + 1);
        void sendMessage({ text });
    };

    // ── Render part (simplified: text + tool invocations) ────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            return <MessageResponse key={index}>{part.text}</MessageResponse>;
        }
        if (part.type === "tool-invocation" && safeConfig.showToolActivity) {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            return <CollapsibleToolCall key={index} toolName={toolName} hasResult={hasResult} />;
        }
        // Queue data parts
        if (part.type === "data-queue" && part.data) {
            const queue = part.data;
            return (
                <Queue key={index}>
                    {(queue.sections || [{ label: "Tasks", items: queue.items || [] }]).map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (section: any, si: number) => (
                            <QueueSection key={si} defaultOpen>
                                <QueueSectionTrigger>
                                    <QueueSectionLabel
                                        label={section.label || "Tasks"}
                                        count={section.items?.length}
                                    />
                                </QueueSectionTrigger>
                                <QueueSectionContent>
                                    <QueueList>
                                        {(section.items || []).map(
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            (item: any, ii: number) => (
                                                <QueueItem key={ii}>
                                                    <QueueItemIndicator
                                                        completed={item.status === "completed"}
                                                    />
                                                    <div>
                                                        <QueueItemContent
                                                            completed={item.status === "completed"}
                                                        >
                                                            {item.title}
                                                        </QueueItemContent>
                                                        {item.description && (
                                                            <QueueItemDescription>
                                                                {item.description}
                                                            </QueueItemDescription>
                                                        )}
                                                    </div>
                                                </QueueItem>
                                            )
                                        )}
                                    </QueueList>
                                </QueueSectionContent>
                            </QueueSection>
                        )
                    )}
                </Queue>
            );
        }
        return null;
    };

    // ── Chat input ───────────────────────────────────────────────────────

    const chatInput = (
        <PromptInput onSubmit={({ text }: { text: string }) => handleSend(text || "")}>
            <PromptInputBody>
                <PromptInputTextarea
                    placeholder={
                        isLimitReached
                            ? "Session limit reached. Sign up to continue."
                            : "Ask anything"
                    }
                    disabled={isLimitReached}
                />
            </PromptInputBody>
            <PromptInputFooter>
                <div /> {/* Spacer for left side */}
                <PromptInputSubmit className="shrink-0" status={submitStatus} onStop={stop} />
            </PromptInputFooter>
        </PromptInput>
    );

    // ── Landing state (no messages yet) ──────────────────────────────────

    if (!hasMessages) {
        return (
            <div className="flex h-full flex-col">
                {/* Scrollable greeting area */}
                <div className="flex flex-1 flex-col items-center justify-end overflow-y-auto">
                    <div className="w-full max-w-[680px] px-4 pb-4 sm:px-6">
                        {/* Greeting */}
                        <div className="mb-6 text-center sm:mb-8">
                            <SparklesIcon className="text-primary/70 mx-auto mb-3 size-7 sm:size-8" />
                            <h1 className="text-foreground/90 mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                {safeConfig.greeting.split(".")[0] || embedData.name}
                            </h1>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                {safeConfig.greeting.includes(".")
                                    ? safeConfig.greeting.substring(
                                          safeConfig.greeting.indexOf(".") + 1
                                      )
                                    : ""}
                            </p>
                        </div>

                        {/* Suggestion chips */}
                        {showSuggestions && safeConfig.suggestions.length > 0 && (
                            <div className="mb-4">
                                <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
                                    {safeConfig.suggestions.map((s, i) => (
                                        <SuggestionChip
                                            key={i}
                                            label={s}
                                            onClick={() => handleSend(s)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input fixed at bottom */}
                <div className="shrink-0 px-4 pb-2 sm:px-6 sm:pb-3">
                    <div className="bg-card mx-auto max-w-[680px] rounded-2xl border shadow-sm">
                        {chatInput}
                    </div>
                    <TermsFooter />
                </div>
            </div>
        );
    }

    // ── Chat state ───────────────────────────────────────────────────────

    return (
        <div className="flex h-full flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b px-4 py-2">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="text-primary/70 size-4" />
                    <span className="text-sm font-medium">{embedData.name}</span>
                </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1">
                <Conversation className="h-full">
                    <ConversationContent className="mx-auto max-w-3xl px-4 sm:px-6">
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
                                            <div className="bg-muted/30 h-3 w-2/3 animate-pulse rounded" />
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
                            agentName={embedData.name}
                            activeTools={activeTools}
                        />
                    </ConversationContent>
                </Conversation>
            </div>

            {/* Signup CTA when limit reached */}
            {safeConfig.showSignupCTA && isLimitReached && (
                <div className="border-border/40 mx-4 my-3 rounded-xl border p-4 text-center">
                    <p className="text-foreground/80 mb-3 text-sm">
                        Want unlimited access? Sign up for free.
                    </p>
                    <a
                        href="https://agentc2.ai/signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
                    >
                        Sign up for free
                    </a>
                </div>
            )}

            {/* Input fixed at bottom */}
            <div className="shrink-0 px-4 py-2 sm:px-6 sm:py-3">
                <div className="bg-card mx-auto max-w-3xl rounded-2xl border shadow-sm">
                    {chatInput}
                </div>
            </div>
        </div>
    );
}

// ── Top-level nav bar ───────────────────────────────────────────────────

function EmbedNavBar({ agentName, isInternal }: { agentName: string; isInternal: boolean }) {
    return (
        <nav className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
                <SparklesIcon className="text-primary size-5" />
                <span className="text-foreground text-base font-semibold tracking-tight">
                    {agentName}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <a
                    href={isInternal ? "/login" : "https://agentc2.ai/login"}
                    target={isInternal ? "_parent" : "_blank"}
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:text-foreground inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                >
                    Log in
                </a>
                <a
                    href={isInternal ? "/signup" : "https://agentc2.ai/signup"}
                    target={isInternal ? "_parent" : "_blank"}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                    Sign up
                </a>
            </div>
        </nav>
    );
}

// ── Main Page (outer shell) ─────────────────────────────────────────────

function EmbedPageInner({ params }: { params: Promise<{ slug: string }> }) {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const isInternal = searchParams.get("internal") === "true";

    const [slug, setSlug] = useState<string>("");
    const [embedData, setEmbedData] = useState<EmbedData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Resolve params (Next.js 16 async params)
    useEffect(() => {
        params.then((p) => setSlug(p.slug));
    }, [params]);

    // Fetch embed config
    useEffect(() => {
        if (!slug || !token) return;

        fetch(`/api/agents/${slug}/embed?token=${token}`)
            .then((res) => {
                if (!res.ok) throw new Error("Invalid token or agent not available");
                return res.json();
            })
            .then((data: EmbedData) => {
                setEmbedData(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to load agent");
                setLoading(false);
            });
    }, [slug, token]);

    // ── Loading / Error states ───────────────────────────────────────────

    if (!token) {
        return (
            <div className="flex h-dvh items-center justify-center bg-black text-white">
                <p className="text-muted-foreground text-sm">Missing token parameter</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-dvh items-center justify-center bg-black">
                <LoaderIcon className="text-muted-foreground size-6 animate-spin" />
            </div>
        );
    }

    if (error || !embedData) {
        return (
            <div className="flex h-dvh items-center justify-center bg-black text-white">
                <div className="text-center">
                    <p className="text-muted-foreground text-sm">
                        {error || "Agent not available"}
                    </p>
                </div>
            </div>
        );
    }

    // ── Main layout ─────────────────────────────────────────────────────

    return (
        <div className="cowork-bg flex h-dvh flex-col">
            {/* Top nav with Log In / Sign Up */}
            <EmbedNavBar agentName={embedData.name} isInternal={isInternal} />

            {/* Chat area fills remaining space */}
            <div className="min-h-0 flex-1">
                <EmbedChat
                    embedData={embedData}
                    token={token}
                    slug={slug}
                    isInternal={isInternal}
                />
            </div>
        </div>
    );
}

export default function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
    return (
        <Suspense
            fallback={
                <div className="flex h-dvh items-center justify-center bg-black">
                    <LoaderIcon className="text-muted-foreground size-6 animate-spin" />
                </div>
            }
        >
            <EmbedPageInner params={params} />
        </Suspense>
    );
}
