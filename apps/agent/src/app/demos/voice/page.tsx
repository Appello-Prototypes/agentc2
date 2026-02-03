"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge
} from "@repo/ui";
import { useElevenLabsAgent } from "@/hooks/useElevenLabsAgent";

const openaiSpeakers = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

// ============================================================================
// Live Agent Tab Component (ElevenLabs WebSocket)
// ============================================================================

interface AgentOption {
    key: string;
    name: string;
    description: string;
}

function LiveAgentTab() {
    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(true);

    const {
        status,
        agentState,
        messages,
        currentUserTranscript,
        currentAgentResponse,
        latencyMs,
        error,
        isConnected,
        isConnecting,
        startConversation,
        stopConversation,
        clearMessages
    } = useElevenLabsAgent({ agentId: selectedAgentId || undefined });

    // Fetch available agents from ElevenLabs API on mount
    useEffect(() => {
        let isMounted = true;
        const fetchAgents = async () => {
            try {
                const res = await fetch("/api/demos/voice/signed-url?list=true");
                const data = await res.json();
                if (isMounted && data.agents && data.agents.length > 0) {
                    setAvailableAgents(data.agents);
                    // Select first agent by default
                    setSelectedAgentId((prev) => prev || data.agents[0].key);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted) {
                    setIsLoadingAgents(false);
                }
            }
        };
        fetchAgents();
        return () => {
            isMounted = false;
        };
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case "connected":
                return "bg-green-500";
            case "connecting":
                return "bg-yellow-500 animate-pulse";
            case "error":
                return "bg-red-500";
            default:
                return "bg-gray-400";
        }
    };

    const getAgentStateLabel = () => {
        switch (agentState) {
            case "listening":
                return "Listening...";
            case "thinking":
                return "Thinking...";
            case "speaking":
                return "Speaking...";
            default:
                return "Idle";
        }
    };

    return (
        <TabsContent value="live-agent">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Real-Time Voice Agent
                                <Badge variant="secondary" className="text-xs">
                                    WebSocket
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Low-latency voice conversation powered by ElevenLabs Agents
                                Platform. Supports barge-in (interrupt the agent while speaking).
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            {latencyMs !== null && (
                                <div className="text-muted-foreground text-sm">
                                    RTT: <span className="font-mono">{latencyMs}ms</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
                                <span className="text-sm capitalize">{status}</span>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Agent Selection */}
                    {!isConnected && (
                        <div className="max-w-md">
                            <label className="mb-2 block text-sm font-medium">Select Agent</label>
                            {isLoadingAgents ? (
                                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Loading agents from ElevenLabs...
                                </div>
                            ) : availableAgents.length === 0 ? (
                                <div className="text-muted-foreground text-sm">
                                    No agents found. Create one in the{" "}
                                    <a
                                        href="https://elevenlabs.io/app/agents"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline"
                                    >
                                        ElevenLabs Dashboard
                                    </a>
                                </div>
                            ) : (
                                <>
                                    <Select
                                        value={selectedAgentId}
                                        onValueChange={(value) =>
                                            value && setSelectedAgentId(value)
                                        }
                                        disabled={isConnecting}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an agent...">
                                                {availableAgents.find(
                                                    (a) => a.key === selectedAgentId
                                                )?.name || "Select an agent..."}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableAgents.map((agent) => (
                                                <SelectItem key={agent.key} value={agent.key}>
                                                    {agent.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {availableAgents.find((a) => a.key === selectedAgentId)
                                        ?.description && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {
                                                availableAgents.find(
                                                    (a) => a.key === selectedAgentId
                                                )?.description
                                            }
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
                            <p className="font-medium text-red-600 dark:text-red-400">
                                Connection Error
                            </p>
                            <p className="text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Conversation Display */}
                    <div className="bg-muted/30 min-h-[300px] rounded-lg border p-4">
                        {messages.length === 0 &&
                        !currentUserTranscript &&
                        !currentAgentResponse ? (
                            <div className="text-muted-foreground flex h-[280px] flex-col items-center justify-center text-center">
                                <svg
                                    className="mb-4 h-12 w-12 opacity-50"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                    />
                                </svg>
                                <p className="text-lg font-medium">
                                    {isConnected
                                        ? "Start speaking..."
                                        : "Connect to start a conversation"}
                                </p>
                                <p className="mt-2 text-sm">
                                    {isConnected
                                        ? "The agent is listening. Just speak naturally."
                                        : "Click Connect below to establish a real-time voice connection."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Message History */}
                                {messages.map((message) => (
                                    <div key={message.id} className="flex gap-3">
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                                                message.role === "user"
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                    : "bg-primary/10 text-primary"
                                            }`}
                                        >
                                            {message.role === "user" ? "You" : "AI"}
                                        </div>
                                        <div
                                            className={`flex-1 rounded-lg p-3 ${
                                                message.role === "user"
                                                    ? "bg-muted"
                                                    : "bg-primary/5"
                                            }`}
                                        >
                                            <p>{message.content}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Current User Transcript (live) */}
                                {currentUserTranscript && (
                                    <div className="flex gap-3 opacity-70">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                            You
                                        </div>
                                        <div className="bg-muted flex-1 rounded-lg p-3">
                                            <p>{currentUserTranscript}</p>
                                            <span className="text-muted-foreground text-xs">
                                                (transcribing...)
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Current Agent Response (live) */}
                                {currentAgentResponse && (
                                    <div className="flex gap-3">
                                        <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                                            AI
                                        </div>
                                        <div className="bg-primary/5 flex-1 rounded-lg p-3">
                                            <p>{currentAgentResponse}</p>
                                            {agentState === "speaking" && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="flex gap-1">
                                                        <span className="h-2 w-1 animate-pulse rounded bg-current" />
                                                        <span
                                                            className="h-3 w-1 animate-pulse rounded bg-current"
                                                            style={{ animationDelay: "0.1s" }}
                                                        />
                                                        <span
                                                            className="h-2 w-1 animate-pulse rounded bg-current"
                                                            style={{ animationDelay: "0.2s" }}
                                                        />
                                                        <span
                                                            className="h-4 w-1 animate-pulse rounded bg-current"
                                                            style={{ animationDelay: "0.3s" }}
                                                        />
                                                        <span
                                                            className="h-2 w-1 animate-pulse rounded bg-current"
                                                            style={{ animationDelay: "0.4s" }}
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground text-xs">
                                                        Speaking...
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Agent State Indicator */}
                    {isConnected && (
                        <div className="flex items-center justify-center gap-2">
                            <span
                                className={`h-3 w-3 rounded-full ${
                                    agentState === "listening"
                                        ? "animate-pulse bg-green-500"
                                        : agentState === "thinking"
                                          ? "animate-pulse bg-yellow-500"
                                          : agentState === "speaking"
                                            ? "animate-pulse bg-blue-500"
                                            : "bg-gray-400"
                                }`}
                            />
                            <span className="text-muted-foreground text-sm">
                                {getAgentStateLabel()}
                            </span>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                        {!isConnected ? (
                            <Button
                                size="lg"
                                onClick={startConversation}
                                disabled={isConnecting}
                                className="min-w-[200px]"
                            >
                                {isConnecting ? (
                                    <>
                                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="mr-2 h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                            />
                                        </svg>
                                        Connect
                                    </>
                                )}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    onClick={stopConversation}
                                    className="min-w-[150px]"
                                >
                                    <svg
                                        className="mr-2 h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                                        />
                                    </svg>
                                    Disconnect
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={clearMessages}
                                    disabled={messages.length === 0}
                                >
                                    Clear History
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                        <h4 className="mb-2 font-medium">How it works</h4>
                        <ul className="text-muted-foreground space-y-1">
                            <li>
                                • <strong>Real-time streaming</strong>: Audio is sent/received
                                continuously via WebSocket
                            </li>
                            <li>
                                • <strong>Barge-in</strong>: Interrupt the agent by speaking - it
                                will stop and listen
                            </li>
                            <li>
                                • <strong>Low latency</strong>: Direct connection to ElevenLabs
                                Agents Platform
                            </li>
                            <li>
                                • <strong>Natural turn-taking</strong>: Voice activity detection
                                handles when to listen vs respond
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

// ============================================================================
// Main Component
// ============================================================================

type DiagnosticStatus = "pending" | "success" | "error" | "warning";

interface DiagnosticItem {
    label: string;
    status: DiagnosticStatus;
    message: string;
}

export default function VoiceDemoPage() {
    // TTS State
    const [ttsText, setTtsText] = useState("Hello! I'm a voice assistant powered by Mastra.");
    const [ttsProvider, setTtsProvider] = useState("openai");
    const [ttsSpeaker, setTtsSpeaker] = useState("alloy");
    const [ttsLoading, setTtsLoading] = useState(false);
    const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
    const [ttsError, setTtsError] = useState<string | null>(null);

    // STT State
    const [sttLoading, setSttLoading] = useState(false);
    const [sttTranscript, setSttTranscript] = useState<string | null>(null);
    const [sttError, setSttError] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Voice Chat State
    const [chatProvider, setChatProvider] = useState("openai");
    const [chatSpeaker, setChatSpeaker] = useState("alloy");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [chatResult, setChatResult] = useState<{
        userTranscript: string;
        agentResponse: string;
        audioBase64: string;
    } | null>(null);
    const [isChatRecording, setIsChatRecording] = useState(false);
    const chatMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chatAudioChunksRef = useRef<Blob[]>([]);

    // Mic Test State
    const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
    const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
    const [isTestRecording, setIsTestRecording] = useState(false);
    const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
    const [testAudioBlob, setTestAudioBlob] = useState<Blob | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>("");
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [chunksCollected, setChunksCollected] = useState(0);
    const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
    const [audioLoaded, setAudioLoaded] = useState(false);
    const testMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const testAudioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const testAudioRef = useRef<HTMLAudioElement | null>(null);

    // API Test State
    const [apiTestLoading, setApiTestLoading] = useState<string | null>(null);
    const [apiTestResults, setApiTestResults] = useState<{
        tts?: { success: boolean; message: string; details?: string };
        stt?: { success: boolean; message: string; details?: string };
        voiceAgent?: { success: boolean; message: string; details?: string };
    }>({});

    // Live Voice State
    const [liveProvider, setLiveProvider] = useState("hybrid");
    const [liveStatus, setLiveStatus] = useState<string>("");
    const [liveTranscript, setLiveTranscript] = useState<string>("");
    const [liveResponse, setLiveResponse] = useState<string>("");
    const [liveError, setLiveError] = useState<string | null>(null);
    const [isLiveRecording, setIsLiveRecording] = useState(false);
    const [isLiveProcessing, setIsLiveProcessing] = useState(false);
    const [isLivePlaying, setIsLivePlaying] = useState(false);
    const liveMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const liveAudioChunksRef = useRef<Blob[]>([]);
    const liveAudioContextRef = useRef<AudioContext | null>(null);
    const liveIsPlayingRef = useRef(false);
    const liveSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    // TTS Handler
    const handleTTS = async () => {
        setTtsLoading(true);
        setTtsAudioUrl(null);
        setTtsError(null);
        try {
            const res = await fetch("/api/demos/voice/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: ttsText,
                    provider: ttsProvider,
                    speaker: ttsSpeaker
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "TTS failed");
            }

            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            setTtsAudioUrl(audioUrl);
        } catch (error) {
            console.error("TTS error:", error);
            setTtsError(error instanceof Error ? error.message : "TTS failed");
        }
        setTtsLoading(false);
    };

    // STT Recording
    const startRecording = async () => {
        setSttError(null);

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setSttError(
                "Your browser doesn't support microphone access. Please use Chrome, Firefox, or Safari."
            );
            return;
        }

        try {
            // This should trigger the browser permission prompt
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Microphone error:", error);
            if (error instanceof Error) {
                if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                    setSttError(
                        "Microphone permission denied. Click the camera icon in your browser's address bar to allow access."
                    );
                } else if (
                    error.name === "NotFoundError" ||
                    error.name === "DevicesNotFoundError"
                ) {
                    setSttError("No microphone found. Please connect a microphone and try again.");
                } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
                    setSttError(
                        "Microphone is in use by another application. Please close other apps using the microphone."
                    );
                } else if (error.name === "OverconstrainedError") {
                    setSttError("Microphone constraints could not be satisfied.");
                } else if (error.name === "TypeError") {
                    setSttError(
                        "Microphone access requires HTTPS. Please use https://catalyst.localhost with Caddy."
                    );
                } else {
                    setSttError(`Microphone error: ${error.message}`);
                }
            } else {
                setSttError("Could not access microphone. Please check permissions.");
            }
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        setSttLoading(true);
        setSttError(null);
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const res = await fetch("/api/demos/voice/stt", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSttTranscript(data.transcript);
        } catch (error) {
            console.error("STT error:", error);
            setSttError(error instanceof Error ? error.message : "Transcription failed");
        }
        setSttLoading(false);
    };

    // File Upload Handler
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = [
            "audio/mp3",
            "audio/mpeg",
            "audio/wav",
            "audio/wave",
            "audio/webm",
            "audio/m4a",
            "audio/x-m4a",
            "audio/ogg",
            "audio/flac"
        ];
        const allowedExtensions = ["mp3", "wav", "webm", "m4a", "ogg", "flac"];
        const extension = file.name.split(".").pop()?.toLowerCase() || "";

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
            setSttError(`Invalid file type. Supported formats: ${allowedExtensions.join(", ")}`);
            return;
        }

        // Validate file size (max 25MB - OpenAI Whisper limit)
        if (file.size > 25 * 1024 * 1024) {
            setSttError(
                "File too large. Maximum size is 25MB (OpenAI Whisper limit). Try compressing to MP3."
            );
            return;
        }

        setUploadedFile(file);
        setSttError(null);
    };

    const transcribeUploadedFile = async () => {
        if (!uploadedFile) return;

        setSttLoading(true);
        setSttError(null);
        setSttTranscript(null);

        try {
            const formData = new FormData();
            formData.append("audio", uploadedFile, uploadedFile.name);

            const res = await fetch("/api/demos/voice/stt", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSttTranscript(data.transcript);
        } catch (error) {
            console.error("STT error:", error);
            setSttError(error instanceof Error ? error.message : "Transcription failed");
        }
        setSttLoading(false);
    };

    const clearUploadedFile = () => {
        setUploadedFile(null);
        setSttTranscript(null);
        setSttError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Voice Chat Recording
    const startChatRecording = async () => {
        setChatError(null);

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setChatError(
                "Your browser doesn't support microphone access. Please use Chrome, Firefox, or Safari."
            );
            return;
        }

        try {
            // This should trigger the browser permission prompt
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            chatMediaRecorderRef.current = mediaRecorder;
            chatAudioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                chatAudioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chatAudioChunksRef.current, { type: "audio/webm" });
                await sendVoiceChat(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsChatRecording(true);
        } catch (error) {
            console.error("Microphone error:", error);
            if (error instanceof Error) {
                if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                    setChatError(
                        "Microphone permission denied. Click the camera icon in your browser's address bar to allow access."
                    );
                } else if (
                    error.name === "NotFoundError" ||
                    error.name === "DevicesNotFoundError"
                ) {
                    setChatError("No microphone found. Please connect a microphone and try again.");
                } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
                    setChatError(
                        "Microphone is in use by another application. Please close other apps using the microphone."
                    );
                } else if (error.name === "OverconstrainedError") {
                    setChatError("Microphone constraints could not be satisfied.");
                } else if (error.name === "TypeError") {
                    setChatError(
                        "Microphone access requires HTTPS. Please use https://catalyst.localhost with Caddy."
                    );
                } else {
                    setChatError(`Microphone error: ${error.message}`);
                }
            } else {
                setChatError("Could not access microphone. Please check permissions.");
            }
        }
    };

    const stopChatRecording = () => {
        chatMediaRecorderRef.current?.stop();
        setIsChatRecording(false);
    };

    const sendVoiceChat = async (audioBlob: Blob) => {
        setChatLoading(true);
        setChatError(null);
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            formData.append("provider", chatProvider);
            formData.append("speaker", chatSpeaker);

            const res = await fetch("/api/demos/voice/chat", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setChatResult(data);

            // Auto-play response if audio is available
            if (data.audioBase64) {
                const audioData = `data:audio/mp3;base64,${data.audioBase64}`;
                const audio = new Audio(audioData);
                audio.play().catch((e) => console.warn("Auto-play blocked:", e));
            }
        } catch (error) {
            console.error("Voice chat error:", error);
            setChatError(error instanceof Error ? error.message : "Voice chat failed");
        }
        setChatLoading(false);
    };

    const runDiagnostics = useCallback(async () => {
        setIsDiagnosticsLoading(true);
        setDiagnostics([]); // Clear previous results

        // Helper to add a diagnostic result progressively
        const addResult = (item: DiagnosticItem) => {
            setDiagnostics((prev) => [...prev, item]);
        };

        // Check HTTPS
        const isSecure =
            window.location.protocol === "https:" || window.location.hostname === "localhost";
        addResult({
            label: "Secure Context (HTTPS)",
            status: isSecure ? "success" : "error",
            message: isSecure
                ? `Protocol: ${window.location.protocol}`
                : "Microphone requires HTTPS. Use https://catalyst.localhost"
        });

        // Check navigator.mediaDevices
        const hasMediaDevices = !!navigator.mediaDevices;
        addResult({
            label: "MediaDevices API",
            status: hasMediaDevices ? "success" : "error",
            message: hasMediaDevices
                ? "navigator.mediaDevices is available"
                : "navigator.mediaDevices is not available in this browser"
        });

        // Check getUserMedia
        const hasGetUserMedia = hasMediaDevices && !!navigator.mediaDevices.getUserMedia;
        addResult({
            label: "getUserMedia API",
            status: hasGetUserMedia ? "success" : "error",
            message: hasGetUserMedia
                ? "getUserMedia is supported"
                : "getUserMedia is not supported in this browser"
        });

        // Check MediaRecorder
        const hasMediaRecorder = typeof MediaRecorder !== "undefined";
        addResult({
            label: "MediaRecorder API",
            status: hasMediaRecorder ? "success" : "error",
            message: hasMediaRecorder
                ? "MediaRecorder is supported"
                : "MediaRecorder is not supported in this browser"
        });

        // Check AudioContext
        const hasAudioContext =
            typeof AudioContext !== "undefined" ||
            typeof (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext !== "undefined";
        addResult({
            label: "AudioContext API",
            status: hasAudioContext ? "success" : "error",
            message: hasAudioContext
                ? "AudioContext is supported"
                : "AudioContext is not supported in this browser"
        });

        // Check permission status if available (async - may take time)
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({
                    name: "microphone" as PermissionName
                });
                const statusMap: Record<string, DiagnosticStatus> = {
                    granted: "success",
                    denied: "error",
                    prompt: "warning"
                };
                addResult({
                    label: "Microphone Permission",
                    status: statusMap[permissionStatus.state] || "warning",
                    message: `Permission state: ${permissionStatus.state}`
                });
            } catch {
                addResult({
                    label: "Microphone Permission",
                    status: "warning",
                    message: "Cannot query permission status (will prompt on use)"
                });
            }
        }

        // Enumerate devices (async - may take time)
        if (hasMediaDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter((d) => d.kind === "audioinput");
                setAvailableDevices(audioInputs);

                addResult({
                    label: "Audio Input Devices",
                    status: audioInputs.length > 0 ? "success" : "error",
                    message:
                        audioInputs.length > 0
                            ? `Found ${audioInputs.length} microphone(s): ${audioInputs.map((d) => d.label || "Unnamed").join(", ")}`
                            : "No microphones found"
                });

                if (audioInputs.length > 0 && !selectedDevice) {
                    setSelectedDevice(audioInputs[0].deviceId);
                }
            } catch (err) {
                addResult({
                    label: "Audio Input Devices",
                    status: "error",
                    message: `Failed to enumerate devices: ${err instanceof Error ? err.message : "Unknown error"}`
                });
            }
        }

        // Check audio playback (async - may take time, use timeout)
        try {
            const audioContext = new (
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext
            )();

            // Use timeout to prevent hanging
            const resumeWithTimeout = Promise.race([
                audioContext.resume(),
                new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 3000)
                )
            ]);

            try {
                await resumeWithTimeout;
                addResult({
                    label: "Audio Playback",
                    status: audioContext.state === "running" ? "success" : "warning",
                    message: `AudioContext state: ${audioContext.state}`
                });
            } catch {
                addResult({
                    label: "Audio Playback",
                    status: "warning",
                    message: `AudioContext state: ${audioContext.state} (resume timed out - may need user interaction)`
                });
            }

            audioContext.close();
        } catch (err) {
            addResult({
                label: "Audio Playback",
                status: "error",
                message: `Failed to create AudioContext: ${err instanceof Error ? err.message : "Unknown error"}`
            });
        }

        setIsDiagnosticsLoading(false);
    }, [selectedDevice]);

    // Run diagnostics on mount
    useEffect(() => {
        runDiagnostics();
        return () => {
            // Cleanup
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, [runDiagnostics]);

    const startTestRecording = async () => {
        setTestError(null);
        setTestAudioUrl(null);
        setAudioLevel(0);
        setAudioLoadError(null);
        setAudioLoaded(false);

        try {
            const constraints: MediaStreamConstraints = {
                audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
            };

            console.log("Requesting microphone with constraints:", constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            console.log(
                "Got stream:",
                stream
                    .getTracks()
                    .map((t) => ({ kind: t.kind, label: t.label, enabled: t.enabled }))
            );

            // Set up audio level monitoring
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const updateLevel = () => {
                if (!analyserRef.current) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(average);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            // Set up MediaRecorder with explicit mimeType
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                  ? "audio/webm"
                  : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "";

            console.log("Using mimeType:", mimeType || "default");
            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            testMediaRecorderRef.current = mediaRecorder;
            testAudioChunksRef.current = [];
            setChunksCollected(0);
            setRecordingDuration(0);

            // Start recording timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);

            mediaRecorder.ondataavailable = (event) => {
                console.log("Data available:", event.data.size, "bytes, type:", event.data.type);
                if (event.data.size > 0) {
                    testAudioChunksRef.current.push(event.data);
                    setChunksCollected(testAudioChunksRef.current.length);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log("MediaRecorder stopped, chunks:", testAudioChunksRef.current.length);

                // Clear recording timer
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }

                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                setAudioLevel(0);

                const totalSize = testAudioChunksRef.current.reduce(
                    (acc, chunk) => acc + chunk.size,
                    0
                );
                console.log(
                    "Total chunks:",
                    testAudioChunksRef.current.length,
                    "Total size:",
                    totalSize,
                    "bytes"
                );

                if (testAudioChunksRef.current.length === 0 || totalSize === 0) {
                    setTestError(
                        `No audio data captured (${testAudioChunksRef.current.length} chunks, ${totalSize} bytes). Try speaking louder or check microphone.`
                    );
                    stream.getTracks().forEach((track) => track.stop());
                    if (audioContextRef.current) {
                        audioContextRef.current.close();
                        audioContextRef.current = null;
                    }
                    return;
                }

                const recordedMimeType = mediaRecorder.mimeType || "audio/webm";
                const audioBlob = new Blob(testAudioChunksRef.current, {
                    type: recordedMimeType
                });
                console.log("Created blob:", audioBlob.size, "bytes, type:", audioBlob.type);

                // Validate the audio can be decoded using Web Audio API
                try {
                    const AudioContextClass =
                        window.AudioContext ||
                        (window as unknown as { webkitAudioContext: typeof AudioContext })
                            .webkitAudioContext;
                    const validationCtx = new AudioContextClass();
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await validationCtx.decodeAudioData(arrayBuffer);
                    console.log(
                        "Audio validation successful, duration:",
                        audioBuffer.duration,
                        "seconds"
                    );
                    validationCtx.close();

                    // If validation passes, create URL for playback
                    const url = URL.createObjectURL(audioBlob);
                    setTestAudioUrl(url);
                    setTestAudioBlob(audioBlob);
                } catch (decodeError) {
                    console.error("Audio decode validation failed:", decodeError);
                    // Still set the blob for API testing, but warn about playback
                    const url = URL.createObjectURL(audioBlob);
                    setTestAudioUrl(url);
                    setTestAudioBlob(audioBlob);
                    setAudioLoadError(
                        `Recording saved (${recordedMimeType}) but browser may not support playback. Try the fallback button or test with STT API.`
                    );
                }

                stream.getTracks().forEach((track) => track.stop());
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                setTestError(
                    `MediaRecorder error: ${(event as ErrorEvent).message || "Unknown error"}`
                );
            };

            // Start with timeslice to collect data every 100ms during recording
            mediaRecorder.start(100);
            console.log(
                "MediaRecorder started, state:",
                mediaRecorder.state,
                "mimeType:",
                mediaRecorder.mimeType
            );
            setIsTestRecording(true);

            // Re-run diagnostics to update permission status
            runDiagnostics();
        } catch (error) {
            console.error("Test recording error:", error);
            if (error instanceof Error) {
                setTestError(`${error.name}: ${error.message}`);

                // Add detailed error info
                const errorDetails: Record<string, string> = {
                    NotAllowedError:
                        "Permission denied. Click the lock/camera icon in your address bar to grant access.",
                    NotFoundError: "No microphone found. Please connect a microphone.",
                    NotReadableError: "Microphone is busy or blocked by another application.",
                    OverconstrainedError:
                        "Selected microphone not available. Try a different device.",
                    TypeError: "Invalid constraints or HTTPS required.",
                    AbortError: "Recording was aborted.",
                    SecurityError: "Security error - microphone access blocked by browser policy."
                };
                if (errorDetails[error.name]) {
                    setTestError(`${error.name}: ${errorDetails[error.name]}`);
                }
            } else {
                setTestError("Unknown error accessing microphone");
            }
        }
    };

    const stopTestRecording = () => {
        console.log("Stopping test recording, chunks so far:", testAudioChunksRef.current.length);

        // Clear recording timer
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        if (testMediaRecorderRef.current && testMediaRecorderRef.current.state !== "inactive") {
            console.log("MediaRecorder state before stop:", testMediaRecorderRef.current.state);
            testMediaRecorderRef.current.stop();
        } else {
            console.log("MediaRecorder already inactive or null");
        }
        setIsTestRecording(false);
    };

    const playTestTone = () => {
        try {
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            const ctx = new AudioContextClass();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = 440; // A4 note
            oscillator.type = "sine";
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                ctx.close();
            }, 500);
        } catch (err) {
            setTestError(
                `Audio playback error: ${err instanceof Error ? err.message : "Unknown error"}`
            );
        }
    };

    // Fallback playback using Web Audio API for browsers that don't support the recording format
    const playWithWebAudio = async () => {
        if (!testAudioBlob) {
            setTestError("No audio recorded");
            return;
        }

        try {
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            const ctx = new AudioContextClass();

            const arrayBuffer = await testAudioBlob.arrayBuffer();
            console.log("Decoding audio buffer, size:", arrayBuffer.byteLength);

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            console.log("Audio decoded successfully, duration:", audioBuffer.duration, "seconds");

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();

            source.onended = () => {
                ctx.close();
            };
        } catch (err) {
            console.error("Web Audio playback error:", err);
            setTestError(
                `Web Audio playback failed: ${err instanceof Error ? err.message : "Unknown error"}. The recording may be in an unsupported format.`
            );
        }
    };

    // API Test Functions
    const testTtsApi = async () => {
        setApiTestLoading("tts");
        try {
            const res = await fetch("/api/demos/voice/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: "Hello, this is a test.",
                    provider: "openai",
                    speaker: "alloy"
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                setApiTestResults((prev) => ({
                    ...prev,
                    tts: {
                        success: false,
                        message: `API returned ${res.status}`,
                        details: JSON.stringify(errorData, null, 2)
                    }
                }));
                return;
            }

            const blob = await res.blob();
            setApiTestResults((prev) => ({
                ...prev,
                tts: {
                    success: true,
                    message: `TTS API works! Received ${blob.size} bytes of audio (${blob.type})`,
                    details: `Content-Type: ${res.headers.get("content-type")}`
                }
            }));

            // Play the audio to confirm
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.play().catch((e) => console.warn("Auto-play blocked:", e));
        } catch (err) {
            setApiTestResults((prev) => ({
                ...prev,
                tts: {
                    success: false,
                    message: "Network error",
                    details: err instanceof Error ? err.message : String(err)
                }
            }));
        }
        setApiTestLoading(null);
    };

    const testSttApi = async () => {
        if (!testAudioBlob) {
            setApiTestResults((prev) => ({
                ...prev,
                stt: {
                    success: false,
                    message: "No audio recorded",
                    details: "Record some audio first using the microphone test above"
                }
            }));
            return;
        }

        setApiTestLoading("stt");
        try {
            const formData = new FormData();
            formData.append("audio", testAudioBlob, "recording.webm");

            console.log("Sending STT request:", {
                blobSize: testAudioBlob.size,
                blobType: testAudioBlob.type
            });

            const res = await fetch("/api/demos/voice/stt", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            console.log("STT response:", data);

            if (!res.ok || data.error) {
                setApiTestResults((prev) => ({
                    ...prev,
                    stt: {
                        success: false,
                        message: `API returned ${res.status}`,
                        details: JSON.stringify(data, null, 2)
                    }
                }));
                return;
            }

            setApiTestResults((prev) => ({
                ...prev,
                stt: {
                    success: true,
                    message: `Transcript: "${data.transcript || "(empty)"}"`,
                    details: `Language: ${data.language || "unknown"}`
                }
            }));
        } catch (err) {
            console.error("STT test error:", err);
            setApiTestResults((prev) => ({
                ...prev,
                stt: {
                    success: false,
                    message: "Network error",
                    details: err instanceof Error ? `${err.name}: ${err.message}` : String(err)
                }
            }));
        }
        setApiTestLoading(null);
    };

    const testVoiceAgentApi = async () => {
        if (!testAudioBlob) {
            setApiTestResults((prev) => ({
                ...prev,
                voiceAgent: {
                    success: false,
                    message: "No audio recorded",
                    details: "Record some audio first using the microphone test above"
                }
            }));
            return;
        }

        setApiTestLoading("voiceAgent");
        try {
            const formData = new FormData();
            formData.append("audio", testAudioBlob, "recording.webm");
            formData.append("provider", "openai");
            formData.append("speaker", "alloy");

            console.log("Sending Voice Chat request:", {
                blobSize: testAudioBlob.size,
                blobType: testAudioBlob.type
            });

            const res = await fetch("/api/demos/voice/chat", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            console.log("Voice Chat response:", data);

            if (!res.ok || data.error) {
                setApiTestResults((prev) => ({
                    ...prev,
                    voiceAgent: {
                        success: false,
                        message: `API returned ${res.status}`,
                        details: JSON.stringify(data, null, 2)
                    }
                }));
                return;
            }

            setApiTestResults((prev) => ({
                ...prev,
                voiceAgent: {
                    success: true,
                    message: `You said: "${data.userTranscript}" → Agent: "${data.agentResponse}"`,
                    details: data.audioBase64
                        ? `Audio response: ${Math.round((data.audioBase64.length * 0.75) / 1024)} KB`
                        : "No audio response generated"
                }
            }));

            // Play response audio
            if (data.audioBase64) {
                const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
                audio.play().catch((e) => console.warn("Auto-play blocked:", e));
            }
        } catch (err) {
            console.error("Voice Agent test error:", err);
            setApiTestResults((prev) => ({
                ...prev,
                voiceAgent: {
                    success: false,
                    message: "Network error",
                    details: err instanceof Error ? `${err.name}: ${err.message}` : String(err)
                }
            }));
        }
        setApiTestLoading(null);
    };

    const getStatusBadge = (status: DiagnosticStatus) => {
        const variants: Record<
            DiagnosticStatus,
            "default" | "secondary" | "destructive" | "outline"
        > = {
            success: "default",
            error: "destructive",
            warning: "secondary",
            pending: "outline"
        };
        const labels: Record<DiagnosticStatus, string> = {
            success: "OK",
            error: "FAIL",
            warning: "WARN",
            pending: "..."
        };
        return <Badge variant={variants[status]}>{labels[status]}</Badge>;
    };

    // Live Voice - Initialize Audio Context for streaming playback
    const initLiveAudioContext = useCallback(() => {
        if (!liveAudioContextRef.current) {
            const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            liveAudioContextRef.current = new AudioContextClass();
        }
        return liveAudioContextRef.current;
    }, []);

    // Live Voice - Play audio chunks using Web Audio API
    const playAudioChunks = useCallback(
        async (base64Chunks: string[]) => {
            if (base64Chunks.length === 0) return;

            setIsLivePlaying(true);
            liveIsPlayingRef.current = true;

            try {
                const ctx = initLiveAudioContext();
                await ctx.resume();

                // Combine all chunks into one buffer
                const allChunks = base64Chunks.map((b64) => {
                    const binary = atob(b64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    return bytes;
                });

                const totalLength = allChunks.reduce((acc, arr) => acc + arr.length, 0);
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of allChunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                }

                // Decode the audio
                const audioBuffer = await ctx.decodeAudioData(combined.buffer);

                // Create and play source node
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);

                source.onended = () => {
                    setIsLivePlaying(false);
                    liveIsPlayingRef.current = false;
                    liveSourceNodeRef.current = null;
                };

                liveSourceNodeRef.current = source;
                source.start();
            } catch (err) {
                console.error("Error playing audio:", err);
                setLiveError(
                    `Audio playback error: ${err instanceof Error ? err.message : "Unknown"}`
                );
                setIsLivePlaying(false);
                liveIsPlayingRef.current = false;
            }
        },
        [initLiveAudioContext]
    );

    // Live Voice - Stop audio playback
    const stopLivePlayback = useCallback(() => {
        if (liveSourceNodeRef.current) {
            try {
                liveSourceNodeRef.current.stop();
            } catch {
                // Already stopped
            }
            liveSourceNodeRef.current = null;
        }
        setIsLivePlaying(false);
        liveIsPlayingRef.current = false;
    }, []);

    // Live Voice - Start recording
    const startLiveRecording = async () => {
        setLiveError(null);
        setLiveTranscript("");
        setLiveResponse("");
        setLiveStatus("");
        stopLivePlayback();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                  ? "audio/webm"
                  : "";

            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            liveMediaRecorderRef.current = mediaRecorder;
            liveAudioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    liveAudioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());

                if (liveAudioChunksRef.current.length === 0) {
                    setLiveError("No audio captured");
                    return;
                }

                const audioBlob = new Blob(liveAudioChunksRef.current, {
                    type: mediaRecorder.mimeType || "audio/webm"
                });

                // Send to streaming endpoint
                await sendLiveVoice(audioBlob);
            };

            mediaRecorder.start(100);
            setIsLiveRecording(true);
        } catch (error) {
            console.error("Microphone error:", error);
            setLiveError(error instanceof Error ? error.message : "Failed to access microphone");
        }
    };

    // Live Voice - Stop recording
    const stopLiveRecording = () => {
        if (liveMediaRecorderRef.current && liveMediaRecorderRef.current.state !== "inactive") {
            liveMediaRecorderRef.current.stop();
        }
        setIsLiveRecording(false);
    };

    // Live Voice - Send audio and handle streaming response
    const sendLiveVoice = async (audioBlob: Blob) => {
        setIsLiveProcessing(true);
        setLiveStatus("Sending audio...");

        const audioChunks: string[] = [];

        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            formData.append("provider", liveProvider);

            const response = await fetch("/api/demos/voice/stream", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response stream");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                let currentEvent = "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7);
                    } else if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        try {
                            const parsed = JSON.parse(data);
                            handleLiveEvent(currentEvent, parsed, audioChunks);
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // Play collected audio
            if (audioChunks.length > 0) {
                setLiveStatus("Playing response...");
                await playAudioChunks(audioChunks);
            }
        } catch (error) {
            console.error("Live voice error:", error);
            setLiveError(error instanceof Error ? error.message : "Voice chat failed");
        } finally {
            setIsLiveProcessing(false);
            setLiveStatus("");
        }
    };

    // Live Voice - Handle SSE events
    const handleLiveEvent = (
        event: string,
        data: Record<string, unknown>,
        audioChunks: string[]
    ) => {
        switch (event) {
            case "status":
                setLiveStatus(data.message as string);
                break;
            case "transcript":
                setLiveTranscript(data.text as string);
                break;
            case "text":
                setLiveResponse(data.full as string);
                break;
            case "audio":
                audioChunks.push(data.chunk as string);
                break;
            case "error":
                setLiveError(data.message as string);
                break;
            case "done":
                setLiveStatus("Complete");
                break;
        }
    };

    // Cleanup live audio context on unmount
    useEffect(() => {
        return () => {
            if (liveAudioContextRef.current) {
                liveAudioContextRef.current.close();
            }
        };
    }, []);

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Voice Demo</h1>
            <p className="text-muted-foreground mb-8">
                Explore voice capabilities: Text-to-Speech, Speech-to-Text, and Voice Chat.
            </p>

            <Tabs defaultValue="live-agent">
                <TabsList className="mb-6">
                    <TabsTrigger value="live-agent">
                        <span className="flex items-center gap-1.5">
                            Live Agent
                            <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
                                New
                            </Badge>
                        </span>
                    </TabsTrigger>
                    <TabsTrigger value="live">Live Voice</TabsTrigger>
                    <TabsTrigger value="mic-test">Mic Test</TabsTrigger>
                    <TabsTrigger value="tts">Text-to-Speech</TabsTrigger>
                    <TabsTrigger value="stt">Speech-to-Text</TabsTrigger>
                    <TabsTrigger value="chat">Voice Chat</TabsTrigger>
                </TabsList>

                {/* Live Agent Tab - Real-time ElevenLabs WebSocket */}
                <LiveAgentTab />

                {/* Live Voice Tab */}
                <TabsContent value="live">
                    <Card>
                        <CardHeader>
                            <CardTitle>Live Voice Conversation</CardTitle>
                            <CardDescription>
                                Have a real-time voice conversation with an AI agent. Speak and hear
                                streaming responses powered by ElevenLabs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Provider Selection */}
                            <div className="max-w-xs">
                                <label className="mb-2 block text-sm font-medium">
                                    Voice Provider
                                </label>
                                <Select
                                    value={liveProvider}
                                    onValueChange={(value) => value && setLiveProvider(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hybrid">
                                            Hybrid (Whisper STT + ElevenLabs TTS)
                                        </SelectItem>
                                        <SelectItem value="elevenlabs">ElevenLabs Only</SelectItem>
                                        <SelectItem value="openai">OpenAI Only</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    Hybrid mode uses OpenAI Whisper for transcription and ElevenLabs
                                    for natural voice synthesis.
                                </p>
                            </div>

                            {/* Recording Control */}
                            <div className="flex flex-col items-center gap-4 py-8">
                                <Button
                                    size="lg"
                                    onClick={
                                        isLiveRecording ? stopLiveRecording : startLiveRecording
                                    }
                                    disabled={isLiveProcessing || isLivePlaying}
                                    variant={isLiveRecording ? "destructive" : "default"}
                                    className="h-24 w-24 rounded-full text-lg"
                                >
                                    {isLiveRecording ? (
                                        <span className="flex flex-col items-center">
                                            <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                                            <span className="mt-1 text-xs">Stop</span>
                                        </span>
                                    ) : isLiveProcessing ? (
                                        <span className="text-xs">Processing...</span>
                                    ) : isLivePlaying ? (
                                        <span className="text-xs">Playing...</span>
                                    ) : (
                                        <span className="flex flex-col items-center">
                                            <svg
                                                className="h-8 w-8"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                            </svg>
                                            <span className="mt-1 text-xs">Speak</span>
                                        </span>
                                    )}
                                </Button>

                                {/* Status */}
                                {liveStatus && (
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                                        {liveStatus}
                                    </div>
                                )}

                                {isLiveRecording && (
                                    <p className="text-muted-foreground text-sm">
                                        Speak now, then click Stop when done
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {liveError && (
                                <div className="rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
                                    <p className="font-medium text-red-600 dark:text-red-400">
                                        Error
                                    </p>
                                    <p className="text-red-600 dark:text-red-400">{liveError}</p>
                                </div>
                            )}

                            {/* Conversation Display */}
                            {(liveTranscript || liveResponse) && (
                                <div className="space-y-4 rounded-lg border p-4">
                                    {liveTranscript && (
                                        <div className="flex gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                                You
                                            </div>
                                            <div className="bg-muted flex-1 rounded-lg p-3">
                                                <p>{liveTranscript}</p>
                                            </div>
                                        </div>
                                    )}

                                    {liveResponse && (
                                        <div className="flex gap-3">
                                            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                                                AI
                                            </div>
                                            <div className="bg-primary/5 flex-1 rounded-lg p-3">
                                                <p>{liveResponse}</p>
                                                {isLivePlaying && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="flex gap-1">
                                                            <span className="h-2 w-1 animate-pulse rounded bg-current" />
                                                            <span
                                                                className="h-3 w-1 animate-pulse rounded bg-current"
                                                                style={{ animationDelay: "0.1s" }}
                                                            />
                                                            <span
                                                                className="h-2 w-1 animate-pulse rounded bg-current"
                                                                style={{ animationDelay: "0.2s" }}
                                                            />
                                                            <span
                                                                className="h-4 w-1 animate-pulse rounded bg-current"
                                                                style={{ animationDelay: "0.3s" }}
                                                            />
                                                            <span
                                                                className="h-2 w-1 animate-pulse rounded bg-current"
                                                                style={{ animationDelay: "0.4s" }}
                                                            />
                                                        </div>
                                                        <span className="text-muted-foreground text-xs">
                                                            Speaking...
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={stopLivePlayback}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            Stop
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Instructions */}
                            {!liveTranscript && !liveResponse && !isLiveRecording && (
                                <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                                    <p className="text-lg font-medium">
                                        Click the microphone to start
                                    </p>
                                    <p className="mt-2 text-sm">
                                        Speak your question, then click Stop. The AI will respond
                                        with both text and voice.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Mic Test Tab */}
                <TabsContent value="mic-test">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Diagnostics Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    System Diagnostics
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={runDiagnostics}
                                        disabled={isDiagnosticsLoading}
                                    >
                                        {isDiagnosticsLoading ? "Checking..." : "Refresh"}
                                    </Button>
                                </CardTitle>
                                <CardDescription>
                                    Check browser capabilities for audio recording and playback.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {diagnostics.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start justify-between gap-4 border-b pb-2 last:border-0"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium">{item.label}</p>
                                                <p className="text-muted-foreground truncate text-xs">
                                                    {item.message}
                                                </p>
                                            </div>
                                            {getStatusBadge(item.status)}
                                        </div>
                                    ))}
                                    {isDiagnosticsLoading && (
                                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                                            Running diagnostics...
                                        </div>
                                    )}
                                    {!isDiagnosticsLoading && diagnostics.length === 0 && (
                                        <p className="text-muted-foreground text-sm">
                                            Click Refresh to run diagnostics
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recording Test Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Microphone Test</CardTitle>
                                <CardDescription>
                                    Record audio and play it back to verify mic and speaker.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Device Selection */}
                                {availableDevices.length > 1 && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Select Microphone
                                        </label>
                                        <Select
                                            value={selectedDevice}
                                            onValueChange={(value) =>
                                                value && setSelectedDevice(value)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select microphone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableDevices.map((device) => (
                                                    <SelectItem
                                                        key={device.deviceId}
                                                        value={device.deviceId}
                                                    >
                                                        {device.label ||
                                                            `Microphone ${device.deviceId.slice(0, 8)}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Audio Level Meter */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Audio Level
                                    </label>
                                    <div className="bg-muted h-6 overflow-hidden rounded-full">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                                            style={{
                                                width: `${Math.min(100, (audioLevel / 128) * 100)}%`
                                            }}
                                        />
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {isTestRecording
                                            ? "Speak to see the level meter move"
                                            : "Start recording to test microphone input"}
                                    </p>
                                </div>

                                {/* Recording Controls */}
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={
                                            isTestRecording ? stopTestRecording : startTestRecording
                                        }
                                        variant={isTestRecording ? "destructive" : "default"}
                                    >
                                        {isTestRecording ? "Stop Recording" : "Start Recording"}
                                    </Button>
                                    <Button variant="outline" onClick={playTestTone}>
                                        Play Test Tone
                                    </Button>
                                </div>

                                {isTestRecording && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-red-500">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                            Recording... Speak into your microphone
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            Duration: {recordingDuration}s | Chunks:{" "}
                                            {chunksCollected}
                                        </div>
                                    </div>
                                )}

                                {testError && (
                                    <div className="rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
                                        <p className="font-medium text-red-600 dark:text-red-400">
                                            Error
                                        </p>
                                        <p className="text-red-600 dark:text-red-400">
                                            {testError}
                                        </p>
                                    </div>
                                )}

                                {testAudioUrl && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium">
                                            Playback Recording
                                        </label>
                                        <audio
                                            ref={testAudioRef}
                                            controls
                                            src={testAudioUrl}
                                            className="w-full"
                                            onLoadedMetadata={() => {
                                                setAudioLoaded(true);
                                                setAudioLoadError(null);
                                                console.log(
                                                    "Audio loaded, duration:",
                                                    testAudioRef.current?.duration
                                                );
                                            }}
                                            onError={(e) => {
                                                const audio = e.currentTarget;
                                                const errorCode = audio.error?.code;
                                                const errorMessages: Record<number, string> = {
                                                    1: "MEDIA_ERR_ABORTED: Playback aborted",
                                                    2: "MEDIA_ERR_NETWORK: Network error",
                                                    3: "MEDIA_ERR_DECODE: Audio decoding failed - format may not be supported",
                                                    4: "MEDIA_ERR_SRC_NOT_SUPPORTED: Audio format not supported by this browser"
                                                };
                                                const msg =
                                                    errorMessages[errorCode || 0] ||
                                                    `Unknown error (code: ${errorCode})`;
                                                console.error(
                                                    "Audio load error:",
                                                    msg,
                                                    audio.error
                                                );
                                                setAudioLoadError(msg);
                                                setAudioLoaded(false);
                                            }}
                                            onCanPlayThrough={() => {
                                                console.log("Audio can play through");
                                            }}
                                        />
                                        {audioLoadError && (
                                            <div className="rounded-md bg-yellow-50 p-3 text-sm dark:bg-yellow-900/20">
                                                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                                                    Playback Issue
                                                </p>
                                                <p className="text-yellow-600 dark:text-yellow-400">
                                                    {audioLoadError}
                                                </p>
                                                <div className="mt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={playWithWebAudio}
                                                    >
                                                        Try Fallback Playback
                                                    </Button>
                                                </div>
                                                <p className="text-muted-foreground mt-2 text-xs">
                                                    Try using Chrome for better audio format
                                                    support, or test the STT API below to verify the
                                                    recording was captured correctly.
                                                </p>
                                            </div>
                                        )}
                                        {audioLoaded && (
                                            <p className="text-muted-foreground text-xs">
                                                If you can hear your voice, both microphone and
                                                speakers are working correctly.
                                            </p>
                                        )}
                                        {!audioLoaded && !audioLoadError && (
                                            <p className="text-muted-foreground text-xs">
                                                Loading audio...
                                            </p>
                                        )}
                                        {testAudioBlob && (
                                            <p className="text-muted-foreground text-xs">
                                                Blob: {Math.round(testAudioBlob.size / 1024)} KB,
                                                Type: {testAudioBlob.type}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* API Test Card */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>API Endpoint Tests</CardTitle>
                            <CardDescription>
                                Test the voice API endpoints directly to identify server-side
                                issues. Record audio above first, then test STT and Voice Agent.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    onClick={testTtsApi}
                                    disabled={apiTestLoading !== null}
                                    variant="outline"
                                >
                                    {apiTestLoading === "tts" ? "Testing..." : "Test TTS API"}
                                </Button>
                                <Button
                                    onClick={testSttApi}
                                    disabled={apiTestLoading !== null || !testAudioBlob}
                                    variant="outline"
                                >
                                    {apiTestLoading === "stt" ? "Testing..." : "Test STT API"}
                                </Button>
                                <Button
                                    onClick={testVoiceAgentApi}
                                    disabled={apiTestLoading !== null || !testAudioBlob}
                                    variant="outline"
                                >
                                    {apiTestLoading === "voiceAgent"
                                        ? "Testing..."
                                        : "Test Voice Agent API"}
                                </Button>
                            </div>

                            {testAudioBlob && (
                                <p className="text-muted-foreground text-xs">
                                    Recorded audio: {Math.round(testAudioBlob.size / 1024)} KB (
                                    {testAudioBlob.type})
                                </p>
                            )}

                            {/* API Test Results */}
                            {Object.entries(apiTestResults).map(([key, result]) => (
                                <div
                                    key={key}
                                    className={`rounded-md p-4 ${
                                        result.success
                                            ? "bg-green-50 dark:bg-green-900/20"
                                            : "bg-red-50 dark:bg-red-900/20"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant={result.success ? "default" : "destructive"}>
                                            {key.toUpperCase()}
                                        </Badge>
                                        <span
                                            className={`text-sm font-medium ${
                                                result.success
                                                    ? "text-green-700 dark:text-green-400"
                                                    : "text-red-700 dark:text-red-400"
                                            }`}
                                        >
                                            {result.success ? "Success" : "Failed"}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm">{result.message}</p>
                                    {result.details && (
                                        <pre className="bg-background mt-2 overflow-x-auto rounded p-2 text-xs">
                                            {result.details}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Troubleshooting Tips */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Troubleshooting Tips</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 text-sm md:grid-cols-2">
                                <div>
                                    <h4 className="mb-2 font-medium">Permission Denied</h4>
                                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                                        <li>
                                            Click the lock/camera icon in your browser&apos;s
                                            address bar
                                        </li>
                                        <li>Set microphone permission to &quot;Allow&quot;</li>
                                        <li>Refresh the page after changing permissions</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-medium">No Microphone Found</h4>
                                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                                        <li>Check that your microphone is connected</li>
                                        <li>Try unplugging and reconnecting</li>
                                        <li>Check system audio settings</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-medium">Microphone Busy</h4>
                                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                                        <li>
                                            Close other apps using the microphone (Zoom, Teams,
                                            etc.)
                                        </li>
                                        <li>Check browser tabs that might be using audio</li>
                                        <li>Restart your browser</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="mb-2 font-medium">HTTPS Required</h4>
                                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                                        <li>Access via https://catalyst.localhost</li>
                                        <li>
                                            Run{" "}
                                            <code className="bg-muted rounded px-1">
                                                caddy trust
                                            </code>{" "}
                                            if not done
                                        </li>
                                        <li>Restart browser after trusting certificate</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Text-to-Speech Tab */}
                <TabsContent value="tts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Text-to-Speech</CardTitle>
                            <CardDescription>
                                Convert text to natural-sounding speech using OpenAI or ElevenLabs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">Text</label>
                                <Textarea
                                    value={ttsText}
                                    onChange={(e) => setTtsText(e.target.value)}
                                    placeholder="Enter text to convert to speech..."
                                    rows={4}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Provider
                                    </label>
                                    <Select
                                        value={ttsProvider}
                                        onValueChange={(value) => value && setTtsProvider(value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {ttsProvider === "openai" && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Voice
                                        </label>
                                        <Select
                                            value={ttsSpeaker}
                                            onValueChange={(value) => value && setTtsSpeaker(value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {openaiSpeakers.map((speaker) => (
                                                    <SelectItem key={speaker} value={speaker}>
                                                        {speaker.charAt(0).toUpperCase() +
                                                            speaker.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <Button onClick={handleTTS} disabled={ttsLoading || !ttsText}>
                                {ttsLoading ? "Generating..." : "Generate Speech"}
                            </Button>
                            {ttsError && (
                                <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {ttsError}
                                </div>
                            )}
                            {ttsAudioUrl && (
                                <div className="mt-4">
                                    <audio controls src={ttsAudioUrl} className="w-full" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Speech-to-Text Tab */}
                <TabsContent value="stt">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Microphone Recording Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Record from Microphone</CardTitle>
                                <CardDescription>
                                    Record audio and transcribe using OpenAI Whisper.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        variant={isRecording ? "destructive" : "default"}
                                        disabled={sttLoading}
                                    >
                                        {isRecording
                                            ? "Stop Recording"
                                            : sttLoading
                                              ? "Transcribing..."
                                              : "Start Recording"}
                                    </Button>
                                    {isRecording && (
                                        <span className="flex items-center gap-2 text-sm text-red-500">
                                            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                            Recording...
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* File Upload Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Audio File</CardTitle>
                                <CardDescription>
                                    Upload an audio file to transcribe. Supports MP3, WAV, WebM,
                                    M4A, OGG, FLAC.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".mp3,.wav,.webm,.m4a,.ogg,.flac,audio/*"
                                        onChange={handleFileUpload}
                                        className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
                                    />
                                    {uploadedFile && (
                                        <div className="bg-muted flex items-center justify-between rounded-md p-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {uploadedFile.name}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    {(uploadedFile.size / 1024 / 1024).toFixed(2)}{" "}
                                                    MB
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearUploadedFile}
                                                className="ml-2 shrink-0"
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    )}
                                    <Button
                                        onClick={transcribeUploadedFile}
                                        disabled={!uploadedFile || sttLoading}
                                        className="w-full"
                                    >
                                        {sttLoading ? "Transcribing..." : "Transcribe File"}
                                    </Button>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Maximum file size: 25MB (OpenAI Whisper limit). Compress to MP3
                                    for larger files.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Results Section */}
                    {(sttError || sttTranscript) && (
                        <Card className="mt-6">
                            <CardHeader>
                                <CardTitle>Result</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sttError && (
                                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                        {sttError}
                                    </div>
                                )}
                                {sttTranscript && (
                                    <div className="bg-muted rounded-md p-4">
                                        <label className="mb-2 block text-sm font-medium">
                                            Transcript
                                        </label>
                                        <p className="whitespace-pre-wrap">{sttTranscript}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-3"
                                            onClick={() => {
                                                navigator.clipboard.writeText(sttTranscript);
                                            }}
                                        >
                                            Copy to Clipboard
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Voice Chat Tab */}
                <TabsContent value="chat">
                    <Card>
                        <CardHeader>
                            <CardTitle>Voice Chat</CardTitle>
                            <CardDescription>
                                Have a voice conversation with an AI agent. Speak and hear
                                responses.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Provider
                                    </label>
                                    <Select
                                        value={chatProvider}
                                        onValueChange={(value) => value && setChatProvider(value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                            <SelectItem value="hybrid">
                                                Hybrid (Whisper + ElevenLabs)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {chatProvider === "openai" && (
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Voice
                                        </label>
                                        <Select
                                            value={chatSpeaker}
                                            onValueChange={(value) =>
                                                value && setChatSpeaker(value)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {openaiSpeakers.map((speaker) => (
                                                    <SelectItem key={speaker} value={speaker}>
                                                        {speaker.charAt(0).toUpperCase() +
                                                            speaker.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={
                                        isChatRecording ? stopChatRecording : startChatRecording
                                    }
                                    variant={isChatRecording ? "destructive" : "default"}
                                    disabled={chatLoading}
                                    size="lg"
                                >
                                    {isChatRecording
                                        ? "Stop & Send"
                                        : chatLoading
                                          ? "Processing..."
                                          : "Hold to Speak"}
                                </Button>
                                {isChatRecording && (
                                    <span className="flex items-center gap-2 text-sm text-red-500">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                        Recording...
                                    </span>
                                )}
                            </div>
                            {chatError && (
                                <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {chatError}
                                </div>
                            )}
                            {chatResult && (
                                <div className="space-y-4">
                                    <div className="bg-muted rounded-md p-4">
                                        <label className="mb-1 block text-xs font-medium text-blue-600 dark:text-blue-400">
                                            You said:
                                        </label>
                                        <p>{chatResult.userTranscript}</p>
                                    </div>
                                    <div className="bg-primary/10 rounded-md p-4">
                                        <label className="text-primary mb-1 block text-xs font-medium">
                                            Agent response:
                                        </label>
                                        <p>{chatResult.agentResponse}</p>
                                    </div>
                                    {chatResult.audioBase64 && (
                                        <audio
                                            controls
                                            src={`data:audio/mp3;base64,${chatResult.audioBase64}`}
                                            className="w-full"
                                        />
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
