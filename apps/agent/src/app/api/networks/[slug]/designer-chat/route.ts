import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/mastra/agents";

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
        const { prompt, topologyJson, primitives, selected } = body;

        if (!prompt || !topologyJson) {
            return NextResponse.json(
                { success: false, error: "Prompt and topologyJson are required" },
                { status: 400 }
            );
        }

        const { agent } = await agentResolver.resolve({ slug: "assistant" });
        const response = await agent.generate(
            `You are a network topology builder assistant. Produce a JSON Patch (RFC 6902) that updates the network topology and primitives to satisfy the user's request.

User request: ${prompt}

Selected entity: ${selected ? JSON.stringify(selected) : "none"}

Network data JSON (root contains topologyJson + primitives):
${JSON.stringify({ topologyJson, primitives })}

Constraints:
- Output JSON only.
- Response shape: { "summary": string, "patch": [ { "op": "add|remove|replace", "path": string, "value"?: any } ] }
- Use only add/replace/remove operations.
- Patch paths must be valid JSON Pointer paths in the provided data.
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
            summary: parsed.summary || `Update for network '${slug}'`,
            patch
        });
    } catch (error) {
        console.error("[Network Designer Chat] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate network changes" },
            { status: 500 }
        );
    }
}
