import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@repo/mastra";
import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * POST /api/chat
 * Handles chat messages and streams responses from the AI assistant
 * Requires authentication - uses user ID for memory isolation
 */
export async function POST(req: Request) {
    // Authenticate the request
    const session = await getDemoSession();

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized - please sign in" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { threadId, ...params } = body;

        // Use user ID to isolate conversations per user
        const userId = session.user.id;
        const userThreadId = threadId || `chat-${userId}`;

        const stream = await handleChatStream({
            mastra,
            agentId: "assistant",
            params: {
                ...params,
                memory: {
                    thread: userThreadId,
                    resource: userId
                }
            }
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: "Failed to process chat request" }, { status: 500 });
    }
}

/**
 * GET /api/chat
 * Retrieves message history for the authenticated user's thread
 * Requires authentication
 */
export async function GET(req: Request) {
    // Authenticate the request
    const session = await getDemoSession();

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized - please sign in" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const userId = session.user.id;
        const threadId = searchParams.get("threadId") || `chat-${userId}`;

        const agent = mastra.getAgent("assistant");
        const memory = await agent?.getMemory();

        if (!memory) {
            return NextResponse.json([]);
        }

        // Get messages from the user's thread using recall
        const result = await memory.recall({
            threadId,
            resourceId: userId
        });

        if (!result.messages || result.messages.length === 0) {
            return NextResponse.json([]);
        }

        const uiMessages = toAISdkV5Messages(result.messages);

        return NextResponse.json(uiMessages);
    } catch (error) {
        console.error("Chat history error:", error);
        return NextResponse.json([]);
    }
}
