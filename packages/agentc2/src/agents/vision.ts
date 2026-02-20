import { Agent } from "@mastra/core/agent";
import { z } from "zod";

/**
 * Vision Agent
 *
 * Analyzes images and extracts information.
 * Supports image URLs and base64-encoded images.
 */
export const visionAgent = new Agent({
    id: "vision-analyst",
    name: "Vision Analyst",
    instructions: `You are an expert image analyst. When shown an image:

1. Describe what you see in detail
2. Identify key objects, people, text, and elements
3. Note colors, composition, and style
4. Extract any text visible in the image
5. Provide relevant context or insights

Be thorough but concise. Structure your analysis clearly.`,
    model: "anthropic/claude-sonnet-4-20250514"
});

/**
 * Vision analysis output schema
 */
export const visionAnalysisSchema = z.object({
    description: z.string().describe("Overall description of the image"),
    objects: z.array(
        z.object({
            name: z.string(),
            confidence: z.enum(["high", "medium", "low"]),
            location: z.string().optional().describe("Where in the image")
        })
    ),
    text: z.array(z.string()).describe("Any text visible in the image"),
    colors: z.array(z.string()).describe("Dominant colors"),
    mood: z.string().optional().describe("Overall mood or atmosphere"),
    tags: z.array(z.string()).describe("Relevant tags for the image")
});
