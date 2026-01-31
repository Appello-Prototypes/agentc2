# Phase 10: Voice Agents Demo

## Objective

Add a voice demo page showcasing Text-to-Speech (TTS), Speech-to-Text (STT), and provider flexibility using OpenAI and ElevenLabs voice capabilities.

## Documentation References

| Feature           | Source      | URL                                               |
| ----------------- | ----------- | ------------------------------------------------- |
| Voice Overview    | Mastra Docs | https://mastra.ai/docs/voice/overview             |
| Adding Voice      | Mastra Docs | https://mastra.ai/docs/agents/adding-voice        |
| Text-to-Speech    | Mastra Docs | https://mastra.ai/docs/voice/text-to-speech       |
| Speech-to-Text    | Mastra Docs | https://mastra.ai/docs/voice/speech-to-text       |
| Speech-to-Speech  | Mastra Docs | https://mastra.ai/docs/voice/speech-to-speech     |
| CompositeVoice    | Mastra Docs | https://mastra.ai/reference/voice/composite-voice |
| OpenAI Voice      | Mastra Docs | https://mastra.ai/reference/voice/openai          |
| ElevenLabs Voice  | Mastra Docs | https://mastra.ai/reference/voice/elevenlabs      |
| ElevenLabs Models | ElevenLabs  | https://elevenlabs.io/docs/overview/models        |

## Implementation Steps

### Step 1: Install Voice Packages

```bash
cd packages/mastra
bun add @mastra/voice-openai @mastra/voice-elevenlabs
```

### Step 2: Create Voice Agent

Create `packages/mastra/src/agents/voice.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

/**
 * Voice configurations for different use cases
 */
export const voiceProviders = {
    openai: () =>
        new OpenAIVoice({
            speechModel: {
                name: "tts-1",
                apiKey: process.env.OPENAI_API_KEY
            },
            listeningModel: {
                name: "whisper-1",
                apiKey: process.env.OPENAI_API_KEY
            },
            speaker: "alloy"
        }),

    elevenlabs: () =>
        new ElevenLabsVoice({
            speechModel: {
                model: "eleven_turbo_v2_5",
                apiKey: process.env.ELEVENLABS_API_KEY
            }
        }),

    // Hybrid: OpenAI for STT, ElevenLabs for premium TTS
    hybrid: () =>
        new CompositeVoice({
            input: new OpenAIVoice({
                listeningModel: {
                    name: "whisper-1",
                    apiKey: process.env.OPENAI_API_KEY
                }
            }),
            output: new ElevenLabsVoice({
                speechModel: {
                    model: "eleven_turbo_v2_5",
                    apiKey: process.env.ELEVENLABS_API_KEY
                }
            })
        })
};

/**
 * OpenAI Voice Agent
 *
 * Uses OpenAI for both TTS and STT.
 * Good balance of quality and cost.
 */
export const openaiVoiceAgent = new Agent({
    id: "openai-voice-agent",
    name: "OpenAI Voice Agent",
    instructions: `You are a helpful voice assistant. Keep responses concise and conversational 
since they will be spoken aloud. Aim for 1-3 sentences unless more detail is requested.`,
    model: "anthropic/claude-sonnet-4-20250514",
    voice: voiceProviders.openai()
});

/**
 * ElevenLabs Voice Agent
 *
 * Uses ElevenLabs for premium TTS quality.
 * Best for production voice experiences.
 */
export const elevenlabsVoiceAgent = new Agent({
    id: "elevenlabs-voice-agent",
    name: "ElevenLabs Voice Agent",
    instructions: `You are a helpful voice assistant with a premium, natural voice. 
Keep responses conversational and engaging. Aim for 1-3 sentences.`,
    model: "anthropic/claude-sonnet-4-20250514",
    voice: voiceProviders.elevenlabs()
});

/**
 * Hybrid Voice Agent
 *
 * Uses OpenAI Whisper for STT (proven accuracy)
 * Uses ElevenLabs for TTS (premium quality)
 */
export const hybridVoiceAgent = new Agent({
    id: "hybrid-voice-agent",
    name: "Hybrid Voice Agent",
    instructions: `You are a helpful voice assistant combining the best of both worlds.
Keep responses natural and conversational.`,
    model: "anthropic/claude-sonnet-4-20250514",
    voice: voiceProviders.hybrid()
});

/**
 * Available OpenAI speakers
 */
export const openaiSpeakers = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type OpenAISpeaker = (typeof openaiSpeakers)[number];
```

### Step 3: Update Agent Exports

Update `packages/mastra/src/agents/index.ts`:

```typescript
export { assistantAgent } from "./assistant";
export { structuredAgent, schemas } from "./structured";
export { visionAgent, visionAnalysisSchema } from "./vision";
export { researchAgent, researchTools } from "./research";
export {
    openaiVoiceAgent,
    elevenlabsVoiceAgent,
    hybridVoiceAgent,
    voiceProviders,
    openaiSpeakers
} from "./voice";
```

### Step 4: Create TTS API Route

Create `apps/agent/src/app/api/demos/voice/tts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

export async function POST(request: NextRequest) {
    try {
        const { text, provider = "openai", speaker = "alloy" } = await request.json();

        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        if (text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
        }

        let voice;
        if (provider === "elevenlabs") {
            voice = new ElevenLabsVoice({
                speechModel: {
                    model: "eleven_turbo_v2_5",
                    apiKey: process.env.ELEVENLABS_API_KEY
                }
            });
        } else {
            voice = new OpenAIVoice({
                speechModel: {
                    name: "tts-1",
                    apiKey: process.env.OPENAI_API_KEY
                },
                speaker
            });
        }

        const audioStream = await voice.speak(text, {
            speaker: provider === "openai" ? speaker : undefined,
            responseFormat: "mp3"
        });

        // Convert stream to buffer for response
        const chunks: Uint8Array[] = [];
        const reader = audioStream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const audioBuffer = Buffer.concat(chunks);

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Length": audioBuffer.length.toString()
            }
        });
    } catch (error) {
        console.error("TTS error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "TTS generation failed" },
            { status: 500 }
        );
    }
}
```

### Step 5: Create STT API Route

Create `apps/agent/src/app/api/demos/voice/stt/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/webm", "audio/m4a"];
        if (!allowedTypes.some((type) => audioFile.type.includes(type.split("/")[1]))) {
            return NextResponse.json(
                { error: "Invalid audio format. Supported: mp3, wav, webm, m4a" },
                { status: 400 }
            );
        }

        // Convert File to stream
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const voice = new OpenAIVoice({
            listeningModel: {
                name: "whisper-1",
                apiKey: process.env.OPENAI_API_KEY
            }
        });

        // Create readable stream from buffer
        const { Readable } = await import("stream");
        const audioStream = Readable.from(audioBuffer);

        const transcript = await voice.listen(audioStream, {
            filetype: audioFile.name.split(".").pop() as "mp3" | "wav" | "webm" | "m4a"
        });

        return NextResponse.json({
            transcript,
            duration: null, // Could calculate from audio metadata
            language: "en" // Whisper auto-detects
        });
    } catch (error) {
        console.error("STT error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Transcription failed" },
            { status: 500 }
        );
    }
}
```

### Step 6: Create Voice Chat API Route

Create `apps/agent/src/app/api/demos/voice/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getMastra } from "@repo/mastra";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;
        const provider = (formData.get("provider") as string) || "openai";
        const speaker = (formData.get("speaker") as string) || "alloy";

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        const mastra = getMastra();
        const agentId =
            provider === "elevenlabs"
                ? "elevenlabs-voice-agent"
                : provider === "hybrid"
                  ? "hybrid-voice-agent"
                  : "openai-voice-agent";

        const agent = mastra.getAgent(agentId);
        if (!agent) {
            return NextResponse.json({ error: "Voice agent not found" }, { status: 404 });
        }

        // Convert audio to text
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const { Readable } = await import("stream");
        const audioStream = Readable.from(audioBuffer);

        const transcript = await agent.voice?.listen(audioStream, {
            filetype: audioFile.name.split(".").pop() as "mp3" | "wav" | "webm" | "m4a"
        });

        if (!transcript) {
            return NextResponse.json({ error: "Could not transcribe audio" }, { status: 400 });
        }

        // Generate response
        const response = await agent.generate(transcript);

        // Convert response to speech
        const responseAudio = await agent.voice?.speak(response.text, {
            speaker: provider === "openai" ? speaker : undefined,
            responseFormat: "mp3"
        });

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        if (responseAudio) {
            const reader = responseAudio.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
        }

        const responseAudioBuffer = Buffer.concat(chunks);
        const audioBase64 = responseAudioBuffer.toString("base64");

        return NextResponse.json({
            userTranscript: transcript,
            agentResponse: response.text,
            audioBase64,
            audioFormat: "mp3"
        });
    } catch (error) {
        console.error("Voice chat error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Voice chat failed" },
            { status: 500 }
        );
    }
}
```

### Step 7: Create Voice Demo Page

Create `apps/agent/src/app/demos/voice/page.tsx`:

```tsx
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

    // STT State
    const [sttLoading, setSttLoading] = useState(false);
    const [sttTranscript, setSttTranscript] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Voice Chat State
    const [chatProvider, setChatProvider] = useState("openai");
    const [chatSpeaker, setChatSpeaker] = useState("alloy");
    const [chatLoading, setChatLoading] = useState(false);
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
            alert(error instanceof Error ? error.message : "TTS failed");
        }
        setTtsLoading(false);
    };

    // STT Recording
    const startRecording = async () => {
        try {
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
            alert("Could not access microphone");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        setSttLoading(true);
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
            alert(error instanceof Error ? error.message : "Transcription failed");
        }
        setSttLoading(false);
    };

    // Voice Chat Recording
    const startChatRecording = async () => {
        try {
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
            alert("Could not access microphone");
        }
    };

    const stopChatRecording = () => {
        chatMediaRecorderRef.current?.stop();
        setIsChatRecording(false);
    };

    const sendVoiceChat = async (audioBlob: Blob) => {
        setChatLoading(true);
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

            // Auto-play response
            const audioData = `data:audio/mp3;base64,${data.audioBase64}`;
            const audio = new Audio(audioData);
            audio.play();
        } catch (error) {
            console.error("Voice chat error:", error);
            alert(error instanceof Error ? error.message : "Voice chat failed");
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
                            {chatResult && (
                                <div className="space-y-4">
                                    <div className="bg-muted rounded-md p-4">
                                        <label className="mb-1 block text-xs font-medium text-blue-600">
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
                                    <audio
                                        controls
                                        src={`data:audio/mp3;base64,${chatResult.audioBase64}`}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
```

### Step 8: Update Demos Landing Page

Update `apps/agent/src/app/demos/page.tsx` to add Voice demo card:

```typescript
// Add to demos array:
{
    title: "Voice",
    description: "Text-to-Speech, Speech-to-Text, and voice conversations",
    href: "/demos/voice",
    features: ["TTS", "STT", "Voice Chat", "Multi-Provider"],
    status: "ready" as const
}
```

### Step 9: Update Demos Layout Navigation

Update `apps/agent/src/app/demos/layout.tsx` to add Voice link:

```tsx
<Link href="/demos/voice" className="hover:text-primary transition-colors">
    Voice
</Link>
```

### Step 10: Update Mastra Instance

Update `packages/mastra/src/mastra.ts` to register voice agents:

```typescript
import { openaiVoiceAgent, elevenlabsVoiceAgent, hybridVoiceAgent } from "./agents";

// In getMastra():
global.mastraInstance = new Mastra({
    agents: {
        // ... existing agents
        "openai-voice-agent": openaiVoiceAgent,
        "elevenlabs-voice-agent": elevenlabsVoiceAgent,
        "hybrid-voice-agent": hybridVoiceAgent
    }
    // ... rest of config
});
```

### Step 11: Update Environment Variables

Update `.env.example`:

```bash
# Voice Providers
OPENAI_API_KEY=your_openai_api_key  # Also used for voice
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Documentation Deviations

| Deviation                           | Status          | Justification                                  |
| ----------------------------------- | --------------- | ---------------------------------------------- |
| No real-time STS in initial version | **Intentional** | WebSocket setup complexity; can add in v2      |
| Browser MediaRecorder for audio     | **Valid**       | Standard browser API, works across devices     |
| Base64 audio in chat response       | **Pragmatic**   | Simplifies frontend; could use streaming later |

## Demo Page Spec

- **Route**: `/demos/voice`
- **Tabs**:
    1. **TTS**: Text input, provider selector, voice selector, audio player
    2. **STT**: Record button, transcript display
    3. **Voice Chat**: Record, transcribe, generate, speak cycle
- **Inputs**:
    - Text for TTS (textarea)
    - Provider selector (OpenAI/ElevenLabs/Hybrid)
    - Voice selector (OpenAI voices)
    - Audio recording (browser MediaRecorder)
- **Outputs**:
    - Audio player for TTS output
    - Transcript text for STT
    - Chat history with both user transcript and agent response
    - Playable agent response audio

### Sample Inputs/Test Data

```typescript
const ttsExamples = [
    "Hello! I'm a voice assistant powered by Mastra.",
    "The weather today is sunny with a high of 75 degrees.",
    "Here's a quick tip: always test your code before deploying to production."
];

const voiceChatPrompts = [
    "What's the weather like today?",
    "Tell me a joke",
    "What can you help me with?"
];
```

### Error State Handling

- Display "Microphone access denied" if permission not granted
- Show "TTS generation failed" with retry button
- Display "Transcription failed" with error details
- Handle rate limits with user-friendly message

### Loading States

- TTS: "Generating..." button text
- STT: "Transcribing..." with pulsing indicator
- Voice Chat: "Processing..." during full cycle

## Dependency Map

- **Requires**:
    - OpenAI API key (existing)
    - ElevenLabs API key (new - already added)
- **Enables**: Voice-enabled agent interactions
- **Standalone**: Yes - can be demoed independently

## Acceptance Criteria

- [ ] TTS generates audio from text using OpenAI
- [ ] TTS generates audio from text using ElevenLabs
- [ ] TTS audio plays in browser audio element
- [ ] STT records audio from browser microphone
- [ ] STT transcribes recorded audio using Whisper
- [ ] Voice Chat completes full speak → transcribe → respond → speak cycle
- [ ] Provider selector switches between OpenAI and ElevenLabs
- [ ] Voice selector changes OpenAI voice (alloy, echo, etc.)
- [ ] Demo page added to navigation and landing page
- [ ] All voice agents registered with Mastra instance

## Test Plan

### Frontend

- [ ] TTS tab renders with all controls
- [ ] STT tab shows recording button and status
- [ ] Voice Chat tab shows provider/voice selectors
- [ ] Recording indicator pulses when recording
- [ ] Audio player appears after TTS generation
- [ ] Transcript displays after STT completion
- [ ] Voice Chat shows both user and agent messages
- [ ] Error messages display appropriately
- [ ] Mobile: touch-friendly recording buttons

### Backend

- [ ] `/api/demos/voice/tts` returns audio/mpeg content type
- [ ] `/api/demos/voice/tts` validates text length (max 5000)
- [ ] `/api/demos/voice/stt` accepts audio file upload
- [ ] `/api/demos/voice/stt` validates audio format
- [ ] `/api/demos/voice/chat` returns transcript + audio
- [ ] Missing API keys return 500 with message
- [ ] Invalid inputs return 400 with details

### Integration

- [ ] End-to-end TTS: type text → click generate → hear audio
- [ ] End-to-end STT: record → stop → see transcript
- [ ] End-to-end Chat: record → process → hear response
- [ ] Provider switch changes audio quality/voice
- [ ] Works in Chrome, Firefox, Safari
- [ ] Works on mobile browsers (iOS Safari, Android Chrome)

## Files Changed

| File                                               | Action |
| -------------------------------------------------- | ------ |
| `packages/mastra/package.json`                     | Update |
| `packages/mastra/src/agents/voice.ts`              | Create |
| `packages/mastra/src/agents/index.ts`              | Update |
| `packages/mastra/src/mastra.ts`                    | Update |
| `apps/agent/src/app/demos/voice/page.tsx`          | Create |
| `apps/agent/src/app/api/demos/voice/tts/route.ts`  | Create |
| `apps/agent/src/app/api/demos/voice/stt/route.ts`  | Create |
| `apps/agent/src/app/api/demos/voice/chat/route.ts` | Create |
| `apps/agent/src/app/demos/page.tsx`                | Update |
| `apps/agent/src/app/demos/layout.tsx`              | Update |
| `.env.example`                                     | Update |

## Future Enhancements (v2)

| Feature                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| Real-time STS            | WebSocket-based speech-to-speech with OpenAI Realtime |
| Voice Cloning            | ElevenLabs voice cloning from audio samples           |
| Streaming TTS            | Progressive audio playback during generation          |
| Multi-language           | Language detection and multi-lingual responses        |
| Voice Activity Detection | Auto-detect when user stops speaking                  |
