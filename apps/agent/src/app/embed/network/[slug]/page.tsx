"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AgentC2Logo } from "@repo/ui";
import { LoaderIcon, SendIcon } from "lucide-react";

interface NetworkEmbedConfig {
    greeting: string;
    suggestions: string[];
    theme: "dark" | "light";
    showToolActivity: boolean;
    poweredByBadge: boolean;
    maxMessagesPerSession: number;
}

interface NetworkEmbedData {
    slug: string;
    name: string;
    description: string | null;
    config: NetworkEmbedConfig;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
}

function NetworkEmbedInner() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const slug = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

    const [embedData, setEmbedData] = useState<NetworkEmbedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [threadId] = useState(() => `embed-${Date.now()}`);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!token || !slug) return;

        fetch(`/api/networks/${slug}/embed?token=${token}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.slug) {
                    setEmbedData(data);
                } else {
                    setError(data.error || "Failed to load network");
                }
            })
            .catch(() => setError("Failed to load network"))
            .finally(() => setLoading(false));
    }, [token, slug]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || !embedData || !token || sending) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim()
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setSending(true);

        try {
            const res = await fetch(`/api/networks/${embedData.slug}/execute/public`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    threadId
                })
            });

            const data = await res.json();

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.success
                    ? data.outputText || JSON.stringify(data.outputJson, null, 2) || "Done."
                    : data.error || "Something went wrong."
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "Failed to get a response. Please try again."
                }
            ]);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    }, [input, embedData, token, sending, threadId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">Missing token parameter</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <LoaderIcon className="size-5 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error || !embedData) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">{error || "Network not found"}</p>
            </div>
        );
    }

    const { config } = embedData;
    const maxReached =
        config.maxMessagesPerSession > 0 &&
        messages.filter((m) => m.role === "user").length >= config.maxMessagesPerSession;

    return (
        <div className="flex h-screen flex-col bg-zinc-950 text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                    <h1 className="text-sm font-semibold">{embedData.name}</h1>
                    {embedData.description && (
                        <p className="text-xs text-zinc-400">{embedData.description}</p>
                    )}
                </div>
                {config.poweredByBadge && (
                    <a
                        href="https://agentc2.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <span className="text-[10px]">Powered by</span>
                        <AgentC2Logo className="h-3.5" />
                    </a>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 && config.greeting && (
                    <div className="mb-4 text-center">
                        <p className="text-sm text-zinc-400">{config.greeting}</p>
                        {config.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap justify-center gap-2">
                                {config.suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                                        onClick={() => {
                                            setInput(suggestion);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mx-auto max-w-lg space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                                    msg.role === "user"
                                        ? "bg-white text-zinc-900"
                                        : "bg-zinc-800 text-zinc-200"
                                }`}
                            >
                                <pre className="font-sans whitespace-pre-wrap">{msg.content}</pre>
                            </div>
                        </div>
                    ))}

                    {sending && (
                        <div className="flex justify-start">
                            <div className="rounded-xl bg-zinc-800 px-3 py-2">
                                <LoaderIcon className="size-4 animate-spin text-zinc-400" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="border-t border-zinc-800 p-3">
                {maxReached ? (
                    <p className="text-center text-xs text-zinc-500">
                        Message limit reached for this session.
                    </p>
                ) : (
                    <div className="mx-auto flex max-w-lg items-end gap-2">
                        <textarea
                            ref={inputRef}
                            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                            rows={1}
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={sending}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending}
                            className="flex size-9 items-center justify-center rounded-lg bg-white text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
                        >
                            <SendIcon className="size-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function NetworkEmbedPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
                    <LoaderIcon className="size-5 animate-spin text-zinc-500" />
                </div>
            }
        >
            <NetworkEmbedInner />
        </Suspense>
    );
}
