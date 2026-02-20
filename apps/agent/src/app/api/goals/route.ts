import { NextRequest, NextResponse } from "next/server";
import { goalStore } from "@repo/agentc2/orchestrator";
import { inngest } from "@/lib/inngest";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * POST /api/goals
 * Create a new goal and trigger background execution via Inngest
 */
export async function POST(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { title, description, priority } = body;

        if (!title || !description) {
            return NextResponse.json(
                { error: "Title and description are required" },
                { status: 400 }
            );
        }

        // Create goal in database
        const goal = await goalStore.create(session.user.id, {
            title,
            description,
            priority: priority || 0
        });

        // Trigger Inngest function for background execution
        await inngest.send({
            name: "goal/submitted",
            data: {
                goalId: goal.id,
                userId: session.user.id
            }
        });

        console.log(`[Goals API] Created goal: ${goal.id}`);

        return NextResponse.json(goal, { status: 201 });
    } catch (error) {
        console.error("[Goals API] Failed to create goal:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create goal" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/goals
 * List all goals for the current user
 */
export async function GET(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const goals = await goalStore.getForUser(session.user.id);
        return NextResponse.json(goals);
    } catch (error) {
        console.error("[Goals API] Failed to list goals:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list goals" },
            { status: 500 }
        );
    }
}
