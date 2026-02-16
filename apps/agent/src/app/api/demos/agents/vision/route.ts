import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@repo/mastra/core";
import { visionAnalysisSchema } from "@repo/mastra/agents";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { imageUrl, question } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
        }

        const agent = mastra.getAgent("vision");
        if (!agent) {
            return NextResponse.json({ error: "Vision agent not found" }, { status: 500 });
        }

        const response = await agent.generate(
            [
                {
                    role: "user",
                    content: [
                        { type: "image", image: imageUrl, mimeType: "image/jpeg" },
                        {
                            type: "text",
                            text: question || "Describe this image in detail"
                        }
                    ]
                }
            ],
            {
                structuredOutput: {
                    schema: visionAnalysisSchema
                }
            }
        );

        return NextResponse.json({
            analysis: response.object,
            imageUrl
        });
    } catch (error) {
        console.error("Vision agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Analysis failed" },
            { status: 500 }
        );
    }
}
