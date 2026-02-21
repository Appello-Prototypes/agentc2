"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getApiBase } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface VoiceMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

export interface UseVoiceConversationOptions {
    agentSlug: string;
    voiceId?: string;
    threadId?: string;
    /** Auto-listen after the agent finishes speaking (default: true) */
    continuous?: boolean;
    onStateChange?: (state: VoiceState) => void;
    onError?: (error: string) => void;
    onAudioLevel?: (level: number) => void;
}

export interface UseVoiceConversationReturn {
    state: VoiceState;
    messages: VoiceMessage[];
    currentTranscript: string;
    error: string | null;
    isSupported: boolean;
    /** Tap once = start listening.  Tap while speaking/processing = interrupt. */
    toggleVoice: () => void;
    stopAll: () => void;
    clearMessages: () => void;
    audioLevel: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceConversation(
    options: UseVoiceConversationOptions
): UseVoiceConversationReturn {
    const {
        agentSlug,
        voiceId,
        threadId: customThreadId,
        continuous = true,
        onStateChange,
        onError,
        onAudioLevel
    } = options;

    const [state, setState] = useState<VoiceState>("idle");
    const [messages, setMessages] = useState<VoiceMessage[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSupported, setIsSupported] = useState(true);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const threadIdRef = useRef(customThreadId || `voice-${agentSlug}-${Date.now()}`);
    const abortControllerRef = useRef<AbortController | null>(null);
    const audioQueueRef = useRef<HTMLAudioElement[]>([]);
    const isPlayingRef = useRef(false);
    const stateRef = useRef<VoiceState>("idle");
    /** Whether the user has actively engaged (tapped the orb at least once) */
    const conversationActiveRef = useRef(false);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const SR =
            typeof window !== "undefined"
                ? window.SpeechRecognition || window.webkitSpeechRecognition
                : null;
        setIsSupported(!!SR);
    }, []);

    const updateState = useCallback(
        (newState: VoiceState) => {
            setState(newState);
            onStateChange?.(newState);
        },
        [onStateChange]
    );

    // ─── Audio Level Monitoring ──────────────────────────────────────────

    const startAudioMonitoring = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            const buf = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                const rms = Math.sqrt(sum / buf.length) / 255;
                const level = Math.min(1, rms * 2.5);
                setAudioLevel(level);
                onAudioLevel?.(level);
                animationFrameRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) {
            console.error("[Voice] Audio monitor error:", err);
        }
    }, [onAudioLevel]);

    const stopAudioMonitoring = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setAudioLevel(0);
    }, []);

    // ─── Audio Playback ──────────────────────────────────────────────────

    const startListeningInternal = useCallback(() => {
        // Defined below — hoisted reference via ref
        startListeningRef.current?.();
    }, []);

    const playNextAudio = useCallback(() => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            if (stateRef.current === "speaking") {
                // Conversation turn finished — auto-listen if continuous
                if (continuous && conversationActiveRef.current) {
                    // Small gap before re-listening so it feels natural
                    setTimeout(() => {
                        if (stateRef.current === "speaking" || stateRef.current === "idle") {
                            startListeningInternal();
                        }
                    }, 300);
                } else {
                    updateState("idle");
                }
            }
            return;
        }

        isPlayingRef.current = true;
        const audio = audioQueueRef.current.shift()!;
        audio.onended = () => playNextAudio();
        audio.onerror = () => {
            console.error("[Voice] Playback error");
            playNextAudio();
        };
        audio.play().catch((err) => {
            console.error("[Voice] Play failed:", err);
            playNextAudio();
        });
    }, [continuous, updateState, startListeningInternal]);

    const queueAudio = useCallback(
        (base64Mp3: string) => {
            const audio = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
            audioQueueRef.current.push(audio);
            if (!isPlayingRef.current) playNextAudio();
        },
        [playNextAudio]
    );

    const stopAudio = useCallback(() => {
        audioQueueRef.current.forEach((a) => {
            a.pause();
            a.src = "";
        });
        audioQueueRef.current = [];
        isPlayingRef.current = false;
    }, []);

    // ─── Agent Communication ─────────────────────────────────────────────

    const sendToAgent = useCallback(
        async (text: string) => {
            updateState("processing");
            setError(null);

            abortControllerRef.current?.abort();
            const ac = new AbortController();
            abortControllerRef.current = ac;

            try {
                const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/voice`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text,
                        threadId: threadIdRef.current,
                        voiceId,
                        resourceId: "voice-user"
                    }),
                    signal: ac.signal
                });

                if (!res.ok) throw new Error(`API ${res.status}`);

                const reader = res.body?.getReader();
                if (!reader) throw new Error("No body");

                const decoder = new TextDecoder();
                let buffer = "";
                let speaking = false;
                let fullText = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    let evt = "";
                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            evt = line.slice(7).trim();
                        } else if (line.startsWith("data: ") && evt) {
                            try {
                                const d = JSON.parse(line.slice(6));
                                if (evt === "audio") {
                                    if (!speaking) {
                                        speaking = true;
                                        updateState("speaking");
                                    }
                                    queueAudio(d.chunk);
                                } else if (evt === "done") {
                                    fullText = d.response || "";
                                    setMessages((prev) => [
                                        ...prev,
                                        { role: "user", content: text, timestamp: Date.now() },
                                        {
                                            role: "assistant",
                                            content: fullText,
                                            timestamp: Date.now()
                                        }
                                    ]);
                                } else if (evt === "error") {
                                    setError(d.message);
                                    onError?.(d.message);
                                }
                            } catch {
                                /* ignore */
                            }
                            evt = "";
                        }
                    }
                }

                if (!speaking) updateState("idle");
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                const msg = err instanceof Error ? err.message : "Voice failed";
                setError(msg);
                onError?.(msg);
                updateState("idle");
            }
        },
        [agentSlug, voiceId, updateState, queueAudio, onError]
    );

    // ─── Speech Recognition ──────────────────────────────────────────────

    const startListening = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setError("Speech recognition not supported");
            return;
        }

        if (recognitionRef.current) recognitionRef.current.abort();

        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            updateState("listening");
            setCurrentTranscript("");
            setError(null);
            startAudioMonitoring();
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = "";
            let final = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) final += r[0].transcript;
                else interim += r[0].transcript;
            }
            if (final) {
                setCurrentTranscript(final);
                stopAudioMonitoring();
                sendToAgent(final);
            } else {
                setCurrentTranscript(interim);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError(`STT error: ${event.error}`);
                onError?.(`STT error: ${event.error}`);
            }
            stopAudioMonitoring();
            // On error, if continuous, try again after a beat
            if (continuous && conversationActiveRef.current && event.error === "no-speech") {
                setTimeout(() => {
                    if (stateRef.current === "idle" || stateRef.current === "listening") {
                        startListening();
                    }
                }, 200);
            } else {
                updateState("idle");
            }
        };

        recognition.onend = () => {
            if (stateRef.current === "listening") {
                // Speech ended without a final result — auto-restart if continuous
                if (continuous && conversationActiveRef.current) {
                    setTimeout(() => {
                        if (stateRef.current === "listening" || stateRef.current === "idle") {
                            startListening();
                        }
                    }, 200);
                } else {
                    updateState("idle");
                    stopAudioMonitoring();
                }
            }
        };

        recognition.start();
    }, [updateState, startAudioMonitoring, stopAudioMonitoring, sendToAgent, onError, continuous]);

    // Ref so playNextAudio callback can call startListening without stale closure
    const startListeningRef = useRef(startListening);
    useEffect(() => {
        startListeningRef.current = startListening;
    }, [startListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
        stopAudioMonitoring();
    }, [stopAudioMonitoring]);

    // ─── Public API ──────────────────────────────────────────────────────

    /**
     * Single-button voice control:
     *  idle       → start listening (begin conversation)
     *  listening  → stop listening
     *  processing → interrupt (abort request, go idle)
     *  speaking   → interrupt (stop audio, start listening immediately)
     */
    const toggleVoice = useCallback(() => {
        if (state === "idle") {
            conversationActiveRef.current = true;
            startListening();
        } else if (state === "listening") {
            conversationActiveRef.current = false;
            stopListening();
            updateState("idle");
        } else if (state === "processing") {
            // Interrupt: cancel the pending request
            abortControllerRef.current?.abort();
            conversationActiveRef.current = false;
            updateState("idle");
        } else if (state === "speaking") {
            // Interrupt: stop audio and immediately start listening
            stopAudio();
            abortControllerRef.current?.abort();
            startListening();
        }
    }, [state, startListening, stopListening, stopAudio, updateState]);

    const stopAll = useCallback(() => {
        conversationActiveRef.current = false;
        stopListening();
        stopAudio();
        abortControllerRef.current?.abort();
        updateState("idle");
        setCurrentTranscript("");
    }, [stopListening, stopAudio, updateState]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    useEffect(() => {
        return () => {
            conversationActiveRef.current = false;
            recognitionRef.current?.abort();
            stopAudioMonitoring();
            stopAudio();
            abortControllerRef.current?.abort();
        };
    }, [stopAudioMonitoring, stopAudio]);

    return {
        state,
        messages,
        currentTranscript,
        error,
        isSupported,
        toggleVoice,
        stopAll,
        clearMessages,
        audioLevel
    };
}
