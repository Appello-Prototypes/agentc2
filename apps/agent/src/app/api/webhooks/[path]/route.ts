import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { createHmac, timingSafeEqual } from "crypto";
import { inngest } from "@/lib/inngest";

/**
 * Verify webhook signature
 */
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;

    try {
        const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");

        const sigBuffer = Buffer.from(signature, "hex");
        const expectedBuffer = Buffer.from(expectedSig, "hex");

        if (sigBuffer.length !== expectedBuffer.length) return false;

        return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

/**
 * POST /api/webhooks/[path]
 *
 * Webhook ingestion endpoint for agent triggers.
 * Validates signature and queues agent invocation.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string }> }
) {
    try {
        const { path } = await params;

        // Find trigger by webhook path
        const trigger = await prisma.agentTrigger.findUnique({
            where: { webhookPath: path },
            include: {
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        isActive: true
                    }
                }
            }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: "Webhook not found" },
                { status: 404 }
            );
        }

        if (!trigger.isActive) {
            return NextResponse.json(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        if (!trigger.agent.isActive) {
            return NextResponse.json(
                { success: false, error: "Agent is disabled" },
                { status: 403 }
            );
        }

        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");

        // Verify signature if secret is set
        if (trigger.webhookSecret) {
            if (!verifySignature(rawBody, signature, trigger.webhookSecret)) {
                console.warn(`[Webhook] Invalid signature for trigger ${trigger.id}`);
                return NextResponse.json(
                    { success: false, error: "Invalid signature" },
                    { status: 401 }
                );
            }
        }

        // Parse payload
        let payload: Record<string, unknown> = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {
            // If not JSON, use raw body as input
            payload = { raw: rawBody };
        }

        // Apply filter if configured
        if (trigger.filterJson) {
            const filter = trigger.filterJson as Record<string, unknown>;
            // Simple filter: check if all filter keys match payload
            for (const [key, value] of Object.entries(filter)) {
                if (payload[key] !== value) {
                    return NextResponse.json({
                        success: true,
                        message: "Event filtered out",
                        matched: false
                    });
                }
            }
        }

        // Apply input mapping if configured
        let input: string;
        if (trigger.inputMapping) {
            const mapping = trigger.inputMapping as Record<string, string>;
            if (mapping.template) {
                // Simple template replacement
                input = mapping.template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
                    String(payload[key] || "")
                );
            } else if (mapping.field) {
                input = String(payload[mapping.field] || JSON.stringify(payload));
            } else {
                input = JSON.stringify(payload);
            }
        } else {
            input = JSON.stringify(payload);
        }

        // Update trigger stats
        await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 }
            }
        });

        // Queue agent invocation via Inngest
        await inngest.send({
            name: "agent/trigger.fire",
            data: {
                triggerId: trigger.id,
                agentId: trigger.agent.id,
                payload: {
                    ...payload,
                    _trigger: {
                        id: trigger.id,
                        name: trigger.name,
                        type: trigger.triggerType
                    }
                }
            }
        });

        // Also queue immediate invocation
        await inngest.send({
            name: "agent/invoke.async",
            data: {
                runId: "", // Will be created by the handler
                agentId: trigger.agent.id,
                agentSlug: trigger.agent.slug,
                input,
                context: {
                    triggerId: trigger.id,
                    triggerName: trigger.name,
                    triggerType: trigger.triggerType,
                    webhookPayload: payload
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Webhook received",
            trigger: {
                id: trigger.id,
                name: trigger.name
            },
            agent: {
                id: trigger.agent.id,
                slug: trigger.agent.slug
            }
        });
    } catch (error) {
        console.error("[Webhook] Error processing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process webhook"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/webhooks/[path]
 *
 * Health check for webhook endpoint
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string }> }) {
    const { path } = await params;

    const trigger = await prisma.agentTrigger.findUnique({
        where: { webhookPath: path },
        select: {
            id: true,
            name: true,
            isActive: true,
            agent: {
                select: { slug: true, isActive: true }
            }
        }
    });

    if (!trigger) {
        return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        webhook: {
            id: trigger.id,
            name: trigger.name,
            isActive: trigger.isActive,
            agent: trigger.agent.slug,
            agentActive: trigger.agent.isActive
        }
    });
}
