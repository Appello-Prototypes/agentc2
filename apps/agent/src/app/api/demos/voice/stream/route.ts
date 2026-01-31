import { NextRequest } from "next/server";
import { mastra } from "@repo/mastra";
import { Readable } from "stream";

/**
 * Streaming Voice Chat API
 *
 * This endpoint provides a streaming voice conversation experience:
 * 1. Receives audio input
 * 2. Transcribes it using STT
 * 3. Generates an AI response
 * 4. Streams TTS audio back as chunks
 *
 * Uses Server-Sent Events (SSE) to stream:
 * - transcript: The user's transcribed speech
 * - text: The agent's text response (streamed word by word)
 * - audio: Base64-encoded audio chunks
 * - done: Signals completion
 * - error: Error messages
 */
export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const formData = await request.formData();
                const audioFile = formData.get("audio") as File | null;
                const provider = (formData.get("provider") as string) || "hybrid";

                if (!audioFile) {
                    sendEvent("error", { message: "Audio file is required" });
                    controller.close();
                    return;
                }

                // Select agent based on provider
                const agentId =
                    provider === "elevenlabs"
                        ? "elevenlabs-voice-agent"
                        : provider === "openai"
                          ? "openai-voice-agent"
                          : "hybrid-voice-agent";

                const agent = mastra.getAgent(agentId);
                if (!agent) {
                    sendEvent("error", { message: `Voice agent '${agentId}' not found` });
                    controller.close();
                    return;
                }

                if (!agent.voice) {
                    sendEvent("error", { message: "Agent does not have voice capabilities" });
                    controller.close();
                    return;
                }

                // Send status update
                sendEvent("status", { message: "Processing audio..." });

                // Convert audio file to stream
                const arrayBuffer = await audioFile.arrayBuffer();
                const audioBuffer = Buffer.from(arrayBuffer);
                const audioStream = Readable.from(audioBuffer);

                // Get file extension
                const filename = audioFile.name.toLowerCase();
                const extension = filename.split(".").pop() || "webm";

                // Transcribe user audio
                sendEvent("status", { message: "Transcribing..." });
                const transcript = await agent.voice.listen(audioStream, {
                    filetype: extension as "mp3" | "wav" | "webm" | "m4a"
                });

                if (!transcript || typeof transcript !== "string") {
                    sendEvent("error", { message: "Could not transcribe audio" });
                    controller.close();
                    return;
                }

                // Send transcript
                sendEvent("transcript", { text: transcript });

                // Generate agent response with streaming
                sendEvent("status", { message: "Generating response..." });

                // Use streaming generation
                const responseStream = await agent.stream(transcript);
                let fullResponse = "";

                // Stream the text response
                for await (const chunk of responseStream.textStream) {
                    fullResponse += chunk;
                    sendEvent("text", { chunk, full: fullResponse });
                }

                // Now generate TTS for the full response
                sendEvent("status", { message: "Generating audio..." });

                const responseAudio = await agent.voice.speak(fullResponse);

                if (!responseAudio) {
                    sendEvent("error", { message: "Could not generate audio response" });
                    controller.close();
                    return;
                }

                // Stream audio chunks
                // Handle both Node.js streams and Web ReadableStreams
                if (
                    responseAudio instanceof Readable ||
                    typeof (responseAudio as NodeJS.ReadableStream).on === "function"
                ) {
                    // Node.js stream - read in chunks
                    const nodeStream = responseAudio as NodeJS.ReadableStream;

                    // Collect chunks and send them
                    const chunks: Buffer[] = [];
                    for await (const chunk of nodeStream as AsyncIterable<Buffer>) {
                        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        chunks.push(buffer);

                        // Send audio chunk (base64 encoded)
                        sendEvent("audio", {
                            chunk: buffer.toString("base64"),
                            index: chunks.length - 1
                        });
                    }

                    // Send audio complete event with total info
                    const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
                    sendEvent("audioComplete", {
                        totalChunks: chunks.length,
                        totalSize
                    });
                } else if (
                    typeof (responseAudio as unknown as ReadableStream).getReader === "function"
                ) {
                    // Web ReadableStream
                    const reader = (responseAudio as unknown as ReadableStream).getReader();
                    let chunkIndex = 0;
                    let totalSize = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) {
                            const buffer = Buffer.from(value);
                            totalSize += buffer.length;
                            sendEvent("audio", {
                                chunk: buffer.toString("base64"),
                                index: chunkIndex++
                            });
                        }
                    }

                    sendEvent("audioComplete", {
                        totalChunks: chunkIndex,
                        totalSize
                    });
                }

                // Send completion event
                sendEvent("done", {
                    transcript,
                    response: fullResponse
                });

                controller.close();
            } catch (error) {
                console.error("Streaming voice chat error:", error);
                sendEvent("error", {
                    message: error instanceof Error ? error.message : "Voice chat failed"
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
