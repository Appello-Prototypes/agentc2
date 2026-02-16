import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/mastra/agents";
import { validateWorkflowDefinition } from "@/lib/workflow-validation";

function extractJson(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
}

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
            `Generate a workflow definition JSON for the following request.

Request: ${prompt}

Constraints:
- Output ONLY JSON.
- JSON shape: { "steps": [ { "id": string, "type": string, "name": string, "inputMapping": object, "config": object } ] }
- Valid types: agent, tool, workflow, branch, parallel, foreach, human, transform, delay
- For agent steps include config.agentSlug and config.promptTemplate.
- For tool steps include config.toolId.
- For workflow steps include config.workflowId.
- For branch steps include config.branches: [{ id, condition, steps }].
- For parallel steps include config.branches: [{ id, steps }].
- For foreach steps include config.collectionPath and config.steps.

Respond with JSON only.`
        );

        const parsed = extractJson(response.text || "");
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Failed to parse workflow JSON" },
                { status: 422 }
            );
        }

        const validation = validateWorkflowDefinition(parsed);

        return NextResponse.json({
            success: true,
            definitionJson: parsed,
            validation
        });
    } catch (error) {
        console.error("[Workflow Generate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate workflow" },
            { status: 500 }
        );
    }
}
