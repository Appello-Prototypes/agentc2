import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query, maxSteps = 5 } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const agent = mastra.getAgent("research");
        if (!agent) {
            return NextResponse.json({ error: "Research agent not found" }, { status: 500 });
        }

        const steps: Array<{ type: string; content: unknown }> = [];

        const response = await agent.generate(query, {
            maxSteps,
            onStepFinish: (step) => {
                steps.push({
                    type: step.finishReason || "unknown",
                    content: step.text || step.toolCalls
                });
            }
        });

        return NextResponse.json({
            text: response.text,
            steps,
            toolCalls: response.toolCalls
        });
    } catch (error) {
        console.error("Research agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Research failed" },
            { status: 500 }
        );
    }
}
