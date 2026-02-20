import { NextRequest, NextResponse } from "next/server";
import { goalStore } from "@repo/agentc2/orchestrator";
import { inngest } from "@/lib/inngest";
import { getDemoSession } from "@/lib/standalone-auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/goals/[id]
 * Get a single goal by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const goal = await goalStore.getById(id);

        if (!goal) {
            return NextResponse.json({ error: "Goal not found" }, { status: 404 });
        }

        // Check ownership
        if (goal.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(goal);
    } catch (error) {
        console.error("[Goals API] Failed to get goal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get goal" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/goals/[id]
 * Update a goal (retry, cancel)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { action } = body;

        const goal = await goalStore.getById(id);

        if (!goal) {
            return NextResponse.json({ error: "Goal not found" }, { status: 404 });
        }

        if (goal.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        switch (action) {
            case "retry":
                if (goal.status !== "failed") {
                    return NextResponse.json(
                        { error: "Can only retry failed goals" },
                        { status: 400 }
                    );
                }

                // Trigger retry via Inngest
                await inngest.send({
                    name: "goal/retry",
                    data: {
                        goalId: goal.id,
                        userId: session.user.id,
                        attempt: 1
                    }
                });

                return NextResponse.json({ message: "Retry triggered" });

            case "cancel":
                if (goal.status === "completed" || goal.status === "failed") {
                    return NextResponse.json(
                        { error: "Cannot cancel finished goals" },
                        { status: 400 }
                    );
                }

                await goalStore.updateStatus(id, "failed", {
                    error: "Cancelled by user"
                });

                return NextResponse.json({ message: "Goal cancelled" });

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error) {
        console.error("[Goals API] Failed to update goal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update goal" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/goals/[id]
 * Delete a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const goal = await goalStore.getById(id);

        if (!goal) {
            return NextResponse.json({ error: "Goal not found" }, { status: 404 });
        }

        if (goal.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await goalStore.delete(id);

        return NextResponse.json({ message: "Goal deleted" });
    } catch (error) {
        console.error("[Goals API] Failed to delete goal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete goal" },
            { status: 500 }
        );
    }
}
