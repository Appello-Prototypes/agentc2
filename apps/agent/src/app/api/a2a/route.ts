import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { processInvocation } from "@repo/mastra/federation";
import { writeAuditLog } from "@repo/mastra/audit";

/**
 * POST /api/a2a
 *
 * A2A-compatible JSON-RPC 2.0 endpoint for external callers.
 *
 * Authenticates via Bearer token (API key mapped to an org),
 * routes to the Federation Gateway with the external caller
 * treated as a "virtual org."
 *
 * JSON-RPC methods:
 *   - "tasks/send": Invoke a federated agent
 *   - "tasks/get":  Get status of a previous invocation (placeholder)
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return jsonRpcError(null, -32000, "Missing or invalid Authorization header");
        }

        const token = authHeader.slice(7);
        const apiKey = await resolveApiKey(token);
        if (!apiKey) {
            return jsonRpcError(null, -32000, "Invalid API key");
        }

        const body = await request.json();
        if (!body.jsonrpc || body.jsonrpc !== "2.0") {
            return jsonRpcError(body.id ?? null, -32600, "Invalid JSON-RPC request");
        }

        const { method, params, id: rpcId } = body;

        switch (method) {
            case "tasks/send":
                return handleTaskSend(rpcId, params, apiKey);
            case "tasks/get":
                return jsonRpcError(rpcId, -32601, "tasks/get not yet implemented");
            default:
                return jsonRpcError(rpcId, -32601, `Method not found: ${method}`);
        }
    } catch (error) {
        console.error("[A2A] Error:", error);
        return jsonRpcError(null, -32603, "Internal error");
    }
}

interface ApiKeyContext {
    organizationId: string;
    userId: string;
    keyId: string;
}

async function resolveApiKey(token: string): Promise<ApiKeyContext | null> {
    // Look up the token in ToolCredential (reuses existing API key pattern)
    const credential = await prisma.toolCredential.findFirst({
        where: {
            toolId: "a2a-api-key",
            isActive: true
        },
        select: {
            id: true,
            organizationId: true,
            createdBy: true,
            credentials: true
        }
    });

    if (!credential) return null;

    // The credentials JSON should have a "token" field with the hashed key
    const creds = credential.credentials as Record<string, unknown>;
    if (!creds || creds.token !== token) return null;

    return {
        organizationId: credential.organizationId,
        userId: credential.createdBy || "api-key",
        keyId: credential.id
    };
}

async function handleTaskSend(
    rpcId: string | number | null,
    params: Record<string, unknown>,
    apiKey: ApiKeyContext
) {
    const targetOrgSlug = params.targetOrgSlug as string;
    const targetAgentSlug = params.targetAgentSlug as string;
    const message = params.message as string;
    const conversationId = (params.conversationId as string) || `a2a:${Date.now()}`;

    if (!targetOrgSlug || !targetAgentSlug || !message) {
        return jsonRpcError(
            rpcId,
            -32602,
            "Required params: targetOrgSlug, targetAgentSlug, message"
        );
    }

    // Find the target org
    const targetOrg = await prisma.organization.findUnique({
        where: { slug: targetOrgSlug },
        select: { id: true }
    });

    if (!targetOrg) {
        return jsonRpcError(rpcId, -32602, "Target organization not found");
    }

    // Find a federation agreement between these orgs
    const agreement = await prisma.federationAgreement.findFirst({
        where: {
            OR: [
                {
                    initiatorOrgId: apiKey.organizationId,
                    responderOrgId: targetOrg.id
                },
                {
                    initiatorOrgId: targetOrg.id,
                    responderOrgId: apiKey.organizationId
                }
            ],
            status: "active"
        },
        select: { id: true }
    });

    if (!agreement) {
        return jsonRpcError(
            rpcId,
            -32000,
            "No active federation agreement with the target organization"
        );
    }

    const { agentResolver } = await import("@repo/mastra");

    const result = await processInvocation(
        apiKey.organizationId,
        {
            agreementId: agreement.id,
            targetOrgSlug,
            targetAgentSlug,
            message,
            conversationId
        },
        async (agentSlug, msg, organizationId, convId) => {
            const hydrated = await agentResolver.resolve({
                slug: agentSlug,
                requestContext: {
                    resource: { tenantId: organizationId }
                }
            });

            if (!hydrated) throw new Error(`Agent ${agentSlug} not found`);

            const agentResult = await hydrated.agent.generate([{ role: "user", content: msg }], {
                threadId: convId,
                resourceId: `a2a:${apiKey.organizationId}`
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const usage = (agentResult as any).usage || (agentResult as any).totalUsage;

            return {
                response: agentResult.text || "",
                inputTokens: usage?.promptTokens ?? usage?.inputTokens,
                outputTokens: usage?.completionTokens ?? usage?.outputTokens
            };
        }
    );

    await writeAuditLog({
        organizationId: apiKey.organizationId,
        actorType: "system",
        actorId: `api-key:${apiKey.keyId}`,
        action: "a2a.tasks_send",
        resource: `${targetOrgSlug}/${targetAgentSlug}`,
        outcome: result.success ? "success" : "error",
        metadata: { conversationId, via: "a2a-jsonrpc" }
    });

    if (!result.success) {
        return jsonRpcError(rpcId, -32000, result.error || "Invocation failed");
    }

    return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
            id: conversationId,
            status: {
                state: "completed",
                message: {
                    role: "agent",
                    parts: [{ type: "text", text: result.response }]
                }
            }
        }
    });
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
    return NextResponse.json(
        {
            jsonrpc: "2.0",
            id,
            error: { code, message }
        },
        { status: code === -32000 ? 400 : code === -32600 ? 400 : 500 }
    );
}
