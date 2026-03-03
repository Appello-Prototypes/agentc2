import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

async function main() {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = anthropic("claude-opus-4-6");

    console.log("Testing claude-opus-4-6...");
    try {
        const result = await generateText({
            model,
            prompt: "Say hello in exactly 5 words.",
            maxTokens: 100
        });
        console.log("Response:", result.text);
        console.log("Usage:", JSON.stringify(result.usage));
    } catch (e: any) {
        console.error("ERROR:", e.message);
        if (e.cause) console.error("Cause:", e.cause);
    }
}
main();
