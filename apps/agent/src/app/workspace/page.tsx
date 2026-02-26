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
    generateTitleAsync,
    updateConversationStatus,
    updateConversationRunId,
    type ConversationMeta
} from "@/lib/conversation-store";
import {
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
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtContent,
    ChainOfThoughtStep,
    ToolInvocationCard,
    CodeDiffCard,
    isDiffResult,
    type PromptInputMessage,
    type ToolActivity
} from "@repo/ui";
import {
    PlusIcon,
    RefreshCwIcon,
    SparklesIcon,
    ChevronDownIcon,
    CopyIcon,
    LoaderIcon,
    SearchIcon,
    GlobeIcon,
    ImageIcon,
    PaperclipIcon,
    XIcon,
    MicIcon,
    FileIcon,
    CheckIcon,
    AlertTriangleIcon,
    ArrowUpCircleIcon,
    PhoneIcon,
    PhoneOffIcon
} from "lucide-react";
import { AgentSelector, getDefaultAgentSlug, type AgentInfo } from "@/components/AgentSelector";
import { TaskSuggestions } from "@/components/TaskSuggestions";
import { InteractiveQuestions } from "@/components/InteractiveQuestions";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { useVoiceConversation, type VoiceState } from "@/hooks/useVoiceConversation";
import {
    useRealtimeVoice,
    type RealtimeState,
    type ConnectionQuality
} from "@/hooks/useRealtimeVoice";
import { useEmbedConfig } from "@/hooks/useEmbedConfig";

// ─── Inline sub-components ───────────────────────────────────────────────────

function parseReasoningSteps(
    text: string
): { label: string; description?: string; status: "complete" | "active" | "pending" }[] {
    if (!text.trim()) return [];

    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    if (paragraphs.length > 1) {
        return paragraphs.map((paragraph) => {
            const lines = paragraph.split("\n").filter(Boolean);
            const label = lines[0] || paragraph.slice(0, 120);
            const rest = lines.slice(1).join("\n").trim();
            return { label, description: rest || undefined, status: "complete" as const };
        });
    }

    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (sentences.length > 1) {
        return sentences.map((sentence) => ({ label: sentence, status: "complete" as const }));
    }

    return [{ label: text.trim(), status: "complete" as const }];
}

function ReasoningDisplay({ text, isStreaming = false }: { text: string; isStreaming?: boolean }) {
    const steps = useMemo(() => parseReasoningSteps(text), [text]);

    if (steps.length === 0 && !isStreaming) return null;

    return (
        <ChainOfThought isStreaming={isStreaming} defaultOpen>
            <ChainOfThoughtHeader>
                {isStreaming ? "Thinking..." : "Thought process"}
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent>
                {steps.map((step, i) => (
                    <ChainOfThoughtStep
                        key={i}
                        label={step.label}
                        description={step.description}
                        status={isStreaming && i === steps.length - 1 ? "active" : "complete"}
                    />
                ))}
            </ChainOfThoughtContent>
        </ChainOfThought>
    );
}

function BudgetExceededCard({
    data,
    agentSlug
}: {
    data: {
        agentId: string;
        currentSpendUsd: number;
        monthlyLimitUsd: number;
    };
    agentSlug: string;
}) {
    const [increasing, setIncreasing] = useState(false);
    const [increased, setIncreased] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleIncreaseBudget = async (addAmount: number) => {
        setIncreasing(true);
        setError(null);
        try {
            const newLimit = data.monthlyLimitUsd + addAmount;
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/budget`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ monthlyLimitUsd: newLimit, enabled: true, hardLimit: true })
            });
            if (!res.ok) throw new Error("Failed to update budget");
            setIncreased(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to increase budget");
        } finally {
            setIncreasing(false);
        }
    };

    if (increased) {
        return (
            <div className="border-border/50 my-3 rounded-xl border bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckIcon className="size-4.5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            Budget increased successfully
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Send your message again to continue.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const percentUsed = Math.round((data.currentSpendUsd / data.monthlyLimitUsd) * 100);

    return (
        <div className="border-border/50 bg-card my-3 rounded-xl border p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                    <AlertTriangleIcon className="size-5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">Monthly Budget Reached</h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        This agent has used its full monthly allocation. Increase the budget to
                        continue.
                    </p>
                </div>
            </div>

            {/* Usage bar */}
            <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">
                        ${data.currentSpendUsd.toFixed(2)} spent
                    </span>
                    <span className="font-medium">${data.monthlyLimitUsd} limit</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                </div>
            </div>

            {/* Quick increase buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
                {[50, 100, 200].map((amount) => (
                    <button
                        key={amount}
                        onClick={() => handleIncreaseBudget(amount)}
                        disabled={increasing}
                        className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                        <ArrowUpCircleIcon className="size-3.5" />
                        Add ${amount}
                    </button>
                ))}
            </div>

            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

            {/* Link to full settings */}
            <p className="text-muted-foreground mt-3 text-[11px]">
                Or{" "}
                <a href={`/agents/${agentSlug}/costs`} className="text-primary hover:underline">
                    manage budget settings
                </a>{" "}
                for full control.
            </p>
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

type InputMode = "knowledge-search" | "fetch-url" | null;

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

function getSupportedMimeType(): { mimeType: string; extension: string } {
    const candidates: { mimeType: string; extension: string }[] = [
        { mimeType: "audio/webm;codecs=opus", extension: "webm" },
        { mimeType: "audio/webm", extension: "webm" },
        { mimeType: "audio/mp4", extension: "m4a" },
        { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
        { mimeType: "audio/wav", extension: "wav" }
    ];
    for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) {
            return c;
        }
    }
    return { mimeType: "", extension: "webm" };
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
            const { mimeType, extension } = getSupportedMimeType();

            const recorderOptions: MediaRecorderOptions = {};
            if (mimeType) recorderOptions.mimeType = mimeType;

            const mediaRecorder = new MediaRecorder(stream, recorderOptions);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                const blobType = mimeType || "audio/webm";
                const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
                setIsTranscribing(true);

                try {
                    const formData = new FormData();
                    formData.append("audio", audioBlob, `recording.${extension}`);
                    const response = await fetch(`${getApiBase()}/api/demos/voice/stt`, {
                        method: "POST",
                        body: formData
                    });
                    if (!response.ok) {
                        throw new Error(`STT request failed: ${response.status}`);
                    }
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

const VOICE_STATE_LABELS: Record<VoiceState, string> = {
    idle: "Tap to start",
    listening: "Listening...",
    processing: "Thinking...",
    speaking: "Speaking..."
};

const REALTIME_STATE_LABELS: Record<RealtimeState, string> = {
    idle: "Tap to connect",
    connecting: "Connecting...",
    connected: "Listening...",
    reconnecting: "Reconnecting...",
    error: "Connection error"
};

const QUALITY_COLORS: Record<ConnectionQuality, string> = {
    good: "bg-green-400",
    fair: "bg-yellow-400",
    poor: "bg-red-400",
    unknown: "bg-white/40"
};

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoiceConversationOverlay({
    agentSlug,
    onClose,
    onSidebarRefresh
}: {
    agentSlug: string;
    onClose: () => void;
    onSidebarRefresh?: () => void;
}) {
    const {
        state,
        connect,
        disconnect,
        userTranscript,
        agentTranscript,
        error,
        sessionDuration,
        connectionQuality,
        activeToolCall
    } = useRealtimeVoice({
        agentSlug,
        onError: (msg) => console.error("[RealtimeVoice]", msg)
    });

    // Auto-connect on mount
    useEffect(() => {
        connect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClose = useCallback(() => {
        disconnect();
        onSidebarRefresh?.();
        onClose();
    }, [disconnect, onClose, onSidebarRefresh]);

    const displayTranscript = agentTranscript || userTranscript;
    const isActive = state === "connected" || state === "reconnecting";

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            {/* Top bar: duration + quality */}
            {isActive && (
                <div className="absolute top-4 left-4 flex items-center gap-3">
                    <span className="font-mono text-sm text-white/60">
                        {formatDuration(sessionDuration)}
                    </span>
                    <span
                        className={`size-2 rounded-full ${QUALITY_COLORS[connectionQuality]}`}
                        title={`Connection: ${connectionQuality}`}
                    />
                </div>
            )}

            <button
                onClick={handleClose}
                className="absolute top-4 right-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close voice conversation"
            >
                <PhoneOffIcon className="size-6" />
            </button>

            <div className="flex flex-col items-center gap-8">
                {/* Pulsing orb */}
                <div className="relative flex size-32 items-center justify-center rounded-full">
                    <div
                        className={[
                            "absolute inset-0 rounded-full transition-all duration-500",
                            state === "connected"
                                ? "animate-pulse bg-blue-500/30"
                                : state === "reconnecting"
                                  ? "animate-pulse bg-yellow-500/20"
                                  : state === "connecting"
                                    ? "animate-pulse bg-white/10"
                                    : state === "error"
                                      ? "bg-red-500/20"
                                      : "bg-white/10"
                        ].join(" ")}
                    />
                    <div
                        className={[
                            "relative flex size-24 items-center justify-center rounded-full transition-colors duration-300",
                            state === "connected"
                                ? "bg-blue-500"
                                : state === "reconnecting"
                                  ? "bg-yellow-500"
                                  : state === "connecting"
                                    ? "bg-white/20"
                                    : state === "error"
                                      ? "bg-red-500"
                                      : "bg-white/20"
                        ].join(" ")}
                    >
                        {state === "connecting" || state === "reconnecting" ? (
                            <LoaderIcon className="size-10 animate-spin text-white" />
                        ) : (
                            <MicIcon className="size-10 text-white" />
                        )}
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-lg font-medium text-white">{REALTIME_STATE_LABELS[state]}</p>
                    {activeToolCall && (
                        <p className="mt-1 text-sm text-blue-300">Using tool: {activeToolCall}</p>
                    )}
                    {displayTranscript && (
                        <p className="mt-2 max-w-md text-sm text-white/60">{displayTranscript}</p>
                    )}
                    {error && <p className="mt-2 max-w-sm text-sm text-red-400">{error}</p>}
                    {state === "error" && (
                        <button
                            onClick={() => connect()}
                            className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
                        >
                            Try again
                        </button>
                    )}
                </div>

                <button
                    onClick={handleClose}
                    className="rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20"
                >
                    End conversation
                </button>
            </div>
        </div>
    );
}

/** @deprecated Kept as fallback -- uses browser SpeechRecognition + SSE TTS */
function LegacyVoiceConversationOverlay({
    agentSlug,
    onClose
}: {
    agentSlug: string;
    onClose: () => void;
}) {
    const { state, currentTranscript, error, isSupported, toggleVoice, stopAll, audioLevel } =
        useVoiceConversation({
            agentSlug,
            continuous: true,
            onError: (msg) => console.error("[VoiceConv]", msg)
        });

    const orbScale = 1 + audioLevel * 0.4;

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close voice conversation"
            >
                <PhoneOffIcon className="size-6" />
            </button>

            <div className="flex flex-col items-center gap-8">
                <button
                    onClick={toggleVoice}
                    className="relative flex size-32 items-center justify-center rounded-full transition-transform"
                    style={{ transform: `scale(${orbScale})` }}
                    aria-label={VOICE_STATE_LABELS[state]}
                >
                    <div
                        className={[
                            "absolute inset-0 rounded-full",
                            state === "listening"
                                ? "animate-pulse bg-red-500/30"
                                : state === "processing"
                                  ? "animate-pulse bg-yellow-500/20"
                                  : state === "speaking"
                                    ? "animate-pulse bg-blue-500/20"
                                    : "bg-white/10"
                        ].join(" ")}
                    />
                    <div
                        className={[
                            "relative flex size-24 items-center justify-center rounded-full",
                            state === "listening"
                                ? "bg-red-500"
                                : state === "processing"
                                  ? "bg-yellow-500"
                                  : state === "speaking"
                                    ? "bg-blue-500"
                                    : "bg-white/20"
                        ].join(" ")}
                    >
                        <MicIcon className="size-10 text-white" />
                    </div>
                </button>

                <div className="text-center">
                    <p className="text-lg font-medium text-white">
                        {!isSupported
                            ? "Speech recognition not supported in this browser"
                            : VOICE_STATE_LABELS[state]}
                    </p>
                    {currentTranscript && (
                        <p className="mt-2 max-w-md text-sm text-white/60">{currentTranscript}</p>
                    )}
                    {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                </div>

                <button
                    onClick={() => {
                        stopAll();
                        onClose();
                    }}
                    className="rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20"
                >
                    End conversation
                </button>
            </div>
        </div>
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
                </PromptInputActionMenuContent>
            </PromptInputActionMenu>
        </>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function UnifiedChatPage() {
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const embedConfig = useEmbedConfig();

    // In Mode 2 (agent), lock to the configured agent
    const lockedAgentSlug = embedConfig?.mode === "agent" ? embedConfig.agentSlug : undefined;

    const [selectedAgentSlug, setSelectedAgentSlug] = useState<string>(
        lockedAgentSlug || searchParams.get("agent") || getDefaultAgentSlug()
    );
    const [threadId, setThreadId] = useState<string>(() => `chat-${Date.now()}`);
    const [currentRunId, setCurrentRunId] = useState<string | null>(null);
    const [agentName, setAgentName] = useState<string>("");
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<string, string>>>(
        {}
    );
    const [inputMode, setInputMode] = useState<InputMode>(null);
    const [voiceConversationActive, setVoiceConversationActive] = useState(false);

    const conversationTitleRef = useRef<string>("");
    const conversationCreatedRef = useRef<string>(new Date().toISOString());
    const conversationUpdatedRef = useRef<string | null>(null);
    const isLoadingRef = useRef<boolean>(false);
    const titleGenFiredRef = useRef<boolean>(false);
    const pendingMessageRef = useRef<string | null>(null);
    const hasMessagesRef = useRef(false);
    const [toolStartTimes, setToolStartTimes] = useState<Map<string, number>>(new Map());
    const [titleVersion, setTitleVersion] = useState(0);

    // Transport
    const transport = useMemo(() => {
        console.log(`[Chat Transport] Building transport for agent: ${selectedAgentSlug}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyExtra: Record<string, any> = {
            threadId,
            requestContext: { userId: session?.user?.id || "chat-user", mode: "live" }
        };
        if (currentRunId) bodyExtra.runId = currentRunId;
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${selectedAgentSlug}/chat`,
            body: bodyExtra
        });
    }, [selectedAgentSlug, threadId, currentRunId, session?.user?.id]);

    const { messages, setMessages, sendMessage, status, stop } = useChat({
        transport,
        id: threadId
    });
    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const hasMessages = messages.length > 0;

    // Optimistic "effectively ready" detection: if the stream is technically
    // still open but no new content has arrived for 2s and we already have
    // visible text, consider the response complete so the UI unlocks fast.
    const [effectivelyReady, setEffectivelyReady] = useState(false);
    const lastContentHashRef = useRef("");
    useEffect(() => {
        if (!isStreaming) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset optimistic flag when stream ends
            setEffectivelyReady(false);
            lastContentHashRef.current = "";
            return;
        }
        const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        const textParts = lastAssistant?.parts?.filter(
            (p) => p.type === "text" && (p as { text: string }).text.length > 0
        );
        if (!textParts || textParts.length === 0) return;

        const hash = textParts.map((p) => (p as { text: string }).text).join("");
        if (hash !== lastContentHashRef.current) {
            lastContentHashRef.current = hash;
            setEffectivelyReady(false);
        }
        const timer = setTimeout(() => setEffectivelyReady(true), 2_000);
        return () => clearTimeout(timer);
    }, [isStreaming, messages]);

    const isBusy = (isStreaming || isSubmitted) && !effectivelyReady;
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming && !effectivelyReady
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
                    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync stream-derived metadata into state
                    setCurrentRunId(part.data.runId);
                    updateConversationRunId(threadId, part.data.runId);
                    return;
                }
            }
        }
    }, [messages, currentRunId, threadId]);

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
            setAgentName(agent.name);

            if (newSlug !== selectedAgentSlug) {
                setSelectedAgentSlug(newSlug);

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
            if (!message.text.trim() || !selectedAgentSlug || isBusy) return;

            // Apply input mode prefix (knowledge search, fetch URL)
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
        [sendMessage, selectedAgentSlug, inputMode, isBusy]
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
        conversationUpdatedRef.current = null;
        isLoadingRef.current = false;
        titleGenFiredRef.current = false;
    }, [selectedAgentSlug, setMessages, currentRunId]);

    // Holds data for a conversation that was clicked in the sidebar.
    // Consumed by the effect below once useChat has re-initialised for the new threadId.
    const pendingLoadRef = useRef<{
        meta: ConversationMeta;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: any[];
    } | null>(null);

    const handleLoadConversation = useCallback((convId: string) => {
        const { meta, messages: loaded } = loadConversation(convId);
        if (!meta) return;

        // Mark as loading so auto-save preserves the original updatedAt
        isLoadingRef.current = true;
        conversationUpdatedRef.current = meta.updatedAt;

        // Store the data to load. The effect below applies setMessages() AFTER
        // useChat has re-initialised for the new threadId, so the messages land
        // in the correct per-id store instead of the old one.
        pendingLoadRef.current = { meta, messages: loaded };

        setThreadId(meta.id);
        setSelectedAgentSlug(meta.agentSlug);
        setCurrentRunId(meta.runId ?? null);
    }, []);

    // Apply the pending conversation load after useChat has re-initialised for
    // the new threadId (i.e. the next effect cycle, not within the same render).
    useEffect(() => {
        if (!pendingLoadRef.current) return;
        const pending = pendingLoadRef.current;
        if (threadId !== pending.meta.id) return;
        pendingLoadRef.current = null;

        setMessages(pending.messages);
        setAgentName(pending.meta.agentName);
        conversationTitleRef.current = pending.meta.title;
        conversationCreatedRef.current = pending.meta.createdAt;
        titleGenFiredRef.current = true;
        setQuestionAnswers({});
    }, [threadId, setMessages]);

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

            // Preserve the original updatedAt when loading a conversation;
            // only stamp a new timestamp when actual new activity occurs.
            let updatedAt: string;
            if (isLoadingRef.current && conversationUpdatedRef.current) {
                updatedAt = conversationUpdatedRef.current;
                isLoadingRef.current = false;
            } else {
                updatedAt = new Date().toISOString();
            }

            saveConversation(
                {
                    id: threadId,
                    title: conversationTitleRef.current || "New conversation",
                    agentSlug: selectedAgentSlug,
                    agentName: agentName || selectedAgentSlug,
                    messageCount: messages.length,
                    createdAt: conversationCreatedRef.current,
                    updatedAt,
                    runId: currentRunId ?? undefined
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
    }, [messages, threadId, selectedAgentSlug, agentName, isStreaming, currentRunId]);

    // Track conversation status (running / completed) and refresh sidebar
    const prevStreamingRef = useRef(false);
    useEffect(() => {
        const wasActive = prevStreamingRef.current;
        const isActive = isStreaming || isSubmitted;
        prevStreamingRef.current = isActive;

        if (isActive && !wasActive && messages.length > 0) {
            updateConversationStatus(threadId, "running");
            // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshing sidebar title after status transition
            setTitleVersion((v) => v + 1);
        } else if (!isActive && wasActive && messages.length > 0) {
            updateConversationStatus(threadId, "completed");
            setTitleVersion((v) => v + 1);
        }
    }, [isStreaming, isSubmitted, threadId, messages.length]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- tracking tool invocation start times from streamed messages
        setToolStartTimes((prev) => {
            let updated = false;
            const next = new Map(prev);
            for (const msg of messages) {
                for (const part of msg.parts || []) {
                    if (part.type === "tool-invocation") {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const inv = (part as any).toolInvocation || part;
                        const callId: string | undefined = inv.toolCallId;
                        const hasResult = "result" in inv;
                        if (callId && !hasResult && !next.has(callId)) {
                            next.set(callId, Date.now());
                            updated = true;
                        }
                    }
                }
            }
            return updated ? next : prev;
        });
    }, [messages]);

    // Compute dynamic placeholder based on active input mode
    const textareaPlaceholder = inputMode
        ? INPUT_MODE_CONFIG[inputMode].placeholder
        : "How can I help you today?";

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
                    className="min-h-[48px] px-3 pt-3 text-[15px]"
                />
            </PromptInputBody>
            <PromptInputFooter className="flex-wrap gap-2 px-3 pb-3">
                <PromptInputTools className="min-w-0 flex-wrap gap-1.5">
                    <ChatInputActions setInputMode={setInputMode} />
                    {!embedConfig && <VoiceInputButton />}
                    {!embedConfig && (
                        <PromptInputButton
                            onClick={() => setVoiceConversationActive(true)}
                            aria-label="Voice conversation"
                            title="Start voice conversation"
                        >
                            <PhoneIcon className="size-4" />
                        </PromptInputButton>
                    )}
                    {!lockedAgentSlug && (
                        <AgentSelector
                            value={selectedAgentSlug}
                            onChange={handleAgentChange}
                            disabled={isBusy}
                        />
                    )}
                </PromptInputTools>
                <PromptInputSubmit
                    className="shrink-0"
                    status={submitStatus}
                    onStop={stop}
                    disabled={!selectedAgentSlug || isBusy}
                />
            </PromptInputFooter>
        </PromptInput>
    );

    // ── Render message parts ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number, message?: { id: string }) => {
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
            return <ReasoningDisplay key={index} text={part.reasoning || part.text || ""} />;
        }
        if (part.type === "tool-invocation") {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            const callId = part.toolInvocation?.toolCallId || `tool-${index}`;

            const startTime = toolStartTimes.get(callId);

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

            const toolInput = part.toolInvocation?.input || part.toolInvocation?.args;
            const toolResult = hasResult ? part.toolInvocation?.result : undefined;
            const toolError =
                part.toolInvocation?.state === "output-error"
                    ? part.toolInvocation?.errorText || "Tool execution failed"
                    : undefined;

            // Human-readable label for network-execute and workflow-execute tools
            const displayLabel =
                toolName === "network-execute" && toolInput?.networkSlug
                    ? `Running ${String(toolInput.networkSlug)} network`
                    : toolName === "workflow-execute" && toolInput?.workflowSlug
                      ? `Running ${String(toolInput.workflowSlug)} workflow`
                      : undefined;

            if (hasResult && !toolError && isDiffResult(toolResult)) {
                return (
                    <CodeDiffCard key={callId} result={String(toolResult)} toolName={toolName} />
                );
            }

            return (
                <ToolInvocationCard
                    key={callId}
                    toolName={toolName}
                    hasResult={hasResult}
                    input={toolInput}
                    result={toolResult}
                    error={toolError}
                    startTime={startTime}
                    displayLabel={displayLabel}
                />
            );
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

        // Budget exceeded — inline upgrade card
        if (part.type === "data-budget-exceeded" && part.data) {
            return (
                <BudgetExceededCard
                    key={index}
                    data={part.data}
                    agentSlug={selectedAgentSlug || "workspace-concierge"}
                />
            );
        }

        return null;
    };

    // Voice conversation overlay (shared between landing and chat states)
    const voiceOverlay = voiceConversationActive && selectedAgentSlug && (
        <VoiceConversationOverlay
            agentSlug={selectedAgentSlug}
            onClose={() => setVoiceConversationActive(false)}
            onSidebarRefresh={() => setTitleVersion((v) => v + 1)}
        />
    );

    // ═════════════════════════════════════════════════════════════════════════
    // LANDING STATE -- content at bottom, like CoWork
    // ═════════════════════════════════════════════════════════════════════════
    if (!hasMessages) {
        return (
            <div className="flex h-full">
                {voiceOverlay}
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
            {voiceOverlay}
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
                                            message.parts.map((part, idx) =>
                                                renderPart(part, idx, message)
                                            )
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
