"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/lib/audio-player";
import type {
    ClientEvent,
    ConversationMessage,
    ConversationState,
    ServerEvent
} from "@/types/elevenlabs-websocket";

// ============================================================================
// Audio Capture
// ============================================================================

class AudioCapture {
    private mediaStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private onAudioChunk: (chunk: string) => void;

    constructor(onAudioChunk: (chunk: string) => void) {
        this.onAudioChunk = onAudioChunk;
    }

    async start(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Use ScriptProcessorNode for audio capture (deprecated but widely supported)
        // Buffer size of 4096 gives ~256ms chunks at 16kHz
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcmData = this.floatTo16BitPCM(inputData);
            const base64 = this.arrayBufferToBase64(pcmData.buffer as ArrayBuffer);
            this.onAudioChunk(base64);
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    stop(): void {
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
    }

    private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return int16Array;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// ============================================================================
// Hook
// ============================================================================

interface UseElevenLabsAgentOptions {
    agentId?: string; // Direct agent ID (from ElevenLabs dashboard or API)
    onMessage?: (message: ConversationMessage) => void;
    onError?: (error: string) => void;
}

export function useElevenLabsAgent(options: UseElevenLabsAgentOptions = {}) {
    const { agentId, onMessage, onError } = options;

    // State
    const [state, setState] = useState<ConversationState>({
        status: "disconnected",
        agentState: "idle",
        conversationId: null,
        messages: [],
        currentUserTranscript: "",
        currentAgentResponse: "",
        latencyMs: null,
        error: null
    });

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioPlayerRef = useRef<AudioPlayer | null>(null);
    const audioCaptureRef = useRef<AudioCapture | null>(null);
    const pingTimestampRef = useRef<number>(0);

    // Helper to update state
    const updateState = useCallback((updates: Partial<ConversationState>) => {
        setState((prev) => ({ ...prev, ...updates }));
    }, []);

    // Helper to add a message
    const addMessage = useCallback(
        (role: "user" | "agent", content: string, isFinal = true) => {
            const message: ConversationMessage = {
                id: crypto.randomUUID(),
                role,
                content,
                timestamp: new Date(),
                isFinal
            };
            setState((prev) => ({
                ...prev,
                messages: [...prev.messages, message]
            }));
            onMessage?.(message);
        },
        [onMessage]
    );

    // Send message to WebSocket
    const sendMessage = useCallback((event: ClientEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(event));
        }
    }, []);

    // Handle incoming WebSocket messages
    const handleServerEvent = useCallback(
        (event: ServerEvent) => {
            switch (event.type) {
                case "conversation_initiation_metadata":
                    updateState({
                        conversationId: event.conversation_initiation_metadata_event.conversation_id
                    });
                    audioPlayerRef.current?.setOutputFormat(
                        event.conversation_initiation_metadata_event.agent_output_audio_format
                    );
                    break;

                case "user_transcript":
                    updateState({
                        currentUserTranscript: event.user_transcription_event.user_transcript,
                        agentState: "listening"
                    });
                    break;

                case "agent_response":
                    const response = event.agent_response_event.agent_response;
                    updateState({
                        currentAgentResponse: response,
                        agentState: "speaking"
                    });
                    // Add finalized user message when agent starts responding
                    if (state.currentUserTranscript) {
                        addMessage("user", state.currentUserTranscript);
                        updateState({ currentUserTranscript: "" });
                    }
                    break;

                case "agent_response_correction":
                    updateState({
                        currentAgentResponse:
                            event.agent_response_correction_event.corrected_agent_response
                    });
                    break;

                case "audio":
                    audioPlayerRef.current?.addChunk(event.audio_event.audio_base_64);
                    break;

                case "interruption":
                    audioPlayerRef.current?.interrupt();
                    updateState({ agentState: "listening" });
                    break;

                case "ping":
                    pingTimestampRef.current = Date.now();
                    const pingMs = event.ping_event.ping_ms;
                    if (pingMs !== undefined) {
                        setTimeout(() => {
                            sendMessage({ type: "pong", event_id: event.ping_event.event_id });
                            const latency = Date.now() - pingTimestampRef.current;
                            updateState({ latencyMs: latency });
                        }, pingMs);
                    } else {
                        sendMessage({ type: "pong", event_id: event.ping_event.event_id });
                    }
                    break;

                case "client_tool_call":
                    // TODO: Handle client-side tool calls
                    console.log("Client tool call:", event.client_tool_call);
                    break;

                case "vad_score":
                    // Voice activity detection - could use for UI feedback
                    break;

                case "internal_tentative_agent_response":
                    // Tentative response - could use for "thinking" indicator
                    updateState({ agentState: "thinking" });
                    break;
            }
        },
        [state.currentUserTranscript, updateState, addMessage, sendMessage]
    );

    // Start conversation
    const startConversation = useCallback(async () => {
        if (state.status === "connected" || state.status === "connecting") {
            return;
        }

        updateState({ status: "connecting", error: null });

        try {
            // Request microphone permission
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // Get signed URL or use agent ID directly
            let wsUrl: string;
            if (agentId) {
                // For public agents, connect directly
                wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
            } else {
                // Get signed URL from our API
                const url = agentId
                    ? `/api/demos/voice/signed-url?agent=${encodeURIComponent(agentId)}`
                    : "/api/demos/voice/signed-url";
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to get signed URL");
                }
                const { signed_url } = await response.json();
                wsUrl = signed_url;
            }

            // Initialize audio player
            audioPlayerRef.current = new AudioPlayer({
                onPlaybackStart: () => updateState({ agentState: "speaking" }),
                onPlaybackEnd: () => {
                    // Add the agent's response as a message when audio finishes
                    if (state.currentAgentResponse) {
                        addMessage("agent", state.currentAgentResponse);
                        updateState({ currentAgentResponse: "", agentState: "listening" });
                    }
                }
            });
            await audioPlayerRef.current.init();

            // Connect WebSocket
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                updateState({ status: "connected", agentState: "listening" });

                // Send conversation initiation
                sendMessage({ type: "conversation_initiation_client_data" });

                // Start audio capture
                audioCaptureRef.current = new AudioCapture((chunk) => {
                    sendMessage({ user_audio_chunk: chunk });
                });
                await audioCaptureRef.current.start();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as ServerEvent;
                    handleServerEvent(data);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                updateState({ status: "error", error: "WebSocket connection error" });
                onError?.("WebSocket connection error");
            };

            ws.onclose = () => {
                updateState({ status: "disconnected", agentState: "idle" });
                audioCaptureRef.current?.stop();
                audioCaptureRef.current = null;
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to start conversation";
            updateState({ status: "error", error: message });
            onError?.(message);
        }
    }, [
        state.status,
        state.currentAgentResponse,
        agentId,
        updateState,
        sendMessage,
        handleServerEvent,
        addMessage,
        onError
    ]);

    // Stop conversation
    const stopConversation = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        audioCaptureRef.current?.stop();
        audioCaptureRef.current = null;
        audioPlayerRef.current?.dispose();
        audioPlayerRef.current = null;
        updateState({ status: "disconnected", agentState: "idle" });
    }, [updateState]);

    // Send contextual update
    const sendContextualUpdate = useCallback(
        (text: string) => {
            sendMessage({ type: "contextual_update", text });
        },
        [sendMessage]
    );

    // Clear conversation history
    const clearMessages = useCallback(() => {
        setState((prev) => ({ ...prev, messages: [] }));
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            wsRef.current?.close();
            audioCaptureRef.current?.stop();
            audioPlayerRef.current?.dispose();
        };
    }, []);

    return {
        // State
        status: state.status,
        agentState: state.agentState,
        conversationId: state.conversationId,
        messages: state.messages,
        currentUserTranscript: state.currentUserTranscript,
        currentAgentResponse: state.currentAgentResponse,
        latencyMs: state.latencyMs,
        error: state.error,
        isConnected: state.status === "connected",
        isConnecting: state.status === "connecting",

        // Actions
        startConversation,
        stopConversation,
        sendContextualUpdate,
        clearMessages
    };
}
