"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@repo/auth/client";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { getApiBase } from "@/lib/utils";
import {
    saveConversation,
    loadConversation,
    generateTitle,
} from "@/lib/conversation-store";
import {
    Badge,
    Button,
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    Message,
    MessageContent,
    MessageActions,
    MessageAction,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
    PromptInputTools,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionMenuItem,
    usePromptInputAttachments,
    Loader,
    type PromptInputMessage
} from "@repo/ui";
import {
    PlusIcon,
    RefreshCwIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CopyIcon,
    LoaderIcon,
    SearchIcon,
    GlobeIcon,
    ImageIcon,
    PaperclipIcon
} from "lucide-react";
import { AgentSelector, type AgentInfo } from "@/components/AgentSelector";
import { ModelSelector, isAnthropicModel, type ModelOverride } from "@/components/ModelSelector";
import { ThinkingToggle } from "@/components/ThinkingToggle";
import { TaskSuggestions } from "@/components/TaskSuggestions";
import { InteractiveQuestions } from "@/components/InteractiveQuestions";
import { CanvasPreviewCard } from "@/components/CanvasPreviewCard";
import { ConversationSidebar } from "@/components/ConversationSidebar";

// ─── Inline sub-components ───────────────────────────────────────────────────

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

function CollapsibleThinking({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="my-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
                {expanded ? (
                    <ChevronDownIcon className="size-3.5" />
                ) : (
                    <ChevronRightIcon className="size-3.5" />
                )}
                <span>Thought process</span>
            </button>
            {expanded && (
                <div className="text-muted-foreground mt-1 rounded-md border p-3 text-xs leading-relaxed">
                    {text}
                </div>
            )}
        </div>
    );
}

function getGreeting(name?: string | null): string {
    const hour = new Date().getHours();
    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";
    if (name) return `${greeting}, ${name.split(" ")[0]}`;
    return greeting;
}

/**
 * Action menu items -- must live inside PromptInput to access attachment context.
 * Each action is fully functional.
 */
function ChatInputActions({ onSendPrompt }: { onSendPrompt: (text: string) => void }) {
    const attachments = usePromptInputAttachments();
    const imageInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {/* Hidden image-only file input */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        attachments.add(e.target.files);
                    }
                    e.target.value = "";
                }}
            />
            <PromptInputActionMenu>
                <PromptInputActionMenuTrigger>
                    <PlusIcon className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent className="w-56">
                    {/* Upload any file */}
                    <PromptInputActionMenuItem
                        onSelect={(e) => {
                            e.preventDefault();
                            attachments.openFileDialog();
                        }}
                    >
                        <PaperclipIcon className="mr-2 size-4 opacity-60" />
                        Upload files
                    </PromptInputActionMenuItem>

                    {/* Upload image (filtered to image/*) */}
                    <PromptInputActionMenuItem
                        onSelect={(e) => {
                            e.preventDefault();
                            imageInputRef.current?.click();
                        }}
                    >
                        <ImageIcon className="mr-2 size-4 opacity-60" />
                        Upload image
                    </PromptInputActionMenuItem>

                    {/* Search knowledge base -- sends a prompt */}
                    <PromptInputActionMenuItem
                        onSelect={() => {
                            const query = window.prompt("What would you like to search for?");
                            if (query?.trim()) {
                                onSendPrompt(`Search the knowledge base for: ${query.trim()}`);
                            }
                        }}
                    >
                        <SearchIcon className="mr-2 size-4 opacity-60" />
                        Search knowledge base
                    </PromptInputActionMenuItem>

                    {/* Fetch from URL -- prompts for URL then sends */}
                    <PromptInputActionMenuItem
                        onSelect={() => {
                            const url = window.prompt("Enter the URL to fetch:");
                            if (url?.trim()) {
                                onSendPrompt(
                                    `Fetch and summarize the content from this URL: ${url.trim()}`
                                );
                            }
                        }}
                    >
                        <GlobeIcon className="mr-2 size-4 opacity-60" />
                        Fetch from URL
                    </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
            </PromptInputActionMenu>
        </>
    );
}

const MODEL_DISPLAY_MAP: Record<string, string> = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "o3-mini": "o3-mini",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-sonnet-4-5-20250514": "Claude Sonnet 4.5",
    "claude-haiku-3-5-20241022": "Claude Haiku 3.5"
};

// ─── Main component ──────────────────────────────────────────────────────────

export default function UnifiedChatPage() {
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [selectedAgentSlug, setSelectedAgentSlug] = useState<string>(
        searchParams.get("agent") || "assistant"
    );
    const [modelOverride, setModelOverride] = useState<ModelOverride | null>(null);
    const [thinkingEnabled, setThinkingEnabled] = useState(false);
    const [threadId, setThreadId] = useState<string>(() => `chat-${Date.now()}`);
    const [agentDefaultModel, setAgentDefaultModel] = useState<string | undefined>(undefined);
    const [agentName, setAgentName] = useState<string>("");
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<string, string>>>(
        {}
    );

    const conversationTitleRef = useRef<string>("");
    const conversationCreatedRef = useRef<string>(new Date().toISOString());

    const currentModelName = modelOverride?.name || agentDefaultModel || null;
    const showThinkingToggle = isAnthropicModel(currentModelName);
    const displayModelName = modelOverride?.name || agentDefaultModel || "";
    const modelDisplayText = MODEL_DISPLAY_MAP[displayModelName] || displayModelName;

    // Transport
    const transport = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyExtra: Record<string, any> = {
            threadId,
            requestContext: { userId: "chat-user", mode: "live" }
        };
        if (modelOverride) bodyExtra.modelOverride = modelOverride;
        if (thinkingEnabled && isAnthropicModel(modelOverride?.name || null)) {
            bodyExtra.thinkingOverride = { type: "enabled", budgetTokens: 10000 };
        }
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${selectedAgentSlug}/chat`,
            body: bodyExtra
        });
    }, [selectedAgentSlug, threadId, modelOverride, thinkingEnabled]);

    const { messages, setMessages, sendMessage, status, stop } = useChat({ transport });
    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const hasMessages = messages.length > 0;
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

    // Handlers
    const handleAgentChange = useCallback(
        (newSlug: string, agent: AgentInfo) => {
            setAgentDefaultModel(agent.modelName);
            setAgentName(agent.name);
            if (newSlug !== selectedAgentSlug) {
                setSelectedAgentSlug(newSlug);
                setMessages([]);
                setThreadId(`chat-${newSlug}-${Date.now()}`);
                setModelOverride(null);
                setThinkingEnabled(false);
            }
        },
        [setMessages, selectedAgentSlug]
    );

    const handleSend = useCallback(
        (message: PromptInputMessage) => {
            if (!message.text.trim() || !selectedAgentSlug) return;
            if (message.files && message.files.length > 0) {
                void sendMessage({ text: message.text, files: message.files });
            } else {
                void sendMessage({ text: message.text });
            }
        },
        [sendMessage, selectedAgentSlug]
    );

    const handleNewConversation = useCallback(() => {
        setMessages([]);
        setThreadId(`chat-${selectedAgentSlug}-${Date.now()}`);
        setQuestionAnswers({});
        conversationTitleRef.current = "";
        conversationCreatedRef.current = new Date().toISOString();
    }, [selectedAgentSlug, setMessages]);

    const handleLoadConversation = useCallback(
        (convId: string) => {
            const { meta, messages: loaded } = loadConversation(convId);
            if (meta) {
                setThreadId(meta.id);
                setSelectedAgentSlug(meta.agentSlug);
                setAgentName(meta.agentName);
                conversationTitleRef.current = meta.title;
                conversationCreatedRef.current = meta.createdAt;
                setMessages(loaded);
                setQuestionAnswers({});
            }
        },
        [setMessages]
    );

    const handleSuggestionSelect = useCallback(
        (prompt: string, agentSlug?: string) => {
            if (agentSlug) setSelectedAgentSlug(agentSlug);
            void sendMessage({ text: prompt });
        },
        [sendMessage]
    );

    // Auto-save (debounced)
    useEffect(() => {
        if (messages.length === 0) return;
        const timer = setTimeout(() => {
            if (!conversationTitleRef.current) {
                const first = messages.find((m) => m.role === "user");
                if (first) {
                    const tp = first.parts?.find((p) => p.type === "text");
                    conversationTitleRef.current = generateTitle(
                        tp ? (tp as { text: string }).text : "New conversation"
                    );
                }
            }
            saveConversation(
                {
                    id: threadId,
                    title: conversationTitleRef.current || "New conversation",
                    agentSlug: selectedAgentSlug,
                    agentName: agentName || selectedAgentSlug,
                    modelName: modelOverride?.name || agentDefaultModel,
                    messageCount: messages.length,
                    createdAt: conversationCreatedRef.current,
                    updatedAt: new Date().toISOString()
                },
                messages
            );
        }, 500);
        return () => clearTimeout(timer);
    }, [messages, threadId, selectedAgentSlug, agentName, modelOverride, agentDefaultModel]);

    // Quick-send for action menu items (search knowledge base, fetch URL)
    const quickSend = useCallback(
        (text: string) => {
            void sendMessage({ text });
        },
        [sendMessage]
    );

    // ── Shared input component ───────────────────────────────────────────
    const chatInput = (
        <PromptInput
            onSubmit={handleSend}
            accept="*"
            multiple
            maxFiles={10}
            maxFileSize={10 * 1024 * 1024}
            className="border-none shadow-none"
        >
            <PromptInputBody>
                <PromptInputTextarea
                    placeholder="How can I help you today?"
                    disabled={isStreaming}
                    className="min-h-[48px] text-[15px]"
                />
            </PromptInputBody>
            <PromptInputFooter>
                <PromptInputTools>
                    <ChatInputActions onSendPrompt={quickSend} />
                    <AgentSelector
                        value={selectedAgentSlug}
                        onChange={handleAgentChange}
                        disabled={isStreaming}
                    />
                    <ModelSelector
                        value={modelOverride?.name || null}
                        agentDefault={agentDefaultModel}
                        onChange={setModelOverride}
                        disabled={isStreaming}
                    />
                    <ThinkingToggle
                        enabled={thinkingEnabled}
                        onChange={setThinkingEnabled}
                        visible={showThinkingToggle}
                    />
                </PromptInputTools>
                <PromptInputSubmit
                    status={submitStatus}
                    onStop={stop}
                    disabled={!selectedAgentSlug}
                />
            </PromptInputFooter>
        </PromptInput>
    );

    // ── Render message parts ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            return <MessageResponse key={index}>{part.text}</MessageResponse>;
        }
        if (part.type === "reasoning") {
            return <CollapsibleThinking key={index} text={part.reasoning || part.text || ""} />;
        }
        if (part.type === "tool-invocation") {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            const callId = part.toolInvocation?.toolCallId || `tool-${index}`;

            if (toolName === "ask_questions") {
                const toolInput = part.toolInvocation?.input || part.toolInvocation?.args || {};
                const saved = questionAnswers[callId];
                return (
                    <InteractiveQuestions
                        key={index}
                        questions={toolInput.questions || []}
                        completed={saved != null}
                        answers={saved}
                        onComplete={(ans) => {
                            setQuestionAnswers((prev) => ({ ...prev, [callId]: ans }));
                            const summary = (toolInput.questions || [])
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .map((q: any) => `${q.question}: ${ans[q.id] || "No preference"}`)
                                .join("\n");
                            void sendMessage({ text: summary });
                        }}
                    />
                );
            }

            // Canvas tools -- render inline preview card
            if (toolName === "canvas-create" || toolName === "canvas-update") {
                const toolInput = part.toolInvocation?.input || part.toolInvocation?.args || {};
                const toolResult = part.toolInvocation?.result;
                const canvasSlug = toolResult?.slug || toolInput?.slug || null;
                const canvasTitle = toolResult?.title || toolInput?.title;

                return (
                    <CanvasPreviewCard
                        key={callId}
                        slug={canvasSlug}
                        title={canvasTitle}
                        hasResult={hasResult}
                    />
                );
            }

            return <CollapsibleToolCall key={index} toolName={toolName} hasResult={hasResult} />;
        }
        return null;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // LANDING STATE -- content at bottom, like CoWork
    // ═════════════════════════════════════════════════════════════════════════
    if (!hasMessages) {
        return (
            <div className="flex h-full">
                <ConversationSidebar
                    activeId={null}
                    onSelect={handleLoadConversation}
                    onNewConversation={handleNewConversation}
                />
                <div className="cowork-bg relative flex flex-1 flex-col">
                    {/* Scrollable area above */}
                    <div className="flex flex-1 flex-col items-center justify-end overflow-y-auto">
                        <div className="w-full max-w-[780px] px-6 pb-4">
                            {/* Greeting */}
                            <div className="mb-8 text-center">
                                <SparklesIcon className="text-primary/70 mx-auto mb-3 size-8" />
                                <h1 className="text-foreground/90 mb-1 text-2xl font-semibold tracking-tight">
                                    {getGreeting(session?.user?.name)}
                                </h1>
                                <p className="text-muted-foreground text-sm">
                                    Pick a task, or ask anything
                                </p>
                            </div>

                            {/* Task suggestions */}
                            {showSuggestions && (
                                <div className="mb-4">
                                    <div className="mb-2.5 flex items-center justify-between px-1">
                                        <span className="text-muted-foreground text-xs">
                                            Pick a task, any task
                                        </span>
                                        <button
                                            onClick={() => setShowSuggestions(false)}
                                            className="text-muted-foreground/60 hover:text-muted-foreground text-xs transition-colors"
                                        >
                                            Hide
                                        </button>
                                    </div>
                                    <TaskSuggestions onSelect={handleSuggestionSelect} />
                                </div>
                            )}

                            {!showSuggestions && (
                                <div className="mb-4 flex justify-center">
                                    <button
                                        onClick={() => setShowSuggestions(true)}
                                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                                    >
                                        Show suggestions
                                        <ChevronDownIcon className="size-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input -- truly fixed at bottom */}
                    <div className="shrink-0 px-6 pb-5">
                        <div className="bg-card mx-auto max-w-[780px] rounded-2xl border shadow-sm">
                            {chatInput}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CHAT STATE
    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div className="flex h-full">
            <ConversationSidebar
                activeId={threadId}
                onSelect={handleLoadConversation}
                onNewConversation={handleNewConversation}
            />
            <div className="flex flex-1 flex-col">
                {/* Context bar */}
                <div className="flex items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                            {agentName || selectedAgentSlug}
                        </span>
                        {modelDisplayText && (
                            <Badge variant="outline" className="text-muted-foreground text-xs">
                                {modelDisplayText}
                            </Badge>
                        )}
                        {thinkingEnabled && (
                            <Badge variant="outline" className="text-xs text-blue-500">
                                Thinking
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNewConversation}
                        className="text-muted-foreground"
                    >
                        <RefreshCwIcon className="mr-1 size-4" />
                        New conversation
                    </Button>
                </div>

                {/* Messages */}
                <div className="min-h-0 flex-1">
                    <Conversation className="h-full">
                        <ConversationContent className="mx-auto max-w-3xl px-6">
                            <ConversationScrollButton />
                            {messages.map((message) => (
                                <Message key={message.id} from={message.role}>
                                    <MessageContent>
                                        {message.parts && message.parts.length > 0 ? (
                                            message.parts.map(renderPart)
                                        ) : (
                                            <MessageResponse>
                                                {String(
                                                    (message as unknown as { content?: string })
                                                        .content || ""
                                                )}
                                            </MessageResponse>
                                        )}
                                    </MessageContent>
                                    {message.role === "assistant" && (
                                        <MessageActions>
                                            <MessageAction
                                                tooltip="Copy"
                                                onClick={() => {
                                                    const text =
                                                        message.parts
                                                            ?.filter((p) => p.type === "text")
                                                            .map(
                                                                (p) => (p as { text: string }).text
                                                            )
                                                            .join("\n") || "";
                                                    navigator.clipboard.writeText(text);
                                                }}
                                            >
                                                <CopyIcon className="size-3.5" />
                                            </MessageAction>
                                        </MessageActions>
                                    )}
                                </Message>
                            ))}
                            {(isStreaming || isSubmitted) && (
                                <div className="flex justify-center py-2">
                                    <Loader />
                                </div>
                            )}
                        </ConversationContent>
                    </Conversation>
                </div>

                {/* Input -- fixed at bottom */}
                <div className="shrink-0 px-6 py-3">
                    <div className="bg-card mx-auto max-w-3xl rounded-2xl border shadow-sm">
                        {chatInput}
                    </div>
                </div>
            </div>
        </div>
    );
}
