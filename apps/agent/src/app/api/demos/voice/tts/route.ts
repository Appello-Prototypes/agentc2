import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { Readable } from "stream";

// Helper to convert Node.js Readable stream to buffer using async iteration
// This handles already-ended streams (like PassThrough) more reliably than events
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

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
            if (!process.env.ELEVENLABS_API_KEY) {
                return NextResponse.json(
                    { error: "ELEVENLABS_API_KEY not configured" },
                    { status: 500 }
                );
            }
            voice = new ElevenLabsVoice({
                speechModel: {
                    name: "eleven_multilingual_v2",
                    apiKey: process.env.ELEVENLABS_API_KEY
                }
            });
        } else {
            if (!process.env.OPENAI_API_KEY) {
                return NextResponse.json(
                    { error: "OPENAI_API_KEY not configured" },
                    { status: 500 }
                );
            }
            voice = new OpenAIVoice({
                speechModel: {
                    name: "tts-1",
                    apiKey: process.env.OPENAI_API_KEY
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

        // Handle both Node.js streams and Web ReadableStreams
        let audioBuffer: Buffer;

        if (
            audioStream instanceof Readable ||
            typeof (audioStream as NodeJS.ReadableStream).on === "function"
        ) {
            // Node.js stream
            audioBuffer = await streamToBuffer(audioStream as NodeJS.ReadableStream);
        } else if (typeof (audioStream as unknown as ReadableStream).getReader === "function") {
            // Web ReadableStream
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
