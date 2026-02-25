import { getToolsByNamesAsync } from "@repo/agentc2";
import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAgentAccess } from "@/lib/authz";

const VOICE_MAX_CHARS = 4000;

/**
 * Truncate tool output for voice context so the model doesn't try to
 * verbalize thousands of characters.
 */
function truncateForVoice(result: unknown, maxChars = VOICE_MAX_CHARS): unknown {
    if (result === null || result === undefined) return result;

    // Handle arrays: keep first N items
    if (Array.isArray(result)) {
        const serialized = JSON.stringify(result);
        if (serialized.length <= maxChars) return result;

        const kept: unknown[] = [];
        let length = 2; // account for []
        for (const item of result) {
            const itemStr = JSON.stringify(item);
            if (length + itemStr.length + 1 > maxChars && kept.length > 0) break;
            kept.push(item);
            length += itemStr.length + 1;
        }
        const remaining = result.length - kept.length;
        if (remaining > 0) {
            kept.push(`... and ${remaining} more items`);
        }
        return kept;
    }

    // Handle strings
    if (typeof result === "string") {
        if (result.length <= maxChars) return result;
        return `[Result truncated for voice. Showing first ${maxChars} chars of ${result.length}.]\n${result.slice(0, maxChars)}`;
    }

    // Handle objects
    if (typeof result === "object") {
        const serialized = JSON.stringify(result);
        if (serialized.length <= maxChars) return result;
        return `[Result truncated for voice. Showing first ${maxChars} chars of ${serialized.length}.]\n${serialized.slice(0, maxChars)}`;
    }

    return result;
}

/**
 * POST /api/agents/[id]/realtime/tool-execute
 *
 * Executes a tool on the server when the OpenAI Realtime model triggers
 * a function call. The browser forwards the function call from the data
 * channel to this endpoint, receives the result, and sends it back.
 *
 * Request: { toolName: string, arguments: object, callId: string }
 * Response: { result: any, callId: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) return accessResult.response;

        const body = await request.json();
        const { toolName, arguments: toolArgs, callId } = body;

        if (!toolName || typeof toolName !== "string") {
            return NextResponse.json({ error: "toolName is required" }, { status: 400 });
        }
        if (!callId || typeof callId !== "string") {
            return NextResponse.json({ error: "callId is required" }, { status: 400 });
        }

        // Resolve organization for MCP tool access
        const record = await prisma.agent.findFirst({
            where: { OR: [{ id }, { slug: id }] },
            select: { tenantId: true }
        });
        const organizationId = authResult.context.organizationId || record?.tenantId || undefined;

        // Look up and execute the tool
        const tools = await getToolsByNamesAsync([toolName], organizationId);
        const tool = tools[toolName];

        if (!tool) {
            return NextResponse.json(
                {
                    result: `Tool "${toolName}" not found`,
                    callId
                },
                { status: 200 }
            );
        }

        let result: unknown;
        try {
            if (typeof tool.execute === "function") {
                result = await tool.execute(toolArgs || {}, {
                    resourceId: authResult.context.userId,
                    tenantId: organizationId
                });
            } else {
                result = `Tool "${toolName}" has no execute function`;
            }
        } catch (execError) {
            const msg = execError instanceof Error ? execError.message : "Tool execution failed";
            console.error(`[Realtime Tool] ${toolName} failed:`, execError);
            result = `Error: ${msg}`;
        }

        // Truncate for voice context
        const truncated = truncateForVoice(result);

        return NextResponse.json({ result: truncated, callId });
    } catch (error) {
        console.error("[Realtime Tool] Unhandled error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
