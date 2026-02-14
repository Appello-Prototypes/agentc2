"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useVoiceConversation, type VoiceMessage } from "@/hooks/useVoiceConversation";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentInfo {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    description?: string;
}

// ─── Agent Fetcher ───────────────────────────────────────────────────────────

function useAgents() {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/agents")
            .then((res) => res.json())
            .then((data) => {
                const list = (data.agents || data || []).filter(
                    (a: AgentInfo) => a.isActive !== false
                );
                setAgents(list);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { agents, loading };
}

// ─── State Label ─────────────────────────────────────────────────────────────

function getStateLabel(state: string, currentTranscript: string): string {
    switch (state) {
        case "idle":
            return "Tap to speak";
        case "listening":
            return currentTranscript || "Listening...";
        case "processing":
            return "Thinking...";
        case "speaking":
            return "";
        default:
            return "";
    }
}

// ─── Transcript Bubble ───────────────────────────────────────────────────────

function MessageBubble({ message }: { message: VoiceMessage }) {
    const isUser = message.role === "user";
    return (
        <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isUser
                        ? "bg-white/10 text-white/90"
                        : "border border-white/5 bg-white/5 text-white/80"
                )}
            >
                {message.content}
            </div>
        </div>
    );
}

// ─── Main Voice Page ─────────────────────────────────────────────────────────

export default function VoicePage({ params }: { params: Promise<{ agentSlug: string }> }) {
    const { agentSlug } = use(params);
    const router = useRouter();
    const { agents, loading: agentsLoading } = useAgents();

    const [showTranscript, setShowTranscript] = useState(true);

    const selectedAgent = useMemo(() => {
        if (agents.length === 0) return null;
        return agents.find((a) => a.slug === agentSlug) || null;
    }, [agents, agentSlug]);

    const voice = useVoiceConversation({
        agentSlug,
        onError: (err) => console.error("[Voice Page]", err)
    });

    const handleAgentChange = useCallback(
        (slug: string) => {
            voice.stopAll();
            router.push(`/voice/${slug}`);
        },
        [voice, router]
    );

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && e.target === document.body) {
                e.preventDefault();
                voice.toggleVoice();
            }
            if (e.code === "Escape") {
                voice.stopAll();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [voice]);

    return (
        <div className="relative flex h-dvh w-full flex-col items-center overflow-hidden bg-[#0a0a0f]">
            {/* Ambient background gradient */}
            <div
                className="pointer-events-none absolute inset-0 transition-all duration-1000"
                style={{
                    background:
                        voice.state === "idle"
                            ? "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99, 102, 241, 0.08), transparent 70%)"
                            : voice.state === "listening"
                              ? "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(6, 182, 212, 0.12), transparent 70%)"
                              : voice.state === "processing"
                                ? "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(139, 92, 246, 0.1), transparent 70%)"
                                : "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59, 130, 246, 0.1), transparent 70%)"
                }}
            />

            {/* Top bar */}
            <div className="relative z-10 flex w-full items-center justify-between px-6 pt-6">
                <button
                    onClick={() => router.push("/workspace")}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="flex items-center gap-3">
                    {!agentsLoading && agents.length > 1 && (
                        <select
                            value={agentSlug}
                            onChange={(e) => handleAgentChange(e.target.value)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 backdrop-blur-sm transition-colors outline-none hover:bg-white/10 focus:border-white/20"
                        >
                            {agents.map((a) => (
                                <option key={a.slug} value={a.slug} className="bg-[#1a1a2e]">
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className={cn(
                        "rounded-lg px-3 py-2 text-sm transition-colors",
                        showTranscript
                            ? "bg-white/10 text-white/70"
                            : "text-white/30 hover:bg-white/5 hover:text-white/50"
                    )}
                >
                    {showTranscript ? "Hide transcript" : "Show transcript"}
                </button>
            </div>

            {/* Agent name */}
            <div className="relative z-10 mt-8 text-center">
                <h1 className="text-lg font-medium text-white/80">
                    {selectedAgent?.name || agentSlug}
                </h1>
                {selectedAgent?.description && (
                    <p className="mt-1 max-w-md text-sm text-white/30">
                        {selectedAgent.description}
                    </p>
                )}
            </div>

            {/* Center: Orb */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
                <VoiceOrb
                    state={voice.state}
                    audioLevel={voice.audioLevel}
                    onClick={voice.toggleVoice}
                    size={220}
                />

                {/* State label — minimal, voice-first */}
                <div className="mt-10 h-8 text-center">
                    <p
                        className={cn(
                            "text-sm transition-all duration-300",
                            voice.state === "idle"
                                ? "text-white/30"
                                : voice.state === "listening"
                                  ? "text-cyan-300/70"
                                  : voice.state === "processing"
                                    ? "text-purple-300/70"
                                    : "text-blue-300/60"
                        )}
                    >
                        {getStateLabel(voice.state, voice.currentTranscript)}
                    </p>
                </div>

                {/* Error display */}
                {voice.error && (
                    <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-2">
                        <p className="text-sm text-red-400">{voice.error}</p>
                    </div>
                )}

                {!voice.isSupported && (
                    <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-2">
                        <p className="text-sm text-amber-400">
                            Speech recognition is not supported in this browser. Please use Chrome.
                        </p>
                    </div>
                )}
            </div>

            {/* Transcript panel */}
            {showTranscript && voice.messages.length > 0 && (
                <div className="relative z-10 w-full max-w-xl px-6 pb-8">
                    <div className="rounded-2xl border border-white/5 bg-white/2 p-4 backdrop-blur-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-medium tracking-wider text-white/20 uppercase">
                                Conversation
                            </span>
                            <button
                                onClick={voice.clearMessages}
                                className="text-xs text-white/20 transition-colors hover:text-white/40"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="flex max-h-48 flex-col gap-2.5 overflow-y-auto">
                            {voice.messages.map((msg, i) => (
                                <MessageBubble key={i} message={msg} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom hint */}
            <div className="relative z-10 pb-6 text-center">
                <p className="text-xs text-white/15">
                    Press{" "}
                    <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px]">
                        Space
                    </kbd>{" "}
                    to speak &middot;{" "}
                    <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px]">
                        Esc
                    </kbd>{" "}
                    to stop
                </p>
            </div>
        </div>
    );
}
