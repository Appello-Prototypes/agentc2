import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

/**
 * Non-streaming chat endpoint for memory demo
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message required" }, { status: 400 });
        }

        const userId = session.user.id;
        const threadId = `memory-demo-${userId}`;

        const agent = mastra.getAgent("assistant");

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 500 });
        }

        // Use agent.generate for non-streaming response
        // Memory options use thread/resource keys per Mastra docs
        const result = await agent.generate(message, {
            memory: {
                thread: threadId,
                resource: userId
            }
        });

        return NextResponse.json({
            text: result.text,
            threadId
        });
    } catch (error) {
        console.error("Memory demo chat error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Chat failed" },
            { status: 500 }
        );
    }
}
