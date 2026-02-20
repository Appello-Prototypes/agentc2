import { NextResponse } from "next/server";
import { memory } from "@repo/agentc2/core";
import { getDemoSession } from "@/lib/standalone-auth";

export async function GET() {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resourceId = session.user.id;
        const threadId = `memory-demo-${resourceId}`;

        // Get working memory for the user from the memory demo thread
        const workingMemory = await memory.getWorkingMemory({
            threadId,
            resourceId
        });

        return NextResponse.json({
            workingMemory,
            resourceId
        });
    } catch (error) {
        console.error("Working memory error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get working memory" },
            { status: 500 }
        );
    }
}
