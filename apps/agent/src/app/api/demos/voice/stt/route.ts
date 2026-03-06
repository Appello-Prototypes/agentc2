import { NextRequest, NextResponse } from "next/server";
import { OpenAIVoice } from "@mastra/voice-openai";
import { Readable } from "stream";
import { getOrgApiKey } from "@repo/agentc2/agents";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        const openaiKey = await getOrgApiKey("openai", authContext.organizationId);
        if (!openaiKey) {
            return NextResponse.json(
                { error: "OpenAI API key not configured. Add it via Settings > Integrations." },
                { status: 500 }
            );
        }

        const filename = audioFile.name.toLowerCase();
        const allowedExtensions = ["mp3", "wav", "webm", "m4a", "ogg", "flac"];
        const extension = filename.split(".").pop() || "";

        if (!allowedExtensions.includes(extension)) {
            return NextResponse.json(
                { error: `Invalid audio format. Supported: ${allowedExtensions.join(", ")}` },
                { status: 400 }
            );
        }

        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const voice = new OpenAIVoice({
            listeningModel: {
                name: "whisper-1",
                apiKey: openaiKey
            }
        });

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
