"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RealtimeState = "idle" | "connecting" | "connected" | "reconnecting" | "error";
export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

export interface RealtimeMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

export interface UseRealtimeVoiceOptions {
    agentSlug: string;
    onStateChange?: (state: RealtimeState) => void;
    onError?: (error: string) => void;
    onMessage?: (message: RealtimeMessage) => void;
}

export interface UseRealtimeVoiceReturn {
    state: RealtimeState;
    connect: () => Promise<void>;
    disconnect: () => void;
    userTranscript: string;
    agentTranscript: string;
    error: string | null;
    messages: RealtimeMessage[];
    sessionDuration: number;
    connectionQuality: ConnectionQuality;
    activeToolCall: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SESSION_DURATION_S = 14 * 60; // 14 minutes (server timeout ~15min)
const SESSION_WARNING_S = 13 * 60;
const RECONNECT_MAX_ATTEMPTS = 3;
const ICE_RESTART_TIMEOUT_MS = 5000;
const STATS_INTERVAL_MS = 2000;
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
    const { agentSlug, onStateChange, onError, onMessage } = options;

    const [state, setState] = useState<RealtimeState>("idle");
    const [userTranscript, setUserTranscript] = useState("");
    const [agentTranscript, setAgentTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<RealtimeMessage[]>([]);
    const [sessionDuration, setSessionDuration] = useState(0);
    const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("unknown");
    const [activeToolCall, setActiveToolCall] = useState<string | null>(null);

    // Refs for WebRTC objects
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Refs for timers and state tracking
    const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const iceRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const stateRef = useRef<RealtimeState>("idle");
    const messagesRef = useRef<RealtimeMessage[]>([]);
    const sessionStartRef = useRef<number>(0);
    const warningFiredRef = useRef(false);

    // Accumulating transcript parts for the current agent response turn
    const agentTranscriptAccRef = useRef("");
    // Ref to break circular dependency: createConnection <-> attemptReconnect
    const attemptReconnectRef = useRef<() => Promise<void>>(() => Promise.resolve());

    // Keep refs in sync
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const updateState = useCallback(
        (newState: RealtimeState) => {
            setState(newState);
            onStateChange?.(newState);
        },
        [onStateChange]
    );

    // ─── Persistence (client-side) ───────────────────────────────────────

    const persistConversation = useCallback(() => {
        if (messagesRef.current.length === 0) return;

        // Dynamic import to avoid SSR issues with localStorage
        import("@/lib/conversation-store").then(
            ({ saveConversation, generateTitle, generateTitleAsync }) => {
                const threadId = `voice-${agentSlug}-${sessionStartRef.current}`;
                const firstUserMsg = messagesRef.current.find((m) => m.role === "user");
                const title = firstUserMsg
                    ? generateTitle(firstUserMsg.content)
                    : "Voice conversation";
                const now = new Date().toISOString();

                // Convert to the format expected by conversation store
                const serializedMessages = messagesRef.current.map((m) => ({
                    id: `${m.role}-${m.timestamp}`,
                    role: m.role === "assistant" ? "assistant" : "user",
                    content: m.content,
                    createdAt: new Date(m.timestamp).toISOString(),
                    parts: [{ type: "text", text: m.content }]
                }));

                saveConversation(
                    {
                        id: threadId,
                        title,
                        agentSlug,
                        agentName: agentSlug,
                        messageCount: messagesRef.current.length,
                        createdAt: new Date(sessionStartRef.current).toISOString(),
                        updatedAt: now
                    },
                    serializedMessages
                );

                // Generate async LLM title in background
                if (firstUserMsg) {
                    generateTitleAsync(threadId, firstUserMsg.content).catch(() => {});
                }
            }
        );
    }, [agentSlug]);

    // ─── Cleanup Helpers ─────────────────────────────────────────────────

    const clearTimers = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
        if (statsTimerRef.current) {
            clearInterval(statsTimerRef.current);
            statsTimerRef.current = null;
        }
        if (autosaveTimerRef.current) {
            clearInterval(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        if (iceRestartTimerRef.current) {
            clearTimeout(iceRestartTimerRef.current);
            iceRestartTimerRef.current = null;
        }
    }, []);

    const cleanupConnection = useCallback(() => {
        clearTimers();

        if (dcRef.current) {
            dcRef.current.close();
            dcRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        if (audioElRef.current) {
            audioElRef.current.srcObject = null;
            audioElRef.current = null;
        }
    }, [clearTimers]);

    // ─── Connection Quality Monitoring ───────────────────────────────────

    const startStatsMonitoring = useCallback(() => {
        if (statsTimerRef.current) return;
        statsTimerRef.current = setInterval(async () => {
            const pc = pcRef.current;
            if (!pc) return;
            try {
                const stats = await pc.getStats();
                stats.forEach((report) => {
                    if (report.type === "candidate-pair" && report.state === "succeeded") {
                        const rtt = report.currentRoundTripTime;
                        if (typeof rtt === "number") {
                            if (rtt < 0.15) setConnectionQuality("good");
                            else if (rtt < 0.4) setConnectionQuality("fair");
                            else setConnectionQuality("poor");
                        }
                    }
                });
            } catch {
                // Stats unavailable
            }
        }, STATS_INTERVAL_MS);
    }, []);

    // ─── Tool Call Handling ──────────────────────────────────────────────

    const executeToolCall = useCallback(
        async (name: string, args: string, callId: string) => {
            setActiveToolCall(name);
            try {
                let parsedArgs = {};
                try {
                    parsedArgs = JSON.parse(args);
                } catch {
                    // args might not be valid JSON
                }

                const res = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/realtime/tool-execute`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            toolName: name,
                            arguments: parsedArgs,
                            callId
                        })
                    }
                );

                const data = await res.json();
                const output =
                    typeof data.result === "string" ? data.result : JSON.stringify(data.result);

                // Send result back via data channel
                const dc = dcRef.current;
                if (dc && dc.readyState === "open") {
                    dc.send(
                        JSON.stringify({
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output
                            }
                        })
                    );
                    dc.send(JSON.stringify({ type: "response.create" }));
                }
            } catch (err) {
                console.error("[Realtime] Tool execution error:", err);
                // Send error result so the model doesn't hang
                const dc = dcRef.current;
                if (dc && dc.readyState === "open") {
                    dc.send(
                        JSON.stringify({
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output: `Error executing tool: ${err instanceof Error ? err.message : "Unknown error"}`
                            }
                        })
                    );
                    dc.send(JSON.stringify({ type: "response.create" }));
                }
            } finally {
                setActiveToolCall(null);
            }
        },
        [agentSlug]
    );

    // ─── Data Channel Event Handler ──────────────────────────────────────

    const handleDataChannelMessage = useCallback(
        (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case "session.created":
                        reconnectAttemptRef.current = 0;
                        updateState("connected");
                        break;

                    case "response.audio_transcript.delta":
                        if (data.delta) {
                            agentTranscriptAccRef.current += data.delta;
                            setAgentTranscript(agentTranscriptAccRef.current);
                        }
                        break;

                    case "response.audio_transcript.done": {
                        const fullTranscript = data.transcript || agentTranscriptAccRef.current;
                        if (fullTranscript) {
                            const msg: RealtimeMessage = {
                                role: "assistant",
                                content: fullTranscript,
                                timestamp: Date.now()
                            };
                            setMessages((prev) => [...prev, msg]);
                            onMessage?.(msg);
                        }
                        agentTranscriptAccRef.current = "";
                        setAgentTranscript("");
                        break;
                    }

                    case "conversation.item.input_audio_transcription.completed":
                        if (data.transcript) {
                            setUserTranscript(data.transcript);
                            const msg: RealtimeMessage = {
                                role: "user",
                                content: data.transcript,
                                timestamp: Date.now()
                            };
                            setMessages((prev) => [...prev, msg]);
                            onMessage?.(msg);
                        }
                        break;

                    case "response.function_call_arguments.done":
                        if (data.name && data.call_id) {
                            executeToolCall(data.name, data.arguments || "{}", data.call_id);
                        }
                        break;

                    case "error":
                        console.error("[Realtime] Server error:", data.error);
                        setError(data.error?.message || "Realtime API error");
                        onError?.(data.error?.message || "Realtime API error");
                        break;

                    case "session.closed":
                        persistConversation();
                        updateState("idle");
                        cleanupConnection();
                        break;
                }
            } catch {
                // Non-JSON message, ignore
            }
        },
        [updateState, onError, onMessage, executeToolCall, persistConversation, cleanupConnection]
    );

    // ─── WebRTC Connection ───────────────────────────────────────────────

    const createConnection = useCallback(
        async (contextMessages?: RealtimeMessage[]) => {
            // Create peer connection
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // Set up remote audio playback
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            audioElRef.current = audioEl;
            pc.ontrack = (e) => {
                audioEl.srcObject = e.streams[0];
            };

            // Add local audio track
            const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = ms;
            pc.addTrack(ms.getTracks()[0]);

            // Set up data channel
            const dc = pc.createDataChannel("oai-events");
            dcRef.current = dc;

            dc.addEventListener("open", () => {
                // If reconnecting with context, inject prior conversation
                if (contextMessages && contextMessages.length > 0) {
                    const contextSummary = contextMessages
                        .map((m) => `${m.role}: ${m.content}`)
                        .join("\n");
                    dc.send(
                        JSON.stringify({
                            type: "conversation.item.create",
                            item: {
                                type: "message",
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: `[Context from previous session]\n${contextSummary}\n[Continue the conversation naturally.]`
                                    }
                                ]
                            }
                        })
                    );
                }
            });

            dc.addEventListener("message", handleDataChannelMessage);

            dc.addEventListener("close", () => {
                if (stateRef.current === "connected") {
                    persistConversation();
                    updateState("idle");
                    cleanupConnection();
                }
            });

            // ── ICE Resilience ───────────────────────────────────────────

            pc.oniceconnectionstatechange = () => {
                const iceState = pc.iceConnectionState;

                if (iceState === "disconnected") {
                    // Tier 1: ICE restart
                    updateState("reconnecting");
                    setConnectionQuality("poor");
                    pc.restartIce();

                    iceRestartTimerRef.current = setTimeout(() => {
                        if (
                            pc.iceConnectionState !== "connected" &&
                            pc.iceConnectionState !== "completed"
                        ) {
                            attemptReconnectRef.current();
                        }
                    }, ICE_RESTART_TIMEOUT_MS);
                } else if (iceState === "failed") {
                    attemptReconnectRef.current();
                } else if (iceState === "connected" || iceState === "completed") {
                    if (stateRef.current === "reconnecting") {
                        updateState("connected");
                    }
                    if (iceRestartTimerRef.current) {
                        clearTimeout(iceRestartTimerRef.current);
                        iceRestartTimerRef.current = null;
                    }
                }
            };

            // Create and exchange SDP offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpResponse = await fetch(`${getApiBase()}/api/agents/${agentSlug}/realtime`, {
                method: "POST",
                body: offer.sdp,
                headers: { "Content-Type": "application/sdp" }
            });

            if (!sdpResponse.ok) {
                const errBody = await sdpResponse.text();
                let errMsg = `Session creation failed (${sdpResponse.status})`;
                try {
                    const parsed = JSON.parse(errBody);
                    errMsg = parsed.error || errMsg;
                } catch {
                    // Not JSON
                }
                throw new Error(errMsg);
            }

            const sdpAnswer = await sdpResponse.text();
            await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

            // Start monitoring
            startStatsMonitoring();

            // Start duration timer
            sessionStartRef.current = Date.now();
            warningFiredRef.current = false;
            setSessionDuration(0);
            durationTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
                setSessionDuration(elapsed);

                // Session warning at 13 minutes
                if (elapsed >= SESSION_WARNING_S && !warningFiredRef.current) {
                    warningFiredRef.current = true;
                    setError("Voice session ending in 2 minutes");
                    // Clear the warning after 5 seconds
                    setTimeout(() => {
                        setError((prev) =>
                            prev === "Voice session ending in 2 minutes" ? null : prev
                        );
                    }, 5000);
                }

                // Client-side max duration
                if (elapsed >= MAX_SESSION_DURATION_S) {
                    persistConversation();
                    cleanupConnection();
                    updateState("idle");
                    setError("Session time limit reached");
                }
            }, 1000);

            // Autosave every 5 minutes
            autosaveTimerRef.current = setInterval(() => {
                persistConversation();
            }, AUTOSAVE_INTERVAL_MS);
        },
        [
            agentSlug,
            handleDataChannelMessage,
            updateState,
            startStatsMonitoring,
            persistConversation,
            cleanupConnection
        ]
    );

    // ─── Reconnection (Tier 2) ───────────────────────────────────────────

    const attemptReconnect = useCallback(async () => {
        if (reconnectAttemptRef.current >= RECONNECT_MAX_ATTEMPTS) {
            // Tier 3: give up
            persistConversation();
            cleanupConnection();
            updateState("error");
            setError("Connection lost. Please try again.");
            onError?.("Connection lost after multiple reconnection attempts.");
            return;
        }

        reconnectAttemptRef.current += 1;
        updateState("reconnecting");

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, reconnectAttemptRef.current - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Preserve messages for context injection
        const contextMessages = [...messagesRef.current];

        // Teardown old connection
        cleanupConnection();

        try {
            await createConnection(contextMessages);
        } catch (err) {
            console.error("[Realtime] Reconnect attempt failed:", err);
            await attemptReconnectRef.current();
        }
    }, [createConnection, cleanupConnection, updateState, persistConversation, onError]);

    // Keep ref in sync so createConnection can call attemptReconnect without circular dep
    useEffect(() => {
        attemptReconnectRef.current = attemptReconnect;
    }, [attemptReconnect]);

    // ─── Public API ──────────────────────────────────────────────────────

    const connect = useCallback(async () => {
        if (stateRef.current !== "idle" && stateRef.current !== "error") return;

        updateState("connecting");
        setError(null);
        setMessages([]);
        setUserTranscript("");
        setAgentTranscript("");
        setSessionDuration(0);
        setConnectionQuality("unknown");
        reconnectAttemptRef.current = 0;
        agentTranscriptAccRef.current = "";

        try {
            await createConnection();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to connect";
            console.error("[Realtime] Connection failed:", err);
            setError(msg);
            onError?.(msg);
            updateState("error");
            cleanupConnection();
        }
    }, [createConnection, updateState, cleanupConnection, onError]);

    const disconnect = useCallback(() => {
        persistConversation();
        cleanupConnection();
        updateState("idle");
        setUserTranscript("");
        setAgentTranscript("");
    }, [persistConversation, cleanupConnection, updateState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (messagesRef.current.length > 0 && stateRef.current !== "idle") {
                // Best-effort persist on unmount
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const store = require("@/lib/conversation-store");
                    const threadId = `voice-${agentSlug}-${sessionStartRef.current}`;
                    const firstUserMsg = messagesRef.current.find((m) => m.role === "user");
                    store.saveConversation(
                        {
                            id: threadId,
                            title: firstUserMsg
                                ? store.generateTitle(firstUserMsg.content)
                                : "Voice conversation",
                            agentSlug,
                            agentName: agentSlug,
                            messageCount: messagesRef.current.length,
                            createdAt: new Date(sessionStartRef.current).toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        messagesRef.current.map((m) => ({
                            id: `${m.role}-${m.timestamp}`,
                            role: m.role,
                            content: m.content,
                            createdAt: new Date(m.timestamp).toISOString(),
                            parts: [{ type: "text", text: m.content }]
                        }))
                    );
                } catch {
                    // Unmount cleanup is best-effort
                }
            }
            cleanupConnection();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        state,
        connect,
        disconnect,
        userTranscript,
        agentTranscript,
        error,
        messages,
        sessionDuration,
        connectionQuality,
        activeToolCall
    };
}
