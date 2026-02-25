"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSession } from "@repo/auth/client";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { getApiBase } from "@/lib/utils";
import {
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
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    ToolInvocationCard,
    CodeDiffCard,
    isDiffResult,
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtContent,
    ChainOfThoughtStep,
    type PromptInputMessage,
    type ToolActivity
} from "@repo/ui";
import {
    SparklesIcon,
    CopyIcon,
    LoaderIcon,
    PaperclipIcon,
    ImageIcon,
    XIcon,
    MicIcon,
    FileIcon,
    PlusIcon
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SidekickSidebarProps {
    pageContext: {
        page: string;
        summary?: string;
    };
    onAction?: () => void;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

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

function SidekickVoiceInputButton({ containerId }: { containerId: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const insertTextIntoTextarea = useCallback(
        (text: string) => {
            const container = document.getElementById(containerId);
            const textarea = container?.querySelector("textarea") as HTMLTextAreaElement | null;
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
        },
        [containerId]
    );

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const { mimeType, extension } = getSupportedMimeType();
            const recorderOptions: MediaRecorderOptions = {};
            if (mimeType) recorderOptions.mimeType = mimeType;

            const mediaRecorder = new MediaRecorder(stream, recorderOptions);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
                    if (!response.ok) throw new Error(`STT failed: ${response.status}`);
                    const data = await response.json();
                    if (data.transcript) insertTextIntoTextarea(data.transcript);
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
        if (isRecording) stopRecording();
        else void startRecording();
    }, [isRecording, startRecording, stopRecording]);

    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) return null;

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

function SidekickAttachmentPreview() {
    const attachments = usePromptInputAttachments();
    if (attachments.files.length === 0) return null;

    return (
        <PromptInputHeader>
            <div className="flex flex-wrap gap-2 px-3 pt-2">
                {attachments.files.map((file) => {
                    const isImage = file.mediaType?.startsWith("image/");
                    return (
                        <div key={file.id} className="group relative">
                            {isImage ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={file.url}
                                    alt={file.filename || "Image"}
                                    className="h-12 w-12 rounded-lg border object-cover"
                                />
                            ) : (
                                <div className="bg-secondary flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px]">
                                    <FileIcon className="size-3 opacity-60" />
                                    <span className="max-w-[80px] truncate">
                                        {file.filename || "File"}
                                    </span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => attachments.remove(file.id)}
                                className="bg-foreground/80 text-background absolute -top-1 -right-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <XIcon className="size-2.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </PromptInputHeader>
    );
}

function SidekickActionMenu() {
    const attachments = usePromptInputAttachments();
    const imageInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0)
                        attachments.add(e.target.files);
                    e.target.value = "";
                }}
            />
            <PromptInputActionMenu>
                <PromptInputActionMenuTrigger>
                    <PlusIcon className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent className="w-48">
                    <PromptInputActionMenuItem
                        onClick={() => attachments.openFileDialog()}
                        closeOnClick={false}
                    >
                        <PaperclipIcon className="mr-2 size-4 opacity-60" />
                        Upload files
                    </PromptInputActionMenuItem>
                    <PromptInputActionMenuItem
                        onClick={() => imageInputRef.current?.click()}
                        closeOnClick={false}
                    >
                        <ImageIcon className="mr-2 size-4 opacity-60" />
                        Upload image
                    </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
            </PromptInputActionMenu>
        </>
    );
}

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

function SidekickReasoningDisplay({ text }: { text: string }) {
    const steps = useMemo(() => parseReasoningSteps(text), [text]);
    if (steps.length === 0) return null;

    return (
        <ChainOfThought defaultOpen>
            <ChainOfThoughtHeader>Thought process</ChainOfThoughtHeader>
            <ChainOfThoughtContent>
                {steps.map((step, i) => (
                    <ChainOfThoughtStep
                        key={i}
                        label={step.label}
                        description={step.description}
                        status="complete"
                    />
                ))}
            </ChainOfThoughtContent>
        </ChainOfThought>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SidekickSidebar({ pageContext, onAction }: SidekickSidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();
    const [threadId] = useState(() => `sidekick-${pageContext.page}-${Date.now()}`);
    const [toolStartTimes, setToolStartTimes] = useState<Map<string, number>>(new Map());
    const containerId = "sidekick-sidebar-input";

    const transport = useMemo(() => {
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/sidekick/chat`,
            body: {
                threadId,
                requestContext: {
                    userId: session?.user?.id || "sidekick-user",
                    mode: "live",
                    pageContext
                }
            }
        });
    }, [threadId, session?.user?.id, pageContext]);

    const { messages, sendMessage, status, stop } = useChat({
        transport,
        id: threadId
    });

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";

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

    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming && !effectivelyReady
          ? ("streaming" as const)
          : undefined;

    const activeTools: ToolActivity[] = useMemo(() => {
        if (!submitStatus) return [];
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

    // Track tool start times
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync tool timing state from message stream
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

    // Fire onAction when tool calls complete
    const prevToolCountRef = useRef(0);
    useEffect(() => {
        if (!onAction) return;
        let completedCount = 0;
        for (const msg of messages) {
            for (const part of msg.parts || []) {
                if (part.type === "tool-invocation") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const inv = (part as any).toolInvocation || part;
                    if ("result" in inv) completedCount++;
                }
            }
        }
        if (completedCount > prevToolCountRef.current) {
            onAction();
        }
        prevToolCountRef.current = completedCount;
    }, [messages, onAction]);

    const handleSend = useCallback(
        (message: PromptInputMessage) => {
            if (!message.text.trim()) return;
            if (message.files && message.files.length > 0) {
                void sendMessage({ text: message.text, files: message.files });
            } else {
                void sendMessage({ text: message.text });
            }
        },
        [sendMessage]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderPart = (part: any, index: number) => {
        if (part.type === "text") {
            return <MessageResponse key={index}>{part.text}</MessageResponse>;
        }
        if (part.type === "file") {
            const isImage = part.mediaType?.startsWith("image/");
            if (isImage && part.url) {
                return (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        key={index}
                        src={part.url}
                        alt={part.filename || "Image"}
                        className="max-h-48 max-w-full rounded-lg"
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
            return (
                <SidekickReasoningDisplay key={index} text={part.reasoning || part.text || ""} />
            );
        }
        if (part.type === "tool-invocation") {
            const toolName = part.toolInvocation?.toolName || "unknown";
            const hasResult = "result" in (part.toolInvocation || {});
            const callId = part.toolInvocation?.toolCallId || `tool-${index}`;
            const startTime = toolStartTimes.get(callId);
            const toolInput = part.toolInvocation?.input || part.toolInvocation?.args;
            const toolResult = hasResult ? part.toolInvocation?.result : undefined;
            const toolError =
                part.toolInvocation?.state === "output-error"
                    ? part.toolInvocation?.errorText || "Tool execution failed"
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
                />
            );
        }
        return null;
    };

    const hasMessages = messages.length > 0;

    return (
        <>
            {/* Floating toggle button */}
            <button
                onClick={() => setIsOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
                aria-label="Open Sidekick"
            >
                <SparklesIcon className="size-5" />
            </button>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="right" className="flex w-[420px] flex-col p-0 sm:max-w-[420px]">
                    <SheetHeader className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="text-primary size-4" />
                            <SheetTitle className="text-base">Sidekick</SheetTitle>
                        </div>
                    </SheetHeader>

                    {/* Chat area */}
                    <div className="flex min-h-0 flex-1 flex-col">
                        {!hasMessages ? (
                            <div className="flex flex-1 flex-col items-center justify-center px-6">
                                <SparklesIcon className="text-primary/50 mb-3 size-8" />
                                <p className="text-foreground/80 mb-1 text-center text-sm font-medium">
                                    How can I help?
                                </p>
                                <p className="text-muted-foreground max-w-[280px] text-center text-xs">
                                    {pageContext.page === "schedule"
                                        ? 'I can create, edit, or manage your automations. Try "Create a daily 9am schedule for the research agent"'
                                        : `I can help you with the ${pageContext.page} page.`}
                                </p>
                                {pageContext.summary && (
                                    <p className="text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-[11px]">
                                        {pageContext.summary}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="min-h-0 flex-1">
                                <Conversation className="h-full">
                                    <ConversationContent className="px-4">
                                        <ConversationScrollButton />
                                        {messages.map((message) => (
                                            <Message key={message.id} from={message.role}>
                                                <MessageContent>
                                                    {message.parts && message.parts.length > 0 ? (
                                                        message.parts.map((part, idx) =>
                                                            renderPart(part, idx)
                                                        )
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
                                                {message.role === "assistant" &&
                                                    (() => {
                                                        const hasTextContent = message.parts?.some(
                                                            (p) =>
                                                                p.type === "text" &&
                                                                (p as { text: string }).text.trim()
                                                                    .length > 0
                                                        );
                                                        const isLastMsg =
                                                            message.id ===
                                                            messages[messages.length - 1]?.id;
                                                        const isCurrentlyStreaming =
                                                            isLastMsg &&
                                                            (isStreaming || isSubmitted);
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
                                                                                    (p) =>
                                                                                        p.type ===
                                                                                        "text"
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
                                                                        navigator.clipboard.writeText(
                                                                            text
                                                                        );
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
                                            agentName="Sidekick"
                                            activeTools={activeTools}
                                        />
                                    </ConversationContent>
                                </Conversation>
                            </div>
                        )}

                        {/* Input */}
                        <div id={containerId} className="shrink-0 border-t px-3 py-3">
                            <div className="bg-card rounded-xl border shadow-sm">
                                <PromptInput
                                    onSubmit={handleSend}
                                    multiple
                                    maxFiles={5}
                                    maxFileSize={10 * 1024 * 1024}
                                    className="border-none shadow-none"
                                >
                                    <SidekickAttachmentPreview />
                                    <PromptInputBody>
                                        <PromptInputTextarea
                                            placeholder="Ask me anything..."
                                            className="min-h-[40px] px-3 pt-2.5 text-sm"
                                        />
                                    </PromptInputBody>
                                    <PromptInputFooter className="gap-1.5 px-3 pb-2.5">
                                        <PromptInputTools className="gap-1">
                                            <SidekickActionMenu />
                                            <SidekickVoiceInputButton containerId={containerId} />
                                        </PromptInputTools>
                                        <PromptInputSubmit
                                            className="shrink-0"
                                            status={submitStatus}
                                            onStop={stop}
                                        />
                                    </PromptInputFooter>
                                </PromptInput>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
