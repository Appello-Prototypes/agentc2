import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { Readable } from "stream";
import { getOrgApiKey } from "@repo/agentc2/agents";
import { authenticateRequest } from "@/lib/api-auth";
import { resolveCredentialValue } from "@/lib/channel-credentials";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { text, provider = "openai", speaker = "alloy" } = await request.json();

        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        if (text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
        }

        let voice;
        if (provider === "elevenlabs") {
            const { value: elApiKey } = await resolveCredentialValue(
                "elevenlabs",
                "ELEVENLABS_API_KEY"
            );
            if (!elApiKey) {
                return NextResponse.json(
                    {
                        error: "ElevenLabs API key not configured. Add it via Settings > Integrations."
                    },
                    { status: 500 }
                );
            }
            voice = new ElevenLabsVoice({
                speechModel: {
                    name: "eleven_multilingual_v2",
                    apiKey: elApiKey
                }
            });
        } else {
            const openaiKey = await getOrgApiKey("openai", authContext.organizationId);
            if (!openaiKey) {
                return NextResponse.json(
                    { error: "OpenAI API key not configured. Add it via Settings > Integrations." },
                    { status: 500 }
                );
            }
            voice = new OpenAIVoice({
                speechModel: {
                    name: "tts-1",
                    apiKey: openaiKey
                },
                speaker
            });
        }

        const audioStream = await voice.speak(text, {
            speaker: provider === "openai" ? speaker : undefined
        });

        if (!audioStream) {
            return NextResponse.json({ error: "Failed to generate audio" }, { status: 500 });
        }

        let audioBuffer: Buffer;

        if (
            audioStream instanceof Readable ||
            typeof (audioStream as NodeJS.ReadableStream).on === "function"
        ) {
            audioBuffer = await streamToBuffer(audioStream as NodeJS.ReadableStream);
        } else if (typeof (audioStream as unknown as ReadableStream).getReader === "function") {
            const chunks: Uint8Array[] = [];
            const reader = (audioStream as unknown as ReadableStream).getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) chunks.push(value);
            }
            audioBuffer = Buffer.concat(chunks);
        } else {
            return NextResponse.json({ error: "Unexpected stream type" }, { status: 500 });
        }

        console.log(
            `TTS: Generated audio buffer of ${audioBuffer.length} bytes for text: "${text.substring(0, 50)}..."`
        );

        if (audioBuffer.length === 0) {
            console.error("TTS: Audio buffer is empty!");
            return NextResponse.json({ error: "Generated audio is empty" }, { status: 500 });
        }

        return new NextResponse(new Uint8Array(audioBuffer), {
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
