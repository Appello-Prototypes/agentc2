import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/agentc2/core";
import { Readable } from "stream";

// Helper to convert Node.js Readable stream to buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;
        const provider = (formData.get("provider") as string) || "openai";
        const speaker = (formData.get("speaker") as string) || "alloy";

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        // Select agent based on provider
        const agentId =
            provider === "elevenlabs"
                ? "elevenlabs-voice-agent"
                : provider === "hybrid"
                  ? "hybrid-voice-agent"
                  : "openai-voice-agent";

        const agent = mastra.getAgent(agentId);
        if (!agent) {
            return NextResponse.json(
                { error: `Voice agent '${agentId}' not found` },
                { status: 404 }
            );
        }

        if (!agent.voice) {
            return NextResponse.json(
                { error: "Agent does not have voice capabilities" },
                { status: 500 }
            );
        }

        // Convert audio file to stream
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioStream = Readable.from(audioBuffer);

        // Get file extension
        const filename = audioFile.name.toLowerCase();
        const extension = filename.split(".").pop() || "webm";

        // Transcribe user audio
        const transcript = await agent.voice.listen(audioStream, {
            filetype: extension as "mp3" | "wav" | "webm" | "m4a"
        });

        if (!transcript || typeof transcript !== "string") {
            return NextResponse.json({ error: "Could not transcribe audio" }, { status: 400 });
        }

        // Generate agent response
        const response = await agent.generate(transcript);

        // Convert response to speech
        const responseAudio = await agent.voice.speak(response.text, {
            speaker: provider === "openai" ? speaker : undefined
        });

        if (!responseAudio) {
            return NextResponse.json({
                userTranscript: transcript,
                agentResponse: response.text,
                audioBase64: null,
                audioFormat: null,
                error: "Could not generate audio response"
            });
        }

        // Handle both Node.js streams and Web ReadableStreams
        let responseAudioBuffer: Buffer;

        if (
            responseAudio instanceof Readable ||
            typeof (responseAudio as NodeJS.ReadableStream).on === "function"
        ) {
            // Node.js stream
            responseAudioBuffer = await streamToBuffer(responseAudio as NodeJS.ReadableStream);
        } else if (typeof (responseAudio as unknown as ReadableStream).getReader === "function") {
            // Web ReadableStream
            const chunks: Uint8Array[] = [];
            const reader = (responseAudio as unknown as ReadableStream).getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) chunks.push(value);
            }
            responseAudioBuffer = Buffer.concat(chunks);
        } else {
            return NextResponse.json({ error: "Unexpected stream type" }, { status: 500 });
        }

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
