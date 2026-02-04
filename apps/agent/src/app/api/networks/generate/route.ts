import { NextRequest, NextResponse } from "next/server";
import { agentResolver, listAvailableTools } from "@repo/mastra";
import { prisma } from "@repo/database";
import { validateNetworkDefinition } from "@/lib/network-validation";

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

        const [agents, workflows] = await Promise.all([
            prisma.agent.findMany({ select: { id: true, slug: true, name: true } }),
            prisma.workflow.findMany({ select: { id: true, slug: true, name: true } })
        ]);
        const tools = listAvailableTools();

        const { agent } = await agentResolver.resolve({ slug: "assistant" });
        const response = await agent.generate(
            `Generate a network definition JSON for the request below.

Request: ${prompt}

Available agents (use id in primitives):
${JSON.stringify(agents)}

Available workflows (use id in primitives):
${JSON.stringify(workflows)}

Available tools (use id in primitives):
${JSON.stringify(tools)}

Constraints:
- Output ONLY JSON.
- Shape: { "topologyJson": { "nodes": [], "edges": [] }, "primitives": [ ... ] }
- Each primitive: { "primitiveType": "agent"|"workflow"|"tool", "agentId"|"workflowId"|"toolId": string }
- Use the ids provided above.

Respond with JSON only.`
        );

        const parsed = extractJson(response.text || "");
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Failed to parse network JSON" },
                { status: 422 }
            );
        }

        const validation = validateNetworkDefinition({
            topologyJson: parsed.topologyJson,
            primitives: parsed.primitives
        });

        return NextResponse.json({
            success: true,
            topologyJson: parsed.topologyJson,
            primitives: parsed.primitives,
            validation
        });
    } catch (error) {
        console.error("[Network Generate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate network" },
            { status: 500 }
        );
    }
}
