"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
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
import { ChevronDownIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
import { AgentC2Logo } from "@repo/ui";

// ── Types ────────────────────────────────────────────────────────────────

export interface EmbedConfig {
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

export interface EmbedData {
    slug: string;
    name: string;
    config: EmbedConfig;
}

export interface WelcomeEmbedProps {
    embedData: EmbedData;
    token: string;
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

function IntegrationPills() {
    const integrations = [
        "HubSpot",
        "Jira",
        "Slack",
        "Gmail",
        "Google Calendar",
        "GitHub",
        "Outlook",
        "Dropbox"
    ];
    return (
        <div className="flex flex-wrap justify-center gap-1.5">
            {integrations.map((name) => (
                <span
                    key={name}
                    className="border-border/40 text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs"
                >
                    {name}
                </span>
            ))}
        </div>
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

/** Inline Google signup card rendered when the agent outputs [SIGNUP_CTA]. */
function SignupCTACard() {
    const signupHref =
        typeof window !== "undefined"
            ? `${window.location.origin}/signup`
            : "https://agentc2.ai/signup";

    return (
        <div className="border-border/40 my-3 rounded-xl border p-4">
            <p className="text-foreground/90 mb-1 text-sm font-medium">
                Ready to put agents to work for your team?
            </p>
            <p className="text-muted-foreground mb-3 text-xs">
                Sign up with Google to connect your business tools instantly. Your first AI agent
                will be running in minutes — no setup required.
            </p>
            <a
                href={signupHref}
                target="_top"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-2.5 rounded-full bg-white px-5 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:bg-white/90"
            >
                <svg className="size-4" viewBox="0 0 24 24">
                    <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                    />
                </svg>
                Sign up with Google
            </a>
        </div>
    );
}

// ── Chat component ───────────────────────────────────────────────────────

function WelcomeChat({ embedData, token }: { embedData: EmbedData; token: string }) {
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [messageCount, setMessageCount] = useState(0);
    const slug = embedData.slug;
    const safeConfig = embedData.config;

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

    // ── Render part (text + tool invocations) ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            const text: string = part.text || "";

            // Check for [SIGNUP_CTA] token and split text around it
            if (text.includes("[SIGNUP_CTA]")) {
                const segments = text.split("[SIGNUP_CTA]");
                return (
                    <Fragment key={index}>
                        {segments.map((segment: string, si: number) => (
                            <Fragment key={si}>
                                {segment.trim() && <MessageResponse>{segment}</MessageResponse>}
                                {si < segments.length - 1 && <SignupCTACard />}
                            </Fragment>
                        ))}
                    </Fragment>
                );
            }

            return <MessageResponse key={index}>{text}</MessageResponse>;
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
                            <div className="mx-auto mb-3 flex items-center justify-center gap-[2px]">
                                <span className="text-foreground text-2xl font-semibold">
                                    Agent
                                </span>
                                <AgentC2Logo size={32} />
                            </div>
                            <h1 className="text-foreground/90 mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                Build and deploy agents that connect to your business tools at
                                scale.
                            </h1>
                            <p className="text-muted-foreground mx-auto max-w-md text-sm sm:text-base">
                                Your command and control center for the agentic world. Connect your
                                CRM, email, project tools, and knowledge base — then let agents do
                                the rest.
                            </p>

                            {/* Integration pills */}
                            <div className="mt-4">
                                <IntegrationPills />
                            </div>
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

// ── Nav bar ──────────────────────────────────────────────────────────────

function WelcomeNavBar() {
    const loginHref =
        typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : "https://agentc2.ai/login";
    const signupHref =
        typeof window !== "undefined"
            ? `${window.location.origin}/signup`
            : "https://agentc2.ai/signup";

    return (
        <nav className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-[2px]">
                <span className="text-foreground text-base font-semibold">Agent</span>
                <AgentC2Logo size={26} />
            </div>
            <div className="flex items-center gap-2">
                <a
                    href={loginHref}
                    className="text-foreground/70 hover:text-foreground inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                >
                    Log in
                </a>
                <a
                    href={signupHref}
                    className="inline-flex min-h-[36px] items-center rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                    Sign up
                </a>
            </div>
        </nav>
    );
}

// ── Main export ──────────────────────────────────────────────────────────

export default function WelcomeEmbed({ embedData, token }: WelcomeEmbedProps) {
    // Force dark mode for the public landing page.
    // Do NOT remove on unmount — let next-themes manage the class
    // once the user navigates into the authenticated app.
    useEffect(() => {
        document.documentElement.classList.add("dark");
    }, []);

    return (
        <div className="cowork-bg flex h-dvh flex-col">
            <WelcomeNavBar />
            <div className="min-h-0 flex-1">
                <WelcomeChat embedData={embedData} token={token} />
            </div>
        </div>
    );
}
