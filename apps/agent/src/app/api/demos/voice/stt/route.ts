import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
        }

        // Validate file type
        const filename = audioFile.name.toLowerCase();
        const allowedExtensions = ["mp3", "wav", "webm", "m4a", "ogg", "flac"];
        const extension = filename.split(".").pop() || "";

        if (!allowedExtensions.includes(extension)) {
            return NextResponse.json(
                { error: `Invalid audio format. Supported: ${allowedExtensions.join(", ")}` },
                { status: 400 }
            );
        }

        // Convert File to buffer then to stream
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const voice = new OpenAIVoice({
            listeningModel: {
                name: "whisper-1",
                apiKey: process.env.OPENAI_API_KEY
            }
        });

        // Create readable stream from buffer
        const audioStream = Readable.from(audioBuffer);

        const transcript = await voice.listen(audioStream, {
            filetype: extension as "mp3" | "wav" | "webm" | "m4a"
        });

        return NextResponse.json({
            transcript: transcript || "",
            language: "en"
        });
    } catch (error) {
        console.error("STT error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Transcription failed" },
            { status: 500 }
        );
    }
}
