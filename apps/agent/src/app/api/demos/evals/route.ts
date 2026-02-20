import { NextRequest, NextResponse } from "next/server";
import { evaluateHelpfulness, evaluateCodeQuality } from "@repo/agentc2/scorers";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { input, output } = await req.json();

        if (!input || !output) {
            return NextResponse.json({ error: "Input and output are required" }, { status: 400 });
        }

        // Run custom evaluators (built-in LLM scorers would require additional API calls)
        const helpfulness = evaluateHelpfulness(input, output);
        const codeQuality = evaluateCodeQuality(output);

        return NextResponse.json({
            helpfulness,
            codeQuality
        });
    } catch (error) {
        console.error("Evaluation error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Evaluation failed" },
            { status: 500 }
        );
    }
}
