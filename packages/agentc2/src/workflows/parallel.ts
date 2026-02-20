import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Ticket Analysis Workflow - Parallel Processing Demo
 *
 * Scenario: Analyze a customer support ticket simultaneously for:
 * 1. Sentiment (customer emotion)
 * 2. Priority (urgency level)
 * 3. Response suggestions
 *
 * This demonstrates how parallel execution saves time compared to sequential processing.
 */

// Input schema for the ticket
const ticketInputSchema = z.object({
    customerName: z.string().describe("Customer's name"),
    subject: z.string().describe("Ticket subject line"),
    content: z.string().describe("Ticket content/message")
});

/**
 * Sentiment Analysis Step - Detect customer emotion
 */
const sentimentStep = createStep({
    id: "sentiment",
    description: "Analyze customer sentiment from the ticket",
    inputSchema: ticketInputSchema,
    outputSchema: z.object({
        emotion: z.enum(["angry", "frustrated", "neutral", "satisfied", "happy"]),
        confidence: z.number(),
        indicators: z.array(z.string()),
        explanation: z.string()
    }),
    execute: async ({ inputData, mastra }) => {
        const startTime = Date.now();
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Analyze the sentiment of this customer support ticket. Determine the customer's emotional state.

Customer: ${inputData.customerName}
Subject: ${inputData.subject}
Message: ${inputData.content}

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "emotion": "angry" | "frustrated" | "neutral" | "satisfied" | "happy",
  "confidence": 0.0-1.0,
  "indicators": ["keyword or phrase that indicates this emotion", ...],
  "explanation": "Brief explanation of why this sentiment was detected"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    emotion: parsed.emotion || "neutral",
                    confidence: parsed.confidence || 0.7,
                    indicators: parsed.indicators || [],
                    explanation: parsed.explanation || "Sentiment analyzed",
                    _timing: Date.now() - startTime
                };
            }
        } catch {
            // Fallback
        }

        return {
            emotion: "neutral" as const,
            confidence: 0.5,
            indicators: ["Unable to parse response"],
            explanation: "Default sentiment assigned"
        };
    }
});

/**
 * Priority Classification Step - Assess urgency
 */
const priorityStep = createStep({
    id: "priority",
    description: "Classify ticket priority based on urgency",
    inputSchema: ticketInputSchema,
    outputSchema: z.object({
        level: z.enum(["critical", "high", "medium", "low"]),
        confidence: z.number(),
        factors: z.array(z.string()),
        suggestedSLA: z.string()
    }),
    execute: async ({ inputData, mastra }) => {
        const startTime = Date.now();
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Classify the priority of this customer support ticket based on urgency and impact.

Customer: ${inputData.customerName}
Subject: ${inputData.subject}
Message: ${inputData.content}

Consider factors like:
- Is there a service outage or complete inability to use the product?
- Is there a deadline mentioned?
- Financial impact or revenue at risk?
- Number of users affected?
- Security or data concerns?

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "level": "critical" | "high" | "medium" | "low",
  "confidence": 0.0-1.0,
  "factors": ["factor 1", "factor 2", ...],
  "suggestedSLA": "e.g., 1 hour, 4 hours, 24 hours, 72 hours"
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    level: parsed.level || "medium",
                    confidence: parsed.confidence || 0.7,
                    factors: parsed.factors || [],
                    suggestedSLA: parsed.suggestedSLA || "24 hours",
                    _timing: Date.now() - startTime
                };
            }
        } catch {
            // Fallback
        }

        return {
            level: "medium" as const,
            confidence: 0.5,
            factors: ["Unable to parse response"],
            suggestedSLA: "24 hours"
        };
    }
});

/**
 * Response Suggestions Step - Generate response options
 */
const suggestionsStep = createStep({
    id: "suggestions",
    description: "Generate suggested responses for the ticket",
    inputSchema: ticketInputSchema,
    outputSchema: z.object({
        responses: z.array(
            z.object({
                tone: z.string(),
                message: z.string()
            })
        ),
        recommendedTone: z.string(),
        keyPointsToAddress: z.array(z.string())
    }),
    execute: async ({ inputData, mastra }) => {
        const startTime = Date.now();
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Generate response suggestions for this customer support ticket.

Customer: ${inputData.customerName}
Subject: ${inputData.subject}
Message: ${inputData.content}

Create 2-3 different response options with varying tones (empathetic, professional, solution-focused).

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "responses": [
    { "tone": "empathetic", "message": "Dear ${inputData.customerName}, I completely understand..." },
    { "tone": "professional", "message": "Dear ${inputData.customerName}, Thank you for contacting..." },
    { "tone": "solution-focused", "message": "Dear ${inputData.customerName}, Here's how we can resolve..." }
  ],
  "recommendedTone": "Which tone is most appropriate for this situation",
  "keyPointsToAddress": ["point 1", "point 2", ...]
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    responses: parsed.responses || [],
                    recommendedTone: parsed.recommendedTone || "professional",
                    keyPointsToAddress: parsed.keyPointsToAddress || [],
                    _timing: Date.now() - startTime
                };
            }
        } catch {
            // Fallback
        }

        return {
            responses: [
                {
                    tone: "professional",
                    message: `Dear ${inputData.customerName}, Thank you for contacting us. We're looking into your issue.`
                }
            ],
            recommendedTone: "professional",
            keyPointsToAddress: ["Acknowledge the issue", "Provide timeline"]
        };
    }
});

/**
 * Combine Results Step - Merge all parallel analyses
 */
const combineStep = createStep({
    id: "combine",
    description: "Combine results from parallel ticket analysis",
    inputSchema: z.object({
        sentiment: z.object({
            emotion: z.enum(["angry", "frustrated", "neutral", "satisfied", "happy"]),
            confidence: z.number(),
            indicators: z.array(z.string()),
            explanation: z.string()
        }),
        priority: z.object({
            level: z.enum(["critical", "high", "medium", "low"]),
            confidence: z.number(),
            factors: z.array(z.string()),
            suggestedSLA: z.string()
        }),
        suggestions: z.object({
            responses: z.array(
                z.object({
                    tone: z.string(),
                    message: z.string()
                })
            ),
            recommendedTone: z.string(),
            keyPointsToAddress: z.array(z.string())
        })
    }),
    outputSchema: z.object({
        sentiment: z.object({
            emotion: z.enum(["angry", "frustrated", "neutral", "satisfied", "happy"]),
            confidence: z.number(),
            indicators: z.array(z.string()),
            explanation: z.string()
        }),
        priority: z.object({
            level: z.enum(["critical", "high", "medium", "low"]),
            confidence: z.number(),
            factors: z.array(z.string()),
            suggestedSLA: z.string()
        }),
        suggestions: z.object({
            responses: z.array(
                z.object({
                    tone: z.string(),
                    message: z.string()
                })
            ),
            recommendedTone: z.string(),
            keyPointsToAddress: z.array(z.string())
        }),
        summary: z.object({
            overallAssessment: z.string(),
            recommendedAction: z.string()
        })
    }),
    execute: async ({ inputData }) => {
        // Determine recommended action based on sentiment and priority
        const { sentiment, priority } = inputData;
        let recommendedAction = "Standard response within SLA";

        if (priority.level === "critical" || sentiment.emotion === "angry") {
            recommendedAction = "Escalate immediately - high priority customer issue";
        } else if (priority.level === "high" || sentiment.emotion === "frustrated") {
            recommendedAction = "Prioritize response - customer needs prompt attention";
        } else if (sentiment.emotion === "happy" || sentiment.emotion === "satisfied") {
            recommendedAction = "Opportunity for positive engagement or upsell";
        }

        const overallAssessment = `${sentiment.emotion.charAt(0).toUpperCase() + sentiment.emotion.slice(1)} customer with ${priority.level} priority issue`;

        return {
            sentiment: inputData.sentiment,
            priority: inputData.priority,
            suggestions: inputData.suggestions,
            summary: {
                overallAssessment,
                recommendedAction
            }
        };
    }
});

export const parallelWorkflow = createWorkflow({
    id: "parallel-processing",
    description:
        "Analyze a customer support ticket in parallel: sentiment, priority, and response suggestions",
    inputSchema: ticketInputSchema,
    outputSchema: z.object({
        sentiment: z.object({
            emotion: z.enum(["angry", "frustrated", "neutral", "satisfied", "happy"]),
            confidence: z.number(),
            indicators: z.array(z.string()),
            explanation: z.string()
        }),
        priority: z.object({
            level: z.enum(["critical", "high", "medium", "low"]),
            confidence: z.number(),
            factors: z.array(z.string()),
            suggestedSLA: z.string()
        }),
        suggestions: z.object({
            responses: z.array(
                z.object({
                    tone: z.string(),
                    message: z.string()
                })
            ),
            recommendedTone: z.string(),
            keyPointsToAddress: z.array(z.string())
        }),
        summary: z.object({
            overallAssessment: z.string(),
            recommendedAction: z.string()
        })
    })
})
    .parallel([sentimentStep, priorityStep, suggestionsStep])
    .then(combineStep)
    .commit();
