import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { processInvocation } from "@repo/agentc2/federation";
import { agentResolver } from "@repo/agentc2/agents";

/**
 * POST /api/federation/invoke
 *
 * Invoke a federated agent through the Federation Gateway.
 *
 * Body:
 * {
 *   "agreementId": "clx...",
 *   "targetOrgSlug": "acme-corp",
 *   "targetAgentSlug": "compliance-checker",
 *   "conversationId": "conv_abc123",    // optional
 *   "message": "Check this document..."
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!body.agreementId || !body.targetAgentSlug || !body.message) {
            return NextResponse.json(
                {
                    success: false,
                    error: "agreementId, targetAgentSlug, and message are required"
                },
                { status: 400 }
            );
        }

        const result = await processInvocation(
            authContext.organizationId,
            {
                agreementId: body.agreementId,
                targetOrgSlug: body.targetOrgSlug || "",
                targetAgentSlug: body.targetAgentSlug,
                conversationId: body.conversationId || "",
                message: body.message,
                contentType: body.contentType
            },
            async (agentSlug, message, organizationId, conversationId) => {
                const hydrated = await agentResolver.resolve({
                    slug: agentSlug,
                    requestContext: {
                        resource: { tenantId: organizationId }
                    }
                });

                if (!hydrated) {
                    throw new Error(`Agent ${agentSlug} not found`);
                }

                const agentResult = await hydrated.agent.generate(
                    [{ role: "user", content: message }],
                    {
                        threadId: conversationId,
                        resourceId: `federation:${authContext.organizationId}`
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                );

                // Extract usage from response (usage shape varies by provider)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const usage = (agentResult as any).usage || (agentResult as any).totalUsage;
                return {
                    response: agentResult.text || "",
                    inputTokens: usage?.promptTokens ?? usage?.inputTokens,
                    outputTokens: usage?.completionTokens ?? usage?.outputTokens
                };
            }
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.policyResult === "blocked" ? 403 : 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Federation] Invoke error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Federation invocation failed"
            },
            { status: 500 }
        );
    }
}
