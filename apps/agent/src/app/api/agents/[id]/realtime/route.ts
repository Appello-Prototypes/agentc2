import { agentResolver } from "@repo/agentc2/agents";
import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAgentAccess } from "@/lib/authz";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert Mastra/Zod tool definitions to OpenAI Realtime function format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toolsToRealtimeFormat(tools: Record<string, any>) {
    return Object.entries(tools)
        .map(([name, tool]) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let parameters: any = { type: "object", properties: {} };
                if (tool.inputSchema) {
                    const converted = zodToJsonSchema(tool.inputSchema, {
                        target: "openAi"
                    });
                    // zodToJsonSchema wraps in { type, properties, ... } — use as-is
                    parameters = converted;
                }
                return {
                    type: "function" as const,
                    name: tool.id || name,
                    description: tool.description || "",
                    parameters
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

/**
 * POST /api/agents/[id]/realtime
 *
 * Initiates an OpenAI Realtime API session via WebRTC.
 * Accepts the browser's SDP offer, resolves the agent's instructions and tools,
 * and returns the SDP answer from OpenAI.
 *
 * Request: raw SDP text (Content-Type: application/sdp or text/plain)
 * Response: raw SDP text
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
        }

        // Read raw SDP offer from request body
        const sdpOffer = await request.text();
        if (!sdpOffer || !sdpOffer.includes("v=0")) {
            return NextResponse.json({ error: "Invalid SDP offer" }, { status: 400 });
        }

        // Resolve agent from database
        const record = await prisma.agent.findFirst({
            where: { OR: [{ id }, { slug: id }] },
            select: { id: true, slug: true, tenantId: true, metadata: true }
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
        const [instructions, tools] = await Promise.all([
            Promise.resolve(agent.getInstructions()),
            Promise.resolve(agent.listTools())
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = (record.metadata as Record<string, unknown>) || {};
        const voice = (metadata.realtimeVoice as string) || "alloy";

        const realtimeTools = toolsToRealtimeFormat(tools || {});

        const sessionConfig = JSON.stringify({
            type: "realtime",
            model: "gpt-4o-realtime-preview",
            instructions: instructions || "",
            audio: { output: { voice } },
            tools: realtimeTools,
            input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: { type: "server_vad" }
        });

        // Exchange SDP with OpenAI Realtime API
        const fd = new FormData();
        fd.set("sdp", sdpOffer);
        fd.set("session", sessionConfig);

        const openaiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: fd
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error(
                "[Realtime] OpenAI SDP exchange failed:",
                openaiResponse.status,
                errorText
            );
            return NextResponse.json(
                { error: `OpenAI Realtime API error: ${openaiResponse.status}` },
                { status: 502 }
            );
        }

        // Return the SDP answer from OpenAI directly to the browser
        const sdpAnswer = await openaiResponse.text();

        return new NextResponse(sdpAnswer, {
            headers: {
                "Content-Type": "application/sdp"
            }
        });
    } catch (error) {
        console.error("[Realtime] Unhandled error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
