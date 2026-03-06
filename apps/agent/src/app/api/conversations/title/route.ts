import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { authenticateRequest } from "@/lib/api-auth";
import { resolveModelForOrg } from "@repo/agentc2/agents";

/**
 * POST /api/conversations/title
 *
 * Generate a concise conversation title from the first user message
 * using a fast, cheap LLM call (GPT-4o-mini).
 *
 * Body: { message: string }
 * Response: { title: string }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await request.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "message is required" }, { status: 400 });
        }

        const model = await resolveModelForOrg("openai", "gpt-4o-mini", authContext.organizationId);
        if (!model) {
            return NextResponse.json(
                { error: "OpenAI API key not configured. Add it via Settings > Integrations." },
                { status: 500 }
            );
        }

        const { text } = await generateText({
            model,
            system: `Generate a short, descriptive title (max 6 words) for a conversation based on the user's first message. Return ONLY the title text, nothing else. No quotes, no punctuation at the end, no prefixes. The title should capture the intent or topic concisely.`,
            prompt: message,
            temperature: 0.3
        });

        const title = text
            .trim()
            .replace(/^["']|["']$/g, "")
            .replace(/[.!?]+$/, "");

        return NextResponse.json({ title });
    } catch (error) {
        console.error("[title-gen] Failed to generate title:", error);
        return NextResponse.json({ error: "Failed to generate title" }, { status: 500 });
    }
}
