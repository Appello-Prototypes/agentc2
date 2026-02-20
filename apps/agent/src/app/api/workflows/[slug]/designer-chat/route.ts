import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/agentc2/agents";

function extractJson(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
}

type JsonPatchOperation = {
    op: "add" | "remove" | "replace";
    path: string;
    value?: unknown;
};

function normalizePatch(patch: unknown): JsonPatchOperation[] {
    if (!Array.isArray(patch)) return [];
    return patch.filter((item): item is JsonPatchOperation => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as JsonPatchOperation;
        return (
            ["add", "remove", "replace"].includes(candidate.op) &&
            typeof candidate.path === "string"
        );
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const { prompt, definitionJson, selected } = body;

        if (!prompt || !definitionJson) {
            return NextResponse.json(
                { success: false, error: "Prompt and definitionJson are required" },
                { status: 400 }
            );
        }

        const { agent } = await agentResolver.resolve({ slug: "assistant" });
        const response = await agent.generate(
            `You are a workflow builder assistant. Produce a JSON Patch (RFC 6902) that updates the workflow definition to satisfy the user's request.

User request: ${prompt}

Selected entity: ${selected ? JSON.stringify(selected) : "none"}

Workflow definition JSON:
${JSON.stringify(definitionJson)}

Constraints:
- Output JSON only.
- Response shape: { "summary": string, "patch": [ { "op": "add|remove|replace", "path": string, "value"?: any } ] }
- Use only add/replace/remove operations.
- Patch paths must be valid JSON Pointer paths in the provided definition.
- Keep IDs stable unless the request explicitly asks to change them.
`
        );

        const parsed = extractJson(response.text || "");
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Failed to parse JSON from response" },
                { status: 422 }
            );
        }

        const patch = normalizePatch(parsed.patch);

        return NextResponse.json({
            success: true,
            summary: parsed.summary || `Update for workflow '${slug}'`,
            patch
        });
    } catch (error) {
        console.error("[Workflow Designer Chat] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate workflow changes" },
            { status: 500 }
        );
    }
}
