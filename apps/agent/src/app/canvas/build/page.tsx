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
    Loader,
    Skeleton,
    type PromptInputMessage
} from "@repo/ui";
import { CanvasRenderer, type CanvasSchemaForRenderer } from "@repo/ui/components/canvas";
import {
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    ExternalLinkIcon,
    RefreshCwIcon
} from "lucide-react";
import Link from "next/link";

const CANVAS_BUILDER_SLUG = "canvas-builder";

export default function CanvasBuildPage() {
    const [threadId] = useState(() => `canvas-build-${Date.now()}`);
    const [canvasSlug, setCanvasSlug] = useState<string | null>(null);
    const [schema, setSchema] = useState<CanvasSchemaForRenderer | null>(null);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [previewLoading, setPreviewLoading] = useState(false);
    const [chatCollapsed, setChatCollapsed] = useState(false);

    // Track which canvas slugs we've already loaded to avoid duplicate fetches
    const loadedSlugsRef = useRef<Set<string>>(new Set());
    // Track the last message count we scanned so we don't re-scan old messages
    const lastScannedRef = useRef(0);

    // Chat transport
    const transport = useMemo(() => {
        return new DefaultChatTransport({
            api: `${getApiBase()}/api/agents/${CANVAS_BUILDER_SLUG}/chat`,
            body: {
                threadId,
                requestContext: { userId: "canvas-builder", mode: "live" }
            }
        });
    }, [threadId]);

    const { messages, sendMessage, status, stop } = useChat({ transport });

    const isStreaming = status === "streaming";
    const isSubmitted = status === "submitted";
    const submitStatus = isSubmitted
        ? ("submitted" as const)
        : isStreaming
          ? ("streaming" as const)
          : undefined;

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
    // Also handles the case where the result wasn't available during streaming
    // but is now populated.
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

    return (
        // Fixed height container accounting for the app header (56px / 3.5rem)
        <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
            {/* Chat Panel */}
            <div
                className={`flex flex-col overflow-hidden border-r transition-all ${
                    chatCollapsed ? "w-12" : "w-[400px] min-w-[400px]"
                }`}
            >
                {chatCollapsed ? (
                    <div className="flex h-full flex-col items-center py-3">
                        <button
                            onClick={() => setChatCollapsed(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <PanelLeftOpenIcon className="size-5" />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Chat header */}
                        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Canvas Builder</span>
                                <Badge variant="outline" className="text-xs">
                                    AI
                                </Badge>
                            </div>
                            <button
                                onClick={() => setChatCollapsed(true)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <PanelLeftCloseIcon className="size-4" />
                            </button>
                        </div>

                        {/* Messages -- flex-1 + min-h-0 ensures the Conversation component
                            gets a bounded height and can scroll internally */}
                        <div className="min-h-0 flex-1">
                            <Conversation>
                                <ConversationContent>
                                    <ConversationScrollButton />

                                    {/* Welcome message */}
                                    {messages.length === 0 && (
                                        <div className="p-4">
                                            <p className="text-muted-foreground text-sm">
                                                Describe what you want to build. For example:
                                            </p>
                                            <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                                                <li>
                                                    &ldquo;Build a dashboard showing my HubSpot
                                                    deals pipeline&rdquo;
                                                </li>
                                                <li>
                                                    &ldquo;Create a table of all Jira issues sorted
                                                    by priority&rdquo;
                                                </li>
                                                <li>
                                                    &ldquo;Make a KPI dashboard with revenue, deal
                                                    count, and avg deal size&rdquo;
                                                </li>
                                            </ul>
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

                                    {(isStreaming || isSubmitted) && (
                                        <div className="flex justify-center py-2">
                                            <Loader />
                                        </div>
                                    )}
                                </ConversationContent>
                            </Conversation>
                        </div>

                        {/* Input */}
                        <div className="shrink-0 border-t p-3">
                            <PromptInput onSubmit={handleSend}>
                                <PromptInputBody>
                                    <PromptInputTextarea
                                        placeholder="Describe what you want to build..."
                                        disabled={isStreaming}
                                    />
                                </PromptInputBody>
                                <PromptInputFooter>
                                    <PromptInputTools />
                                    <PromptInputSubmit status={submitStatus} onStop={stop} />
                                </PromptInputFooter>
                            </PromptInput>
                        </div>
                    </>
                )}
            </div>

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
                                    Your canvas will appear here as you build it.
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    Start by describing what you want in the chat.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
