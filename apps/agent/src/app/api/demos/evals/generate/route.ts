import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/agentc2/core";
import { evaluateHelpfulness, evaluateCodeQuality } from "@repo/agentc2";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { input } = await req.json();

        if (!input) {
            return NextResponse.json({ error: "Input is required" }, { status: 400 });
        }

        // Use the assistant agent for generation
        const agent = mastra.getAgent("assistant");
        if (!agent) {
            return NextResponse.json({ error: "Assistant agent not found" }, { status: 500 });
        }

        const response = await agent.generate(input);
        const output = response.text || "";

        // Run heuristic evaluators
        const helpfulness = evaluateHelpfulness(input, output);
        const codeQuality = evaluateCodeQuality(output);

        return NextResponse.json({
            output,
            scores: {
                helpfulness,
                codeQuality
            }
        });
    } catch (error) {
        console.error("Generate and evaluate error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Generation failed" },
            { status: 500 }
        );
    }
}
