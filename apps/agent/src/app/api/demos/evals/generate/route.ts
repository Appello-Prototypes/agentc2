import { NextRequest, NextResponse } from "next/server";
import { mastra, evaluateHelpfulness, evaluateCodeQuality } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { input } = await req.json();

        if (!input) {
            return NextResponse.json({ error: "Input is required" }, { status: 400 });
        }

        // Use the evaluated agent for generation
        const agent = mastra.getAgent("evaluated");
        if (!agent) {
            return NextResponse.json({ error: "Evaluated agent not found" }, { status: 500 });
        }

        const response = await agent.generate(input);
        const output = response.text || "";

        // Run custom evaluators
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
