import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Analysis Step - Uses the assistant agent to analyze a query
 */
const analyzeStep = createStep({
    id: "analyze",
    description: "Analyze the input query using the AI assistant",
    inputSchema: z.object({
        query: z.string().describe("The query to analyze")
    }),
    outputSchema: z.object({
        analysis: z.string().describe("The analysis result"),
        confidence: z.enum(["high", "medium", "low"]).describe("Confidence level")
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Please analyze the following query and provide a detailed analysis:

Query: ${inputData.query}

Provide:
1. Key insights about what the user is asking
2. Relevant context or background information
3. Potential approaches or solutions

Be thorough but concise.`
        );

        // Determine confidence based on response length and content
        const text = response.text || "";
        const confidence = text.length > 500 ? "high" : text.length > 200 ? "medium" : "low";

        return {
            analysis: text,
            confidence
        };
    }
});

/**
 * Summarize Step - Summarizes the analysis into key points
 */
const summarizeStep = createStep({
    id: "summarize",
    description: "Summarize the analysis into actionable key points",
    inputSchema: z.object({
        analysis: z.string().describe("The analysis to summarize"),
        confidence: z.enum(["high", "medium", "low"]).describe("Confidence level")
    }),
    outputSchema: z.object({
        summary: z.string().describe("Brief summary"),
        keyPoints: z.array(z.string()).describe("List of key points"),
        nextSteps: z.array(z.string()).describe("Suggested next steps")
    }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Based on this analysis (confidence: ${inputData.confidence}):

${inputData.analysis}

Please provide:
1. A brief 1-2 sentence summary
2. 3-5 key points as bullet points
3. 2-3 suggested next steps

Format your response as JSON with this structure:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "nextSteps": ["...", "..."]
}`
        );

        try {
            // Try to parse JSON from the response
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    summary: parsed.summary || "Analysis complete",
                    keyPoints: parsed.keyPoints || [],
                    nextSteps: parsed.nextSteps || []
                };
            }
        } catch {
            // Fall back to basic extraction if JSON parsing fails
        }

        return {
            summary: "Analysis complete. See key points for details.",
            keyPoints: ["Analysis provided in previous step"],
            nextSteps: ["Review the analysis", "Take action based on findings"]
        };
    }
});

/**
 * Analysis Workflow
 *
 * A multi-step workflow that:
 * 1. Analyzes a query using the AI assistant
 * 2. Summarizes the analysis into actionable insights
 */
export const analysisWorkflow = createWorkflow({
    id: "analysis-workflow",
    description: "Analyze a query and provide summarized insights",
    inputSchema: z.object({
        query: z.string().describe("The query to analyze")
    }),
    outputSchema: z.object({
        summary: z.string(),
        keyPoints: z.array(z.string()),
        nextSteps: z.array(z.string())
    })
})
    .then(analyzeStep)
    .then(summarizeStep);

analysisWorkflow.commit();
