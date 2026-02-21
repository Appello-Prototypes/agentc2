import { agentResolver } from "@repo/agentc2/agents";
import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAgentAccess } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { OpenAIVoice } from "@mastra/voice-openai";
import { Readable } from "stream";
import { resolveCredentialValue } from "@/lib/channel-credentials";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * POST /api/agents/[id]/voice
 *
 * Accepts text input, generates an agent response, converts to speech via
 * ElevenLabs (fallback: OpenAI TTS), and streams audio chunks back as SSE.
 *
 * SSE events:
 *   event: text    data: { response: "..." }
 *   event: audio   data: { chunk: "<base64 mp3>" }
 *   event: done    data: { response: "..." }
 *   event: error   data: { message: "..." }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        const rate = await checkRateLimit(
            `voice:${authResult.context.organizationId}:${authResult.context.userId}:${id}`,
            RATE_LIMIT_POLICIES.chat
        );
        if (!rate.allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const body = await request.json();
        const { text, threadId, voiceId, resourceId } = body;

        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        if (text.length > 5000) {
            return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
        }

        const record = await prisma.agent.findFirst({
            where: { OR: [{ id }, { slug: id }] },
            select: { id: true, slug: true, tenantId: true }
        });
        if (!record) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const hydrated = await agentResolver.resolve({
            slug: record.slug,
            requestContext: {
                userId: authResult.context.userId,
                tenantId: record.tenantId || undefined
            }
        });
        if (!hydrated) {
            return NextResponse.json({ error: "Failed to resolve agent" }, { status: 500 });
        }
        const agent = hydrated.agent;

        const memoryOpts = threadId
            ? { thread: threadId, resource: resourceId || "voice-user" }
            : undefined;

        const textEncoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                const send = (event: string, data: unknown) => {
                    controller.enqueue(
                        textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                };

                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const generateOpts: any = { maxSteps: 5 };
                    if (memoryOpts) generateOpts.memory = memoryOpts;

                    const result = await agent.generate(text, generateOpts);

                    const responseText =
                        typeof result === "string"
                            ? result
                            : (result as { text?: string })?.text || String(result);

                    send("text", { response: responseText });

                    // TTS: prefer ElevenLabs, fallback to OpenAI
                    const { value: elApiKey } = await resolveCredentialValue(
                        "elevenlabs",
                        "ELEVENLABS_API_KEY"
                    );
                    let audioBuffer: Buffer | null = null;

                    if (elApiKey) {
                        try {
                            const voice = new ElevenLabsVoice({
                                speechModel: {
                                    name: "eleven_multilingual_v2",
                                    apiKey: elApiKey
                                }
                            });
                            const audioStream = await voice.speak(responseText, {
                                speaker: voiceId || undefined
                            });
                            if (audioStream) {
                                audioBuffer = await streamToBuffer(
                                    audioStream as NodeJS.ReadableStream
                                );
                            }
                        } catch (e) {
                            console.warn("[Voice API] ElevenLabs TTS failed, trying OpenAI:", e);
                        }
                    }

                    if (!audioBuffer && process.env.OPENAI_API_KEY) {
                        const voice = new OpenAIVoice({
                            speechModel: {
                                name: "tts-1",
                                apiKey: process.env.OPENAI_API_KEY
                            },
                            speaker: "alloy"
                        });
                        const audioStream = await voice.speak(responseText);
                        if (audioStream) {
                            audioBuffer = await streamToBuffer(
                                audioStream as NodeJS.ReadableStream
                            );
                        }
                    }

                    if (audioBuffer && audioBuffer.length > 0) {
                        const CHUNK_SIZE = 24_000;
                        for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
                            const slice = audioBuffer.subarray(i, i + CHUNK_SIZE);
                            send("audio", { chunk: slice.toString("base64") });
                        }
                    }

                    send("done", { response: responseText });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : "Voice generation failed";
                    console.error("[Voice API] Error:", err);
                    send("error", { message: msg });
                } finally {
                    controller.close();
                }
            }
        });

        return new NextResponse(readable, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive"
            }
        });
    } catch (error) {
        console.error("[Voice API] Unhandled error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
