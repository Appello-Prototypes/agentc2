"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
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
    PromptInputTools,
    StreamingStatus,
    Skeleton,
    type PromptInputMessage
} from "@repo/ui";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import { PanelLeftCloseIcon, PanelLeftIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";

const CANVAS_BUILDER_SLUG = "canvas-builder";

export interface CanvasBuilderPanelProps {
    mode: "build" | "edit";
    existingSlug?: string;
    existingSchema?: CanvasSchemaForRenderer;
    existingData?: Record<string, unknown>;
}

export function CanvasBuilderPanel({
    mode,
    existingSlug,
    existingSchema,
    existingData
}: CanvasBuilderPanelProps) {
    const [threadId] = useState(() => `canvas-${mode}-${existingSlug || "new"}-${Date.now()}`);
    const [canvasSlug, setCanvasSlug] = useState<string | null>(existingSlug || null);
    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(existingSchema || null);
    const [data, setData] = useState<Record<string, unknown>>(existingData || {});
    const [previewLoading, setPreviewLoading] = useState(false);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const isResizing = useRef(false);

    const MIN_WIDTH = 300;
    const MAX_WIDTH = 600;

    const handleResizeStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            isResizing.current = true;
            const startX = e.clientX;
            const startWidth = sidebarWidth;

            const onMouseMove = (ev: MouseEvent) => {
                if (!isResizing.current) return;
                const newWidth = Math.min(
                    MAX_WIDTH,
                    Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX))
                );
                setSidebarWidth(newWidth);
            };

            const onMouseUp = () => {
                isResizing.current = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            };

            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        },
        [sidebarWidth]
    );

    // Track which canvas slugs we've already loaded to avoid duplicate fetches
    const loadedSlugsRef = useRef<Set<string>>(new Set());
    // Track the last message count we scanned so we don't re-scan old messages
    const lastScannedRef = useRef(0);
    // Track if the initial context message has been sent
    const contextSentRef = useRef(false);

    // Chat transport -- in edit mode, include the canvas slug so the agent knows the context
    const transport = useMemo(() => {
        const body: Record<string, unknown> = {
            threadId,
            requestContext: { userId: "canvas-builder", mode: "live" }
        };
        if (mode === "edit" && existingSlug) {
            body.requestContext = {
                userId: "canvas-builder",
                mode: "live",
                editingCanvasSlug: existingSlug
            };
        }
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${CANVAS_BUILDER_SLUG}/chat`,
            body
        });
    }, [threadId, mode, existingSlug]);

    const { messages, sendMessage, status, stop } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

    // In edit mode, send an initial context message so the agent knows what canvas it is editing
    useEffect(() => {
        if (mode === "edit" && existingSlug && existingSchema && !contextSentRef.current) {
            contextSentRef.current = true;
            const schemaStr = JSON.stringify(existingSchema, null, 2);
            // Truncate if extremely large to avoid token issues
            const truncatedSchema =
                schemaStr.length > 8000 ? schemaStr.slice(0, 8000) + "\n..." : schemaStr;
            void sendMessage({
                text:
                    `I want to edit the existing canvas "${existingSlug}". Here is the current schema:\n\n` +
                    "```json\n" +
                    truncatedSchema +
                    "\n```\n\n" +
                    "Please use the canvas-update tool (not canvas-create) when making changes. " +
                    "The slug is: " +
                    existingSlug
            });
        }
    }, [mode, existingSlug, existingSchema, sendMessage]);

    // Refresh preview for a given slug
    const refreshPreview = useCallback(async (slug: string) => {
        setPreviewLoading(true);
        try {
            const canvasRes = await fetch(`${getApiBase()}/api/canvases/${slug}`);
            if (canvasRes.ok) {
                const canvas = await canvasRes.json();
                setSchema(canvas.schemaJson as CanvasSchemaForRenderer);

                const dataRes = await fetch(`${getApiBase()}/api/canvases/${slug}/data`);
                if (dataRes.ok) {
                    const dataResult = await dataRes.json();
                    setData(dataResult.queries || {});
                }
            }
        } catch (err) {
            console.error("Preview refresh error:", err);
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    // Extract a canvas slug from a tool invocation part (checks both input and result)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractCanvasSlug = useCallback((toolPart: any): string | null => {
        const inv = toolPart.toolInvocation;
        if (!inv) return null;

        const toolName = inv.toolName;
        if (toolName !== "canvas-create" && toolName !== "canvas-update") return null;

        // Try result first (available after tool completes)
        if (inv.result?.slug) return inv.result.slug;

        // Try input/args (available immediately when the tool is called)
        const input = inv.input || inv.args;
        if (input?.slug) return input.slug;

        return null;
    }, []);

    // Watch messages for canvas tool calls -- scan all messages for new canvas slugs
    useEffect(() => {
        for (let i = lastScannedRef.current; i < messages.length; i++) {
            const message = messages[i];
            if (!message || message.role !== "assistant") continue;

            for (const part of message.parts || []) {
                if (part.type !== "tool-invocation") continue;

                const slug = extractCanvasSlug(part);
                if (slug && !loadedSlugsRef.current.has(slug)) {
                    loadedSlugsRef.current.add(slug);
                    setCanvasSlug(slug);
                    refreshPreview(slug);
                }
            }
        }
        lastScannedRef.current = messages.length;
    }, [messages, extractCanvasSlug, refreshPreview]);

    // Secondary effect: when streaming completes, do a final scan for any canvas
    // slugs that may have arrived in tool results at the very end of the stream.
    const prevStatusRef = useRef(status);
    useEffect(() => {
        const wasStreaming =
            prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
        const isNowIdle = status !== "streaming" && status !== "submitted";
        prevStatusRef.current = status;

        if (wasStreaming && isNowIdle) {
            // Re-scan all messages now that streaming is complete
            for (const message of messages) {
                if (message.role !== "assistant") continue;
                for (const part of message.parts || []) {
                    if (part.type !== "tool-invocation") continue;
                    const slug = extractCanvasSlug(part);
                    if (slug) {
                        // Always refresh when streaming ends (data may have changed)
                        setCanvasSlug(slug);
                        refreshPreview(slug);
                    }
                }
            }
        }
    }, [status, messages, extractCanvasSlug, refreshPreview]);

    const handleSend = useCallback(
        (message: PromptInputMessage) => {
            if (!message.text.trim()) return;
            void sendMessage({ text: message.text });
        },
        [sendMessage]
    );

    const headerTitle = mode === "edit" ? "Canvas Editor" : "Canvas Builder";
    const placeholderText =
        mode === "edit"
            ? "Describe what you want to change..."
            : "Describe what you want to build...";

    // In edit mode, skip the initial context message in the display
    const displayMessages =
        mode === "edit" && messages.length > 0 && contextSentRef.current
            ? messages.slice(1)
            : messages;

    // Show welcome/context text when no user-visible messages yet.
    // In edit mode during initial context loading, show the editing info so the
    // user sees content immediately instead of a blank area with just a spinner.
    const hasVisibleContent = displayMessages.some((m) =>
        m.parts?.some(
            (p) => (p.type === "text" && p.text.trim().length > 0) || p.type === "tool-invocation"
        )
    );
    const showWelcome = !hasVisibleContent;

    return (
        // Fixed height container accounting for the app header (56px / 3.5rem)
        <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
            {/* Chat Panel */}
            {chatCollapsed ? (
                <div className="relative flex h-full w-10 shrink-0 flex-col items-center border-r pt-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setChatCollapsed(false)}
                    >
                        <PanelLeftIcon className="size-4" />
                    </Button>
                </div>
            ) : (
                <div
                    className="relative flex shrink-0 flex-col border-r"
                    style={{ width: sidebarWidth }}
                >
                    {/* Resize handle */}
                    <div
                        onMouseDown={handleResizeStart}
                        className="hover:bg-primary/20 active:bg-primary/30 absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize"
                    />

                    {/* Collapse toggle -- pinned to right edge */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background absolute top-2.5 right-0 z-30 size-7 translate-x-1/2 rounded-full border shadow-sm"
                        onClick={() => setChatCollapsed(true)}
                    >
                        <PanelLeftCloseIcon className="size-3.5" />
                    </Button>

                    {/* Chat header */}
                    <div className="shrink-0 pt-3 pr-8 pb-2.5 pl-3">
                        <div className="mb-0 px-0.5">
                            <h2 className="text-foreground text-sm font-semibold tracking-tight">
                                {headerTitle}
                            </h2>
                            <p className="text-muted-foreground text-[11px]">
                                {mode === "edit"
                                    ? "Edit your canvas with AI"
                                    : "Build a canvas with AI"}
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <Conversation>
                            <ConversationContent>
                                <ConversationScrollButton />

                                {/* Welcome message */}
                                {showWelcome && (
                                    <div className="p-4">
                                        {mode === "edit" ? (
                                            <>
                                                <p className="text-muted-foreground text-sm">
                                                    Editing canvas:{" "}
                                                    <code className="bg-muted rounded px-1">
                                                        {existingSlug}
                                                    </code>
                                                </p>
                                                {isStreaming || isSubmitted ? (
                                                    <StreamingStatus
                                                        status={submitStatus}
                                                        className="mt-3 justify-start text-xs"
                                                    />
                                                ) : (
                                                    <>
                                                        <p className="text-muted-foreground mt-2 text-sm">
                                                            Describe what you want to change. For
                                                            example:
                                                        </p>
                                                        <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                                                            <li>
                                                                &ldquo;Add a pie chart showing deal
                                                                distribution by stage&rdquo;
                                                            </li>
                                                            <li>
                                                                &ldquo;Change the table columns to
                                                                show owner and close date&rdquo;
                                                            </li>
                                                            <li>
                                                                &ldquo;Remove the KPI cards and add
                                                                a filter bar instead&rdquo;
                                                            </li>
                                                        </ul>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-muted-foreground text-sm">
                                                    Describe what you want to build. For example:
                                                </p>
                                                <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                                                    <li>
                                                        &ldquo;Build a dashboard showing my HubSpot
                                                        deals pipeline&rdquo;
                                                    </li>
                                                    <li>
                                                        &ldquo;Create a table of all Jira issues
                                                        sorted by priority&rdquo;
                                                    </li>
                                                    <li>
                                                        &ldquo;Make a KPI dashboard with revenue,
                                                        deal count, and avg deal size&rdquo;
                                                    </li>
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                )}

                                {displayMessages.map((message) => (
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
                                                            "result" in
                                                            (toolPart.toolInvocation || {});
                                                        return (
                                                            <div
                                                                key={index}
                                                                className="my-2 flex items-center gap-2"
                                                            >
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {
                                                                        toolPart.toolInvocation
                                                                            ?.toolName
                                                                    }
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
                                    placeholder={placeholderText}
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
            )}

            {/* Preview Panel */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Preview header */}
                <div className="bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-2">
                    <span className="text-muted-foreground text-sm">
                        {canvasSlug ? `Preview: ${canvasSlug}` : "Canvas Preview"}
                    </span>
                    <div className="flex items-center gap-2">
                        {canvasSlug && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => refreshPreview(canvasSlug)}
                                    disabled={previewLoading}
                                >
                                    <RefreshCwIcon
                                        className={`mr-1 size-3 ${previewLoading ? "animate-spin" : ""}`}
                                    />
                                    Refresh
                                </Button>
                                <Link href={`/canvas/${canvasSlug}`} target="_blank">
                                    <Button variant="ghost" size="sm">
                                        <ExternalLinkIcon className="mr-1 size-3" />
                                        Open
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Preview content */}
                <div className="flex-1 overflow-auto">
                    {previewLoading ? (
                        <div className="p-4">
                            <Skeleton className="mb-4 h-8 w-64" />
                            <div className="grid grid-cols-12 gap-4">
                                <Skeleton className="col-span-3 h-24" />
                                <Skeleton className="col-span-3 h-24" />
                                <Skeleton className="col-span-3 h-24" />
                                <Skeleton className="col-span-3 h-24" />
                                <Skeleton className="col-span-12 h-64" />
                            </div>
                        </div>
                    ) : schema ? (
                        <CanvasRenderer
                            schema={schema}
                            data={data}
                            onRefresh={canvasSlug ? () => refreshPreview(canvasSlug) : undefined}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-center">
                                <div className="bg-muted mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
                                    <svg
                                        className="text-muted-foreground size-8"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
                                        />
                                    </svg>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    {mode === "edit"
                                        ? "The canvas preview will update as you make changes."
                                        : "Your canvas will appear here as you build it."}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {mode === "edit"
                                        ? "Describe your changes in the chat."
                                        : "Start by describing what you want in the chat."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
