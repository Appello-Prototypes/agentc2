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
    generateTitleAsync
} from "@/lib/conversation-store";
import {
    Badge,
    Button,
    Conversation,
    ConversationContent,
    ConversationScrollButton,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    Message,
    MessageContent,
    MessageActions,
    MessageAction,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputHeader,
    PromptInputFooter,
    PromptInputTools,
    PromptInputButton,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionMenuItem,
    usePromptInputAttachments,
    StreamingStatus,
    Plan,
    PlanHeader,
    PlanTitle,
    PlanDescription,
    PlanTrigger,
    PlanContent,
    PlanStep,
    PlanFooter,
    PlanAction,
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
    type PromptInputMessage,
    type ToolActivity
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
    PaperclipIcon,
    XIcon,
    MicIcon,
    FileIcon,
    LayoutGridIcon,
    MessageCircleIcon,
    ZapIcon,
    ClipboardListIcon,
    CheckIcon
} from "lucide-react";
import { AgentSelector, getDefaultAgentSlug, type AgentInfo } from "@/components/AgentSelector";
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

// ─── Input mode types and sub-components ─────────────────────────────────────

type InputMode = "knowledge-search" | "fetch-url" | "create-canvas" | null;

type InteractionMode = "ask" | "agent" | "plan";

const INPUT_MODE_CONFIG: Record<
    NonNullable<InputMode>,
    { label: string; icon: typeof SearchIcon; placeholder: string; prefix: string }
> = {
    "knowledge-search": {
        label: "Knowledge Search",
        icon: SearchIcon,
        placeholder: "Enter a search query...",
        prefix: "Search the knowledge base for: "
    },
    "fetch-url": {
        label: "Fetch from URL",
        icon: GlobeIcon,
        placeholder: "Enter a URL to fetch...",
        prefix: "Fetch and summarize the content from this URL: "
    },
    "create-canvas": {
        label: "Create Canvas",
        icon: LayoutGridIcon,
        placeholder: "Describe the dashboard or report you want to create...",
        prefix: "Create a canvas: "
    }
};

const INTERACTION_MODE_CONFIG: Record<
    InteractionMode,
    { icon: typeof MessageCircleIcon; label: string; description: string }
> = {
    ask: {
        icon: MessageCircleIcon,
        label: "Ask",
        description: "Ask questions without making changes"
    },
    agent: {
        icon: ZapIcon,
        label: "Agent",
        description: "Full agent with tools and actions"
    },
    plan: {
        icon: ClipboardListIcon,
        label: "Plan",
        description: "Create a plan before executing"
    }
};

/**
 * Renders attachment previews (image thumbnails & file chips) + active mode chip
 * inside the PromptInputHeader. Returns null when nothing to show.
 * Must live inside PromptInput to access attachment context.
 */
function InputHeaderArea({ mode, onClearMode }: { mode: InputMode; onClearMode: () => void }) {
    const attachments = usePromptInputAttachments();
    const hasAttachments = attachments.files.length > 0;
    if (!hasAttachments && !mode) return null;

    return (
        <PromptInputHeader>
            {/* Attachment previews */}
            {hasAttachments && (
                <div className="flex flex-wrap gap-2 px-3 pt-2">
                    {attachments.files.map((file) => {
                        const isImage = file.mediaType?.startsWith("image/");
                        return (
                            <div key={file.id} className="group relative">
                                {isImage ? (
                                    /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded blob URL, not optimizable */
                                    <img
                                        src={file.url}
                                        alt={file.filename || "Image"}
                                        className="h-16 w-16 rounded-lg border object-cover"
                                    />
                                ) : (
                                    <div className="bg-secondary flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                                        <FileIcon className="size-4 opacity-60" />
                                        <span className="max-w-[120px] truncate">
                                            {file.filename || "File"}
                                        </span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => attachments.remove(file.id)}
                                    className="bg-foreground/80 text-background absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Active input mode chip */}
            {mode && (
                <div className="flex items-center gap-1 px-3 pt-1.5">
                    {(() => {
                        const config = INPUT_MODE_CONFIG[mode];
                        const Icon = config.icon;
                        return (
                            <span className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                                <Icon className="size-3" />
                                {config.label}
                                <button
                                    type="button"
                                    onClick={onClearMode}
                                    className="hover:bg-primary/20 ml-0.5 rounded-full p-0.5"
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </span>
                        );
                    })()}
                </div>
            )}
        </PromptInputHeader>
    );
}

/**
 * Voice-to-text microphone button using the existing STT endpoint (Whisper).
 * Records audio via MediaRecorder, transcribes, and inserts text into the textarea.
 */
function VoiceInputButton() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const insertTextIntoTextarea = useCallback((text: string) => {
        const textarea = document.querySelector(
            'textarea[name="message"]'
        ) as HTMLTextAreaElement | null;
        if (!textarea) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
        )?.set;
        const current = textarea.value;
        const newValue = current ? `${current} ${text}` : text;
        nativeSetter?.call(textarea, newValue);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                setIsTranscribing(true);

                try {
                    const formData = new FormData();
                    formData.append("audio", audioBlob, "recording.webm");
                    const response = await fetch(`${getApiBase()}/api/demos/voice/stt`, {
                        method: "POST",
                        body: formData
                    });
                    const data = await response.json();
                    if (data.transcript) {
                        insertTextIntoTextarea(data.transcript);
                    }
                } catch (error) {
                    console.error("Transcription failed:", error);
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Microphone access denied:", error);
        }
    }, [insertTextIntoTextarea]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            void startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    // Hide if browser doesn't support MediaRecorder
    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
        return null;
    }

    return (
        <PromptInputButton
            onClick={toggleRecording}
            disabled={isTranscribing}
            className={isRecording ? "animate-pulse text-red-500" : undefined}
            aria-label={isRecording ? "Stop recording" : "Voice input"}
        >
            {isTranscribing ? (
                <LoaderIcon className="size-4 animate-spin" />
            ) : (
                <MicIcon className="size-4" />
            )}
        </PromptInputButton>
    );
}

/**
 * Action menu items -- must live inside PromptInput to access attachment context.
 * Each action is fully functional.
 */
function ChatInputActions({ setInputMode }: { setInputMode: (mode: InputMode) => void }) {
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
                        onClick={() => {
                            attachments.openFileDialog();
                        }}
                        closeOnClick={false}
                    >
                        <PaperclipIcon className="mr-2 size-4 opacity-60" />
                        Upload files
                    </PromptInputActionMenuItem>

                    {/* Upload image (filtered to image/*) */}
                    <PromptInputActionMenuItem
                        onClick={() => {
                            imageInputRef.current?.click();
                        }}
                        closeOnClick={false}
                    >
                        <ImageIcon className="mr-2 size-4 opacity-60" />
                        Upload image
                    </PromptInputActionMenuItem>

                    {/* Search knowledge base -- sets inline input mode */}
                    <PromptInputActionMenuItem
                        onClick={() => {
                            setInputMode("knowledge-search");
                        }}
                    >
                        <SearchIcon className="mr-2 size-4 opacity-60" />
                        Search knowledge base
                    </PromptInputActionMenuItem>

                    {/* Fetch from URL -- sets inline input mode */}
                    <PromptInputActionMenuItem
                        onClick={() => {
                            setInputMode("fetch-url");
                        }}
                    >
                        <GlobeIcon className="mr-2 size-4 opacity-60" />
                        Fetch from URL
                    </PromptInputActionMenuItem>

                    {/* Create Canvas -- sets inline input mode */}
                    <PromptInputActionMenuItem
                        onClick={() => {
                            setInputMode("create-canvas");
                        }}
                    >
                        <LayoutGridIcon className="mr-2 size-4 opacity-60" />
                        Create canvas
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
        searchParams.get("agent") || getDefaultAgentSlug()
    );
    const [modelOverride, setModelOverride] = useState<ModelOverride | null>(null);
    const [thinkingEnabled, setThinkingEnabled] = useState(false);
    const [threadId, setThreadId] = useState<string>(() => `chat-${Date.now()}`);
    const [currentRunId, setCurrentRunId] = useState<string | null>(null);
    const [agentDefaultModel, setAgentDefaultModel] = useState<string | undefined>(undefined);
    const [agentRoutingMode, setAgentRoutingMode] = useState<"locked" | "auto" | null>(null);
    const [agentName, setAgentName] = useState<string>("");
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<string, string>>>(
        {}
    );
    const [inputMode, setInputMode] = useState<InputMode>(null);
    const [interactionMode, setInteractionMode] = useState<InteractionMode>("agent");

    const conversationTitleRef = useRef<string>("");
    const conversationCreatedRef = useRef<string>(new Date().toISOString());
    const titleGenFiredRef = useRef<boolean>(false);
    const pendingMessageRef = useRef<string | null>(null);
    const hasMessagesRef = useRef(false);
    const [titleVersion, setTitleVersion] = useState(0);

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
        // Send runId for conversation continuation (subsequent messages in same conversation)
        if (currentRunId) bodyExtra.runId = currentRunId;
        // Send interaction mode for mode-aware tool filtering
        bodyExtra.interactionMode = interactionMode;
        if (modelOverride) bodyExtra.modelOverride = modelOverride;
        if (thinkingEnabled && isAnthropicModel(modelOverride?.name || null)) {
            bodyExtra.thinkingOverride = { type: "enabled", budgetTokens: 10000 };
        }
        console.log(`[Chat Transport] Building transport for agent: ${selectedAgentSlug}`);
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${selectedAgentSlug}/chat`,
            body: bodyExtra
        });
    }, [
        selectedAgentSlug,
        threadId,
        modelOverride,
        thinkingEnabled,
        currentRunId,
        interactionMode
    ]);

    const { messages, setMessages, sendMessage, status, stop } = useChat({ transport });
    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const hasMessages = messages.length > 0;
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

    // Derive active tool calls from the latest assistant message during streaming
    const activeTools: ToolActivity[] = useMemo(() => {
        if (!submitStatus) return [];
        // Find the last assistant message (the one being streamed)
        const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        if (!lastAssistant?.parts) return [];

        const tools: ToolActivity[] = [];
        for (const part of lastAssistant.parts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = part as any;
            if (p.type === "tool-invocation" && p.toolInvocation) {
                const toolName = p.toolInvocation.toolName || "unknown";
                const callId = p.toolInvocation.toolCallId || toolName;
                const hasResult = "result" in p.toolInvocation;
                tools.push({
                    id: callId,
                    name: toolName,
                    status: hasResult ? "complete" : "running",
                    durationMs: undefined
                });
            }
        }
        return tools;
    }, [submitStatus, messages]);

    // Extract runId from the first assistant message's data-run-metadata part.
    // This persists the runId so subsequent messages are added as turns to the same conversation run.
    // The setState call inside useEffect is intentional here -- we need to sync stream-derived
    // metadata into component state for use in the transport body.
    useEffect(() => {
        if (currentRunId) return; // Already have a runId
        for (const message of messages) {
            if (message.role !== "assistant") continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const part of (message.parts || []) as any[]) {
                if (part.type === "data-run-metadata" && part.data?.runId) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setCurrentRunId(part.data.runId);
                    return;
                }
            }
        }
    }, [messages, currentRunId]);

    // Finalize the current conversation run on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (currentRunId && selectedAgentSlug) {
                const url = `${getApiBase()}/api/agents/${selectedAgentSlug}/chat/finalize`;
                navigator.sendBeacon(url, JSON.stringify({ runId: currentRunId }));
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [currentRunId, selectedAgentSlug]);

    // Handlers
    const handleAgentChange = useCallback(
        (newSlug: string, agent: AgentInfo) => {
            setAgentDefaultModel(agent.modelName);
            setAgentRoutingMode(agent.routingConfig?.mode || null);
            setAgentName(agent.name);
            if (newSlug !== selectedAgentSlug) {
                setSelectedAgentSlug(newSlug);
                setModelOverride(null);
                setThinkingEnabled(false);

                // CRITICAL: Finalize the current conversation run before switching agents.
                // Without this, subsequent messages would try to add turns to the OLD agent's run.
                if (currentRunId) {
                    fetch(`${getApiBase()}/api/agents/${selectedAgentSlug}/chat/finalize`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ runId: currentRunId })
                    }).catch((e) =>
                        console.warn("[Chat] Failed to finalize run on agent switch:", e)
                    );
                }
                setCurrentRunId(null);

                if (hasMessagesRef.current) {
                    // Mid-conversation: start fresh thread for new agent, insert divider
                    setThreadId(`chat-${newSlug}-${Date.now()}`);
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `agent-switch-${Date.now()}`,
                            role: "assistant" as const,
                            content: "",
                            parts: [
                                {
                                    type: "text" as const,
                                    text: `> **Switched to ${agent.name}** — starting a new conversation.`
                                }
                            ]
                        }
                    ]);
                } else {
                    // No messages yet: clean start with new threadId
                    setMessages([]);
                    setThreadId(`chat-${newSlug}-${Date.now()}`);
                }
            }
        },
        [setMessages, selectedAgentSlug, currentRunId]
    );

    const handleSend = useCallback(
        (message: PromptInputMessage) => {
            if (!message.text.trim() || !selectedAgentSlug) return;

            // Apply input mode prefix (knowledge search, fetch URL, create canvas)
            let text = message.text;
            if (inputMode) {
                const config = INPUT_MODE_CONFIG[inputMode];
                text = `${config.prefix}${text}`;
            }

            if (message.files && message.files.length > 0) {
                void sendMessage({ text, files: message.files });
            } else {
                void sendMessage({ text });
            }

            // Reset input mode after sending
            if (inputMode) {
                setInputMode(null);
            }
        },
        [sendMessage, selectedAgentSlug, inputMode]
    );

    const handleNewConversation = useCallback(() => {
        // Finalize the current conversation run before starting a new one
        if (currentRunId && selectedAgentSlug) {
            fetch(`${getApiBase()}/api/agents/${selectedAgentSlug}/chat/finalize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId: currentRunId })
            }).catch((e) => console.warn("[Chat] Failed to finalize run:", e));
        }
        setCurrentRunId(null);
        setMessages([]);
        setThreadId(`chat-${selectedAgentSlug}-${Date.now()}`);
        setQuestionAnswers({});
        conversationTitleRef.current = "";
        conversationCreatedRef.current = new Date().toISOString();
        titleGenFiredRef.current = false;
    }, [selectedAgentSlug, setMessages, currentRunId]);

    const handleLoadConversation = useCallback(
        (convId: string) => {
            const { meta, messages: loaded } = loadConversation(convId);
            if (meta) {
                setThreadId(meta.id);
                setSelectedAgentSlug(meta.agentSlug);
                setAgentName(meta.agentName);
                conversationTitleRef.current = meta.title;
                conversationCreatedRef.current = meta.createdAt;
                titleGenFiredRef.current = true; // already has a title
                setMessages(loaded);
                setQuestionAnswers({});
            }
        },
        [setMessages]
    );

    const handleSuggestionSelect = useCallback(
        (prompt: string, agentSlug?: string) => {
            if (agentSlug && agentSlug !== selectedAgentSlug) {
                // Agent switch needed -- defer send until transport rebuilds
                pendingMessageRef.current = prompt;
                setSelectedAgentSlug(agentSlug);
                setThreadId(`chat-${agentSlug}-${Date.now()}`);
            } else {
                void sendMessage({ text: prompt });
            }
        },
        [sendMessage, selectedAgentSlug]
    );

    // Process deferred sends after agent switch completes
    useEffect(() => {
        if (pendingMessageRef.current) {
            const msg = pendingMessageRef.current;
            pendingMessageRef.current = null;
            void sendMessage({ text: msg });
        }
    }, [selectedAgentSlug, sendMessage]);

    // Keep hasMessagesRef in sync for use in event handlers (handleAgentChange)
    useEffect(() => {
        hasMessagesRef.current = messages.length > 0;
    }, [messages.length]);

    // Auto-save (debounced)
    useEffect(() => {
        if (messages.length === 0) return;
        const timer = setTimeout(() => {
            // Set an immediate client-side title as placeholder
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

            // Fire async LLM title generation once we have a user + assistant exchange
            if (!titleGenFiredRef.current && !isStreaming) {
                const hasUserMsg = messages.some((m) => m.role === "user");
                const hasAssistantMsg = messages.some((m) => m.role === "assistant");
                if (hasUserMsg && hasAssistantMsg) {
                    titleGenFiredRef.current = true;
                    const first = messages.find((m) => m.role === "user");
                    const tp = first?.parts?.find((p) => p.type === "text");
                    const userText = tp ? (tp as { text: string }).text : "";
                    if (userText) {
                        generateTitleAsync(threadId, userText).then((betterTitle) => {
                            conversationTitleRef.current = betterTitle;
                            // Bump titleVersion to trigger sidebar refresh
                            setTitleVersion((v) => v + 1);
                        });
                    }
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [
        messages,
        threadId,
        selectedAgentSlug,
        agentName,
        modelOverride,
        agentDefaultModel,
        isStreaming
    ]);

    // Compute dynamic placeholder based on active input mode
    const textareaPlaceholder = inputMode
        ? INPUT_MODE_CONFIG[inputMode].placeholder
        : "How can I help you today?";

    // ── Mode dropdown config ────────────────────────────────────────────
    const activeModeConfig = INTERACTION_MODE_CONFIG[interactionMode];
    const ActiveModeIcon = activeModeConfig.icon;

    // ── Shared input component ───────────────────────────────────────────
    const chatInput = (
        <PromptInput
            onSubmit={handleSend}
            multiple
            maxFiles={10}
            maxFileSize={10 * 1024 * 1024}
            className="border-none shadow-none"
        >
            <InputHeaderArea mode={inputMode} onClearMode={() => setInputMode(null)} />
            <PromptInputBody>
                <PromptInputTextarea
                    placeholder={textareaPlaceholder}
                    disabled={isStreaming}
                    className="min-h-[48px] text-[15px]"
                />
            </PromptInputBody>
            <PromptInputFooter className="flex-wrap">
                <PromptInputTools className="min-w-0 flex-wrap">
                    {/* Mode Selector Dropdown: Ask / Agent / Plan */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <button
                                    type="button"
                                    className="bg-muted/50 hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                                >
                                    <ActiveModeIcon className="size-3.5" />
                                    {activeModeConfig.label}
                                    <ChevronDownIcon className="text-muted-foreground size-3" />
                                </button>
                            }
                        />
                        <DropdownMenuContent align="start" className="w-56">
                            {(
                                Object.entries(INTERACTION_MODE_CONFIG) as [
                                    InteractionMode,
                                    (typeof INTERACTION_MODE_CONFIG)[InteractionMode]
                                ][]
                            ).map(([mode, config]) => {
                                const ModeIcon = config.icon;
                                return (
                                    <DropdownMenuItem
                                        key={mode}
                                        onClick={() => setInteractionMode(mode)}
                                    >
                                        <div className="flex w-full items-center gap-2.5">
                                            <ModeIcon className="text-muted-foreground size-4 shrink-0" />
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <span className="text-sm font-medium">
                                                    {config.label}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {config.description}
                                                </span>
                                            </div>
                                            {interactionMode === mode && (
                                                <CheckIcon className="text-primary size-4 shrink-0" />
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ChatInputActions setInputMode={setInputMode} />
                    <VoiceInputButton />
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
                    {agentRoutingMode === "auto" && !modelOverride && (
                        <span
                            className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            title="Model routing is enabled — the model will be selected automatically based on input complexity"
                        >
                            Auto
                        </span>
                    )}
                    <ThinkingToggle
                        enabled={thinkingEnabled}
                        onChange={setThinkingEnabled}
                        visible={showThinkingToggle}
                    />
                </PromptInputTools>
                <PromptInputSubmit
                    className="shrink-0"
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
        if (part.type === "file") {
            const isImage = part.mediaType?.startsWith("image/");
            if (isImage && part.url) {
                return (
                    /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL in chat message */
                    <img
                        key={index}
                        src={part.url}
                        alt={part.filename || "Image"}
                        className="max-h-64 max-w-full rounded-lg"
                    />
                );
            }
            return (
                <div key={index} className="text-muted-foreground flex items-center gap-2 text-sm">
                    <FileIcon className="size-4" />
                    <span>{part.filename || "File"}</span>
                </div>
            );
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

        // ── Custom data parts (AI SDK Elements) ────────────────────────
        if (part.type === "data-plan" && part.data) {
            const plan = part.data;
            return (
                <Plan key={index} isStreaming={!plan.complete}>
                    <PlanHeader>
                        <PlanTitle>{plan.title || "Execution Plan"}</PlanTitle>
                        {plan.description && <PlanDescription>{plan.description}</PlanDescription>}
                    </PlanHeader>
                    <PlanTrigger />
                    <PlanContent>
                        {(plan.steps || []).map(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (step: any, si: number) => (
                                <PlanStep
                                    key={si}
                                    label={step.label || step.title || `Step ${si + 1}`}
                                    status={step.status || "pending"}
                                />
                            )
                        )}
                    </PlanContent>
                    {plan.complete && (
                        <PlanFooter>
                            <PlanAction
                                onClick={() => {
                                    void sendMessage({ text: "Execute the plan above." });
                                }}
                            >
                                Build
                            </PlanAction>
                        </PlanFooter>
                    )}
                </Plan>
            );
        }

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
                    refreshKey={titleVersion}
                />
                <div className="cowork-bg relative flex flex-1 flex-col">
                    {/* Scrollable area above */}
                    <div className="flex flex-1 flex-col items-center justify-end overflow-y-auto">
                        <div className="w-full max-w-[780px] px-3 pb-4 md:px-6">
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
                    <div className="shrink-0 px-3 pb-5 md:px-6">
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
                refreshKey={titleVersion}
            />
            <div className="cowork-bg relative flex flex-1 flex-col">
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
                        <ConversationContent className="mx-auto max-w-3xl px-3 md:px-6">
                            <ConversationScrollButton />
                            {messages.map((message) => (
                                <Message key={message.id} from={message.role}>
                                    <MessageContent>
                                        {message.parts && message.parts.length > 0 ? (
                                            message.parts.map(renderPart)
                                        ) : message.role === "assistant" &&
                                          (isStreaming || isSubmitted) &&
                                          message.id === messages[messages.length - 1]?.id ? (
                                            // Shimmer skeleton for empty assistant message while streaming
                                            <div className="flex flex-col gap-2 py-1">
                                                <div className="bg-muted/60 h-3 w-3/4 animate-pulse rounded" />
                                                <div className="bg-muted/40 h-3 w-1/2 animate-pulse rounded" />
                                                <div className="bg-muted/30 h-3 w-2/3 animate-pulse rounded" />
                                            </div>
                                        ) : (
                                            <MessageResponse>
                                                {String(
                                                    (message as unknown as { content?: string })
                                                        .content || ""
                                                )}
                                            </MessageResponse>
                                        )}
                                    </MessageContent>
                                    {message.role === "assistant" &&
                                        (() => {
                                            const hasTextContent = message.parts?.some(
                                                (p) =>
                                                    p.type === "text" &&
                                                    (p as { text: string }).text.trim().length > 0
                                            );
                                            const isLastMessage =
                                                message.id === messages[messages.length - 1]?.id;
                                            const isCurrentlyStreaming =
                                                isLastMessage && (isStreaming || isSubmitted);
                                            if (!hasTextContent || isCurrentlyStreaming)
                                                return null;
                                            return (
                                                <MessageActions>
                                                    <MessageAction
                                                        tooltip="Copy"
                                                        onClick={() => {
                                                            const text =
                                                                message.parts
                                                                    ?.filter(
                                                                        (p) => p.type === "text"
                                                                    )
                                                                    .map(
                                                                        (p) =>
                                                                            (
                                                                                p as {
                                                                                    text: string;
                                                                                }
                                                                            ).text
                                                                    )
                                                                    .join("\n") || "";
                                                            navigator.clipboard.writeText(text);
                                                        }}
                                                    >
                                                        <CopyIcon className="size-3.5" />
                                                    </MessageAction>
                                                </MessageActions>
                                            );
                                        })()}
                                </Message>
                            ))}
                            <StreamingStatus
                                status={submitStatus}
                                hasVisibleContent={(() => {
                                    // Only check the LATEST assistant message, not all messages.
                                    // Previous assistant messages always have text, which would
                                    // cause StreamingStatus to hide immediately on follow-up messages.
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
                                agentName={agentName || undefined}
                                activeTools={activeTools}
                            />
                        </ConversationContent>
                    </Conversation>
                </div>

                {/* Input -- fixed at bottom */}
                <div className="shrink-0 px-3 py-3 md:px-6">
                    <div className="bg-card mx-auto max-w-3xl rounded-2xl border shadow-sm">
                        {chatInput}
                    </div>
                </div>
            </div>
        </div>
    );
}
