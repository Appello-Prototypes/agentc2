"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useSession } from "@repo/auth/client";
import {
    Button,
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
    Loader,
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
    MessageResponse,
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    buttonVariants
} from "@repo/ui";
import { CopyIcon, RefreshCwIcon, UploadCloudIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

type OrganizationResponse = {
    success: boolean;
    organization?: { id: string; name: string };
    error?: string;
};

export default function McpSetupChatPage() {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [orgError, setOrgError] = useState<string | null>(null);
    const [threadId, setThreadId] = useState(() => `mcp-setup-${Date.now()}`);
    const [input, setInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (userId) {
            const timeoutId = setTimeout(() => {
                setThreadId(`mcp-setup-${userId}-${Date.now()}`);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
        return;
    }, [userId]);

    useEffect(() => {
        const fetchOrganization = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/user/organization`);
                const data = (await response.json()) as OrganizationResponse;
                if (!data.success || !data.organization) {
                    setOrgError(data.error || "Unable to load organization");
                    return;
                }
                setOrganizationId(data.organization.id);
            } catch (error) {
                setOrgError(error instanceof Error ? error.message : "Unable to load organization");
            }
        };

        fetchOrganization();
    }, []);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${getApiBase()}/api/agents/mcp-setup-agent/chat`,
                body: {
                    threadId,
                    requestContext: {
                        userId,
                        metadata: {
                            organizationId: organizationId || undefined
                        },
                        mode: "workspace"
                    }
                }
            }),
        [threadId, userId, organizationId]
    );

    const { messages, setMessages, sendMessage, status, regenerate } = useChat({ transport });

    const handleSubmit = async () => {
        if (!input.trim() || status !== "ready") return;
        await sendMessage({ text: input });
        setInput("");
    };

    const handleNewConversation = () => {
        setMessages([]);
        setThreadId(`mcp-setup-${userId || "anonymous"}-${Date.now()}`);
    };

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleFileUpload = async (file: File) => {
        if (status !== "ready" || orgError) return;
        const text = await file.text();
        if (!text.trim()) return;
        await sendMessage({ text });
    };

    const suggestions = [
        "Paste an mcp.json and set everything up",
        "Here is my MCP config, please import and verify it",
        "Set up these MCP servers from this text",
        "Import and test every MCP connection in this file"
    ];

    const handleSuggestion = async (text: string) => {
        setInput("");
        await sendMessage({ text });
    };

    return (
        <div className="container mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col gap-4 py-6">
            <div className="flex shrink-0 items-center justify-between border-b pb-4">
                <div>
                    <div className="mb-2">
                        <Link
                            href="/mcp"
                            className={buttonVariants({
                                variant: "outline",
                                size: "sm"
                            })}
                        >
                            Back to Integrations
                        </Link>
                    </div>
                    <h1 className="text-lg font-semibold">MCP Setup Chat</h1>
                    <p className="text-muted-foreground text-sm">
                        Paste your MCP JSON or unstructured config. AI will import, test, and
                        verify.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleNewConversation}>
                        New setup
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.txt,application/json,text/plain"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                                void handleFileUpload(file);
                                event.currentTarget.value = "";
                            }
                        }}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={status !== "ready" || Boolean(orgError)}
                    >
                        <UploadCloudIcon className="mr-2 size-3.5" />
                        Upload file
                    </Button>
                </div>
            </div>

            {orgError && (
                <div className="text-sm text-red-500">{orgError}. Please reload and try again.</div>
            )}

            <div className="min-h-0 flex-1">
                <Conversation className="h-full min-h-0 overflow-hidden">
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center gap-6">
                                <ConversationEmptyState
                                    title="Import MCPs in seconds"
                                    description="Paste or upload your mcp.json. I will create connections, ask for any missing details, and run tests."
                                />
                                <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => handleSuggestion(s)}
                                            disabled={status !== "ready"}
                                            className="border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg border px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((message, messageIndex) => (
                                <div key={message.id} className="space-y-2">
                                    {message.parts?.map((part, i) => {
                                        if (part.type === "text") {
                                            const isLastAssistant =
                                                message.role === "assistant" &&
                                                messageIndex === messages.length - 1;

                                            return (
                                                <Message
                                                    key={`${message.id}-${i}`}
                                                    from={message.role}
                                                >
                                                    <MessageContent>
                                                        <MessageResponse>
                                                            {part.text}
                                                        </MessageResponse>
                                                    </MessageContent>
                                                    {isLastAssistant && status === "ready" && (
                                                        <MessageActions>
                                                            <MessageAction
                                                                tooltip="Copy"
                                                                onClick={() =>
                                                                    handleCopyMessage(part.text)
                                                                }
                                                            >
                                                                <CopyIcon className="size-3" />
                                                            </MessageAction>
                                                            <MessageAction
                                                                tooltip="Regenerate"
                                                                onClick={() => regenerate()}
                                                            >
                                                                <RefreshCwIcon className="size-3" />
                                                            </MessageAction>
                                                        </MessageActions>
                                                    )}
                                                </Message>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            ))
                        )}

                        {(status === "submitted" || status === "streaming") && <Loader />}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>
            </div>

            <PromptInput onSubmit={handleSubmit} className="shrink-0 border-t pt-4">
                <PromptInputBody>
                    <PromptInputTextarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste your MCP JSON or config text here"
                        disabled={status !== "ready" || Boolean(orgError)}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <PromptInputSubmit
                        status={status}
                        disabled={!input.trim() || Boolean(orgError)}
                    />
                </PromptInputFooter>
            </PromptInput>
        </div>
    );
}
