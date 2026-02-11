import { NextRequest, NextResponse } from "next/server";
import { finalizeConversationRun } from "@/lib/run-recorder";

/**
 * POST /api/agents/[id]/chat/finalize
 *
 * Finalize a conversation run when the user starts a new conversation,
 * closes the tab, or the conversation is otherwise complete.
 *
 * Idempotent: no-op if the run is already COMPLETED/FAILED/CANCELLED.
 *
 * Body: { runId: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Handle both JSON and sendBeacon (which sends as text/plain)
        let runId: string | undefined;

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const body = await request.json();
            runId = body.runId;
        } else {
            // sendBeacon sends as text/plain
            const text = await request.text();
            try {
                const parsed = JSON.parse(text);
                runId = parsed.runId;
            } catch {
                // Could not parse body
            }
        }

        if (!runId) {
            return NextResponse.json({ success: false, error: "Missing runId" }, { status: 400 });
        }

        const finalized = await finalizeConversationRun(runId);

        return NextResponse.json({ success: true, finalized });
    } catch (error) {
        console.error("[Chat Finalize] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to finalize conversation"
            },
            { status: 500 }
        );
    }
}
