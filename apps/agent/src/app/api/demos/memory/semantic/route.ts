import { NextRequest, NextResponse } from "next/server";
import { memory } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, threadId } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const resourceId = session.user.id;
        const thread = threadId || "default";

        const result = await memory.recall({
            threadId: thread,
            vectorSearchString: query,
            resourceId
        });

        return NextResponse.json({
            query,
            threadId: thread,
            messages: result.messages?.map(
                (msg: { role: string; content: unknown; similarity?: number }) => ({
                    role: msg.role,
                    content:
                        typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                    similarity: msg.similarity
                })
            )
        });
    } catch (error) {
        console.error("Semantic recall error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Recall failed" },
            { status: 500 }
        );
    }
}
