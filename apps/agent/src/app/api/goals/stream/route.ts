import { NextRequest } from "next/server";
import { getDemoSession } from "@/lib/standalone-auth";
import { goalStore } from "@repo/agentc2/orchestrator";

/**
 * GET /api/goals/stream
 * Server-Sent Events endpoint for real-time goal updates
 */
export async function GET(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            const sendEvent = (event: string, data: unknown) => {
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                } catch {
                    // Stream closed, ignore
                }
            };

            // Send initial state
            try {
                const goals = await goalStore.getForUser(userId);
                sendEvent("init", { goals });
            } catch (error) {
                console.error("[Goals Stream] Failed to get initial goals:", error);
                sendEvent("error", { message: "Failed to load goals" });
            }

            // Poll for updates every 2 seconds
            const interval = setInterval(async () => {
                try {
                    const goals = await goalStore.getForUser(userId);
                    sendEvent("update", { goals });
                } catch (error) {
                    console.error("[Goals Stream] Failed to poll goals:", error);
                    sendEvent("error", { message: "Failed to fetch updates" });
                }
            }, 2000);

            // Cleanup on close
            request.signal.addEventListener("abort", () => {
                clearInterval(interval);
                try {
                    controller.close();
                } catch {
                    // Already closed
                }
            });
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no" // Disable nginx buffering
        }
    });
}
