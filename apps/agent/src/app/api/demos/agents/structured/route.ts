import { NextRequest, NextResponse } from "next/server";
import { mastra, schemas } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, schema: schemaName } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const agent = mastra.getAgent("structured");
        if (!agent) {
            return NextResponse.json({ error: "Structured agent not found" }, { status: 500 });
        }

        const selectedSchema = schemas[schemaName as keyof typeof schemas] || schemas.taskBreakdown;

        const response = await agent.generate(prompt, {
            structuredOutput: {
                schema: selectedSchema
            }
        });

        return NextResponse.json({
            object: response.object,
            schema: schemaName || "taskBreakdown"
        });
    } catch (error) {
        console.error("Structured agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Generation failed" },
            { status: 500 }
        );
    }
}
