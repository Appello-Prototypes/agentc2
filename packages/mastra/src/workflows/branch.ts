import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Smart Request Router - Conditional Branch Demo
 *
 * Scenario: Route incoming customer requests to the appropriate department:
 * - Refund requests → Billing team
 * - Technical issues → Support team
 * - Feature requests → Product team
 * - General questions → FAQ/Help desk
 *
 * This demonstrates intelligent routing with AI-powered classification.
 */

// Shared input schema for routing
const requestInputSchema = z.object({
    customerEmail: z.string().describe("Customer's email address"),
    message: z.string().describe("Customer's request message")
});

// Classification output that carries through to handlers
const classificationSchema = z.object({
    customerEmail: z.string(),
    message: z.string(),
    requestType: z.enum(["refund", "technical", "feature", "general"]),
    confidence: z.number(),
    reasoning: z.string(),
    keywords: z.array(z.string())
});

/**
 * Classify Request Step - AI determines request type
 */
const classifyStep = createStep({
    id: "classify",
    description: "Classify the customer request into the appropriate category",
    inputSchema: requestInputSchema,
    outputSchema: classificationSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `Classify this customer request into one of four categories.

Customer Email: ${inputData.customerEmail}
Message: ${inputData.message}

Categories:
1. "refund" - Requests for money back, billing disputes, cancellation with refund, charge disputes
2. "technical" - Bug reports, errors, crashes, things not working, how-to for technical issues
3. "feature" - Suggestions for new features, improvements, "it would be nice if...", enhancement requests
4. "general" - General questions, account inquiries, pricing info, anything that doesn't fit above

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "requestType": "refund" | "technical" | "feature" | "general",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this category was chosen",
  "keywords": ["keyword1", "keyword2"] 
}`
        );

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    customerEmail: inputData.customerEmail,
                    message: inputData.message,
                    requestType: parsed.requestType || "general",
                    confidence: parsed.confidence || 0.7,
                    reasoning: parsed.reasoning || "Classification complete",
                    keywords: parsed.keywords || []
                };
            }
        } catch {
            // Fallback
        }

        return {
            customerEmail: inputData.customerEmail,
            message: inputData.message,
            requestType: "general" as const,
            confidence: 0.5,
            reasoning: "Default classification",
            keywords: []
        };
    }
});

// Handler output schema
const handlerOutputSchema = z.object({
    department: z.string(),
    ticketId: z.string(),
    priority: z.enum(["urgent", "high", "normal", "low"]),
    autoResponse: z.string(),
    nextSteps: z.array(z.string()),
    estimatedResolution: z.string()
});

/**
 * Handle Refund Request - Billing team handler
 */
const handleRefundStep = createStep({
    id: "handle-refund",
    description: "Process refund request through billing department",
    inputSchema: classificationSchema,
    outputSchema: handlerOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are a billing department specialist. Generate an appropriate response for this refund request.

Customer: ${inputData.customerEmail}
Request: ${inputData.message}

Create a professional, empathetic response that:
1. Acknowledges their refund request
2. Explains the refund process briefly
3. Sets expectations for timeline

Respond with ONLY a JSON object (no markdown):
{
  "priority": "urgent" | "high" | "normal" | "low",
  "autoResponse": "The email response to send to the customer",
  "nextSteps": ["step1", "step2"],
  "estimatedResolution": "e.g., 3-5 business days"
}`
        );

        const ticketId = `REF-${Date.now().toString(36).toUpperCase()}`;

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    department: "Billing",
                    ticketId,
                    priority: parsed.priority || "normal",
                    autoResponse: parsed.autoResponse || "We received your refund request.",
                    nextSteps: parsed.nextSteps || ["Review request", "Process refund"],
                    estimatedResolution: parsed.estimatedResolution || "5-7 business days"
                };
            }
        } catch {
            // Fallback
        }

        return {
            department: "Billing",
            ticketId,
            priority: "normal" as const,
            autoResponse: `Dear Customer, We have received your refund request and will process it within 5-7 business days.`,
            nextSteps: ["Verify purchase", "Review refund eligibility", "Process refund"],
            estimatedResolution: "5-7 business days"
        };
    }
});

/**
 * Handle Technical Issue - Support team handler
 */
const handleTechnicalStep = createStep({
    id: "handle-technical",
    description: "Process technical issue through support department",
    inputSchema: classificationSchema,
    outputSchema: handlerOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are a technical support specialist. Generate an appropriate response for this technical issue.

Customer: ${inputData.customerEmail}
Issue: ${inputData.message}

Create a helpful response that:
1. Acknowledges the technical issue
2. Asks relevant clarifying questions if needed
3. Provides any immediate troubleshooting steps

Respond with ONLY a JSON object (no markdown):
{
  "priority": "urgent" | "high" | "normal" | "low",
  "autoResponse": "The email response to send to the customer",
  "nextSteps": ["troubleshooting step 1", "step 2"],
  "estimatedResolution": "e.g., 24-48 hours"
}`
        );

        const ticketId = `TECH-${Date.now().toString(36).toUpperCase()}`;

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    department: "Technical Support",
                    ticketId,
                    priority: parsed.priority || "high",
                    autoResponse: parsed.autoResponse || "We received your technical issue report.",
                    nextSteps: parsed.nextSteps || ["Investigate issue", "Provide solution"],
                    estimatedResolution: parsed.estimatedResolution || "24-48 hours"
                };
            }
        } catch {
            // Fallback
        }

        return {
            department: "Technical Support",
            ticketId,
            priority: "high" as const,
            autoResponse: `Dear Customer, Thank you for reporting this issue. Our technical team is investigating and will respond within 24 hours.`,
            nextSteps: ["Reproduce issue", "Investigate logs", "Deploy fix or workaround"],
            estimatedResolution: "24-48 hours"
        };
    }
});

/**
 * Handle Feature Request - Product team handler
 */
const handleFeatureStep = createStep({
    id: "handle-feature",
    description: "Process feature request through product department",
    inputSchema: classificationSchema,
    outputSchema: handlerOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are a product manager. Generate an appropriate response for this feature request.

Customer: ${inputData.customerEmail}
Request: ${inputData.message}

Create an appreciative response that:
1. Thanks them for the suggestion
2. Explains how feature requests are evaluated
3. Sets realistic expectations

Respond with ONLY a JSON object (no markdown):
{
  "priority": "urgent" | "high" | "normal" | "low",
  "autoResponse": "The email response to send to the customer",
  "nextSteps": ["step1", "step2"],
  "estimatedResolution": "e.g., Added to backlog for Q2 review"
}`
        );

        const ticketId = `FEAT-${Date.now().toString(36).toUpperCase()}`;

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    department: "Product",
                    ticketId,
                    priority: parsed.priority || "normal",
                    autoResponse: parsed.autoResponse || "Thank you for your feature suggestion!",
                    nextSteps: parsed.nextSteps || ["Add to backlog", "Review in planning"],
                    estimatedResolution: parsed.estimatedResolution || "Added to product backlog"
                };
            }
        } catch {
            // Fallback
        }

        return {
            department: "Product",
            ticketId,
            priority: "normal" as const,
            autoResponse: `Dear Customer, Thank you for your feature suggestion! We've added it to our product backlog for review by our team.`,
            nextSteps: ["Add to feature backlog", "Assess feasibility", "Prioritize in roadmap"],
            estimatedResolution: "Added to product backlog for quarterly review"
        };
    }
});

/**
 * Handle General Question - Help desk handler
 */
const handleGeneralStep = createStep({
    id: "handle-general",
    description: "Process general inquiry through help desk",
    inputSchema: classificationSchema,
    outputSchema: handlerOutputSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("assistant");

        if (!agent) {
            throw new Error("Assistant agent not found");
        }

        const response = await agent.generate(
            `You are a customer service representative. Generate a helpful response for this general inquiry.

Customer: ${inputData.customerEmail}
Question: ${inputData.message}

Create a friendly, helpful response that:
1. Answers their question directly if possible
2. Points to relevant resources
3. Offers further assistance

Respond with ONLY a JSON object (no markdown):
{
  "priority": "urgent" | "high" | "normal" | "low",
  "autoResponse": "The email response to send to the customer",
  "nextSteps": ["step1", "step2"],
  "estimatedResolution": "e.g., Immediate or within 24 hours"
}`
        );

        const ticketId = `INQ-${Date.now().toString(36).toUpperCase()}`;

        try {
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    department: "Customer Service",
                    ticketId,
                    priority: parsed.priority || "normal",
                    autoResponse: parsed.autoResponse || "Thank you for contacting us!",
                    nextSteps: parsed.nextSteps || ["Respond to inquiry"],
                    estimatedResolution: parsed.estimatedResolution || "Within 24 hours"
                };
            }
        } catch {
            // Fallback
        }

        return {
            department: "Customer Service",
            ticketId,
            priority: "normal" as const,
            autoResponse: `Dear Customer, Thank you for reaching out! We'll get back to you with an answer within 24 hours.`,
            nextSteps: ["Review question", "Provide comprehensive answer"],
            estimatedResolution: "Within 24 hours"
        };
    }
});

/**
 * Finalize Step - Combine classification and handler results
 */
const finalizeStep = createStep({
    id: "finalize",
    description: "Finalize the routing result with full details",
    inputSchema: z.object({
        "handle-refund": handlerOutputSchema.optional(),
        "handle-technical": handlerOutputSchema.optional(),
        "handle-feature": handlerOutputSchema.optional(),
        "handle-general": handlerOutputSchema.optional()
    }),
    outputSchema: z.object({
        routedTo: z.string(),
        ticketId: z.string(),
        priority: z.enum(["urgent", "high", "normal", "low"]),
        autoResponse: z.string(),
        nextSteps: z.array(z.string()),
        estimatedResolution: z.string(),
        branch: z.string()
    }),
    execute: async ({ inputData }) => {
        const result =
            inputData["handle-refund"] ||
            inputData["handle-technical"] ||
            inputData["handle-feature"] ||
            inputData["handle-general"];

        const branch = inputData["handle-refund"]
            ? "refund"
            : inputData["handle-technical"]
              ? "technical"
              : inputData["handle-feature"]
                ? "feature"
                : "general";

        return {
            routedTo: result?.department || "Customer Service",
            ticketId: result?.ticketId || `TKT-${Date.now()}`,
            priority: result?.priority || "normal",
            autoResponse: result?.autoResponse || "Thank you for contacting us.",
            nextSteps: result?.nextSteps || [],
            estimatedResolution: result?.estimatedResolution || "TBD",
            branch
        };
    }
});

export const branchWorkflow = createWorkflow({
    id: "conditional-branch",
    description:
        "Smart request router - classify and route customer requests to the right department",
    inputSchema: requestInputSchema,
    outputSchema: z.object({
        routedTo: z.string(),
        ticketId: z.string(),
        priority: z.enum(["urgent", "high", "normal", "low"]),
        autoResponse: z.string(),
        nextSteps: z.array(z.string()),
        estimatedResolution: z.string(),
        branch: z.string()
    })
})
    .then(classifyStep)
    .branch([
        [async ({ inputData }) => inputData.requestType === "refund", handleRefundStep],
        [async ({ inputData }) => inputData.requestType === "technical", handleTechnicalStep],
        [async ({ inputData }) => inputData.requestType === "feature", handleFeatureStep],
        [async ({ inputData }) => inputData.requestType === "general", handleGeneralStep]
    ])
    .then(finalizeStep)
    .commit();
