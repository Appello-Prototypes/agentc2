import { Agent } from "@mastra/core/agent";
import { z } from "zod";

/**
 * Structured Output Agent
 *
 * Returns typed JSON objects instead of plain text.
 * Useful for API responses, data extraction, and programmatic processing.
 */
export const structuredAgent = new Agent({
  id: "structured-output",
  name: "Structured Output Agent",
  instructions: `You are a data extraction specialist. When given text or questions:
1. Extract structured information
2. Organize it into the requested format
3. Be precise and complete

Always provide accurate, well-structured responses.`,
  model: "anthropic/claude-sonnet-4-20250514",
});

/**
 * Common output schemas for demonstration
 */
export const schemas = {
  taskBreakdown: z.object({
    title: z.string().describe("Task title"),
    steps: z.array(
      z.object({
        order: z.number(),
        description: z.string(),
        estimatedMinutes: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })
    ),
    totalEstimatedTime: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]),
  }),

  entityExtraction: z.object({
    people: z.array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
      })
    ),
    organizations: z.array(z.string()),
    locations: z.array(z.string()),
    dates: z.array(z.string()),
    topics: z.array(z.string()),
  }),

  sentimentAnalysis: z.object({
    overall: z.enum(["positive", "negative", "neutral", "mixed"]),
    confidence: z.number().min(0).max(1),
    aspects: z.array(
      z.object({
        topic: z.string(),
        sentiment: z.enum(["positive", "negative", "neutral"]),
        keywords: z.array(z.string()),
      })
    ),
    summary: z.string(),
  }),
};
