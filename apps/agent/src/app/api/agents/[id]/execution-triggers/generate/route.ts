import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/mastra";

function extractJson(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
}

const VALID_TYPES = ["scheduled", "webhook", "event", "mcp", "api", "manual", "test"];

/**
 * POST /api/agents/[id]/execution-triggers/generate
 *
 * AI-assisted trigger configuration generation.
 * Accepts a natural language prompt and returns a structured trigger config.
 * Follows the same pattern as /api/workflows/generate and /api/networks/generate.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json(
                { success: false, error: "Prompt is required" },
                { status: 400 }
            );
        }

        const { agent } = await agentResolver.resolve({ slug: "assistant" });
        const response = await agent.generate(
            `Generate an execution trigger configuration JSON for the following request.

Request: ${prompt}

Constraints:
- Output ONLY JSON.
- JSON shape: { "type": string, "name": string, "description": string, "cronExpr": string, "timezone": string, "eventName": string, "input": string, "maxSteps": number, "environment": string, "isActive": boolean }
- Valid types: ${VALID_TYPES.join(", ")}
- For "scheduled" type: MUST include "cronExpr" (a valid cron expression, e.g. "*/3 * * * *" for every 3 minutes) and "timezone" (e.g. "UTC", "America/Toronto").
- For "event" type: MUST include "eventName".
- For "webhook" type: no additional required fields.
- For other types (mcp, api, manual, test): no additional required fields.
- "name" should be a short, descriptive human-readable name for the trigger.
- "description" should be a brief explanation of what the trigger does.
- "input" is the default text input that will be sent to the agent when the trigger fires. Leave empty string if not applicable.
- "maxSteps" is optional, use 0 if not specified.
- "environment" is optional, use empty string if not specified. Valid values: "development", "staging", "production".
- "isActive" should default to true.
- Only include fields that are relevant to the chosen type. Use empty string for irrelevant string fields and 0 for irrelevant number fields.

Respond with JSON only.`
        );

        const parsed = extractJson(response.text || "");
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Failed to parse trigger configuration from AI response" },
                { status: 422 }
            );
        }

        // Validate the type field
        if (parsed.type && !VALID_TYPES.includes(parsed.type)) {
            parsed.type = "scheduled";
        }

        // Ensure required fields have defaults
        const config = {
            type: parsed.type || "scheduled",
            name: parsed.name || "",
            description: parsed.description || "",
            cronExpr: parsed.cronExpr || "",
            timezone: parsed.timezone || "UTC",
            eventName: parsed.eventName || "",
            input: parsed.input || "",
            maxSteps: typeof parsed.maxSteps === "number" ? parsed.maxSteps : 0,
            environment: parsed.environment || "",
            isActive: parsed.isActive !== false
        };

        return NextResponse.json({
            success: true,
            config
        });
    } catch (error) {
        console.error("[Execution Triggers Generate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate trigger configuration" },
            { status: 500 }
        );
    }
}
