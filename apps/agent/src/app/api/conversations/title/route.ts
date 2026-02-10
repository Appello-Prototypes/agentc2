import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

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
        const { message } = await request.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "message is required" }, { status: 400 });
        }

        const { text } = await generateText({
            model: openai("gpt-4o-mini"),
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
