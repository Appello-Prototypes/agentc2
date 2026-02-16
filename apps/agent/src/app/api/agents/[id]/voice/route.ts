import { NextRequest } from "next/server";
import { Agent } from "@mastra/core/agent";
import { agentResolver } from "@repo/mastra/agents";
import { storage, memory as sharedMemory } from "@repo/mastra/core";
import { resolveCredentialValue } from "@/lib/channel-credentials";

/**
 * POST /api/agents/[id]/voice
 *
 * Ultra-low-latency voice conversation endpoint.
 *
 * Key optimisations vs. the normal chat route:
 *  1. FAST model override  – gpt-4o-mini for < 500 ms TTFT
 *  2. Voice-optimised system prompt wrapper – keeps responses short & spoken
 *  3. Inline TTS  – first sentence → ElevenLabs TTS fires immediately,
 *     while the LLM continues generating the next sentence
 *  4. Minimal overhead – tools disabled by default, lightweight memory
 *
 * SSE events sent to client:
 *   audio   { chunk: base64, index: number }
 *   done    { response: string }
 *   error   { message: string }
 */

const VOICE_SYSTEM_WRAP = `You are in a real-time VOICE conversation. The user is speaking to you and will hear your response spoken aloud.

CRITICAL RULES FOR VOICE:
- Keep responses SHORT — 1 to 3 sentences max unless asked to elaborate.
- Use natural, conversational language. No bullet points, markdown, or lists.
- Never say "here's a list" or "let me break this down" — just say it naturally.
- No URLs, code blocks, or special formatting — the user cannot see text.
- Respond as if you're talking face-to-face with a friend.
- If you don't know something, say so briefly.
- End your response naturally — don't prompt the user to ask more.

---
`;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const encoder = new TextEncoder();
    const { id } = await params;

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    /* closed */
                }
            };

            try {
                const body = await request.json();
                const { text, threadId, resourceId, voiceId } = body;

                if (!text || typeof text !== "string") {
                    send("error", { message: "Text is required" });
                    controller.close();
                    return;
                }

                // ── Resolve ElevenLabs key ───────────────────────────────────
                const { value: elevenLabsApiKey } = await resolveCredentialValue(
                    "elevenlabs",
                    "ELEVENLABS_API_KEY"
                );
                if (!elevenLabsApiKey) {
                    send("error", { message: "ElevenLabs API key not configured" });
                    controller.close();
                    return;
                }

                const selectedVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
                const userThreadId = threadId || `voice-${id}-${Date.now()}`;
                const userResourceId = resourceId || "voice-user";

                // ── Build a fast voice agent ─────────────────────────────────
                // Fetch the real agent record for its instructions only,
                // then override to gpt-4o-mini + voice prompt for speed.
                let baseInstructions = "You are a helpful assistant.";

                try {
                    const record = await agentResolver.getRecord(id);
                    if (record) {
                        baseInstructions = record.instructions;
                    }
                } catch {
                    // Fall back to default
                }

                const voiceAgent = new Agent({
                    id: `voice-${id}`,
                    name: `Voice (${id})`,
                    instructions: VOICE_SYSTEM_WRAP + baseInstructions,
                    model: "openai/gpt-4o-mini",
                    memory: sharedMemory
                });

                // ── TTS helper ───────────────────────────────────────────────
                async function textToAudio(sentence: string): Promise<string | null> {
                    try {
                        const ttsRes = await fetch(
                            `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "xi-api-key": elevenLabsApiKey!
                                },
                                body: JSON.stringify({
                                    text: sentence,
                                    model_id: "eleven_turbo_v2_5",
                                    voice_settings: {
                                        stability: 0.5,
                                        similarity_boost: 0.75,
                                        style: 0.0,
                                        use_speaker_boost: true
                                    },
                                    output_format: "mp3_22050_32"
                                })
                            }
                        );

                        if (!ttsRes.ok) return null;

                        const reader = ttsRes.body?.getReader();
                        if (!reader) return null;

                        const chunks: Uint8Array[] = [];
                        let totalLen = 0;
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (value) {
                                chunks.push(value);
                                totalLen += value.length;
                            }
                        }

                        const combined = new Uint8Array(totalLen);
                        let offset = 0;
                        for (const c of chunks) {
                            combined.set(c, offset);
                            offset += c.length;
                        }
                        return Buffer.from(combined).toString("base64");
                    } catch {
                        return null;
                    }
                }

                // ── Stream + inline TTS ──────────────────────────────────────
                const responseStream = await voiceAgent.stream(text, {
                    maxSteps: 1,
                    memory: {
                        thread: userThreadId,
                        resource: userResourceId
                    }
                });

                let fullResponse = "";
                let pendingText = "";
                let audioIndex = 0;

                const breakRegex = /[.!?]\s+|\n+/;

                for await (const chunk of responseStream.textStream) {
                    fullResponse += chunk;
                    pendingText += chunk;

                    // Generate TTS inline as sentences arrive
                    while (breakRegex.test(pendingText)) {
                        const match = pendingText.match(breakRegex);
                        if (!match || match.index === undefined) break;

                        const end = match.index + match[0].length;
                        const sentence = pendingText.slice(0, end).trim();
                        pendingText = pendingText.slice(end);

                        if (sentence.length < 2) continue;

                        const audio = await textToAudio(sentence);
                        if (audio) {
                            send("audio", { chunk: audio, index: audioIndex++ });
                        }
                    }
                }

                // Final fragment
                const remaining = pendingText.trim();
                if (remaining.length >= 2) {
                    const audio = await textToAudio(remaining);
                    if (audio) {
                        send("audio", { chunk: audio, index: audioIndex++ });
                    }
                }

                send("done", { response: fullResponse });
                controller.close();
            } catch (error) {
                console.error("[Voice] Error:", error);
                send("error", {
                    message: error instanceof Error ? error.message : "Voice processing failed"
                });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
