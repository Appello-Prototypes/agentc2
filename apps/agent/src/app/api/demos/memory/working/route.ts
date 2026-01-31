import { NextResponse } from "next/server";
import { memory } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
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
