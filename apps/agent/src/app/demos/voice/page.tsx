"use client";

import { useState, useRef } from "react";
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
    SelectValue
} from "@repo/ui";

const openaiSpeakers = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

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

    return (
        <div>
            <h1 className="mb-2 text-3xl font-bold">Voice Demo</h1>
            <p className="text-muted-foreground mb-8">
                Explore voice capabilities: Text-to-Speech, Speech-to-Text, and Voice Chat.
            </p>

            <Tabs defaultValue="tts">
                <TabsList className="mb-6">
                    <TabsTrigger value="tts">Text-to-Speech</TabsTrigger>
                    <TabsTrigger value="stt">Speech-to-Text</TabsTrigger>
                    <TabsTrigger value="chat">Voice Chat</TabsTrigger>
                </TabsList>

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
                                    <Select value={ttsProvider} onValueChange={setTtsProvider}>
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
                                        <Select value={ttsSpeaker} onValueChange={setTtsSpeaker}>
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Speech-to-Text</CardTitle>
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
                                    <p>{sttTranscript}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
                                    <Select value={chatProvider} onValueChange={setChatProvider}>
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
                                        <Select value={chatSpeaker} onValueChange={setChatSpeaker}>
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
