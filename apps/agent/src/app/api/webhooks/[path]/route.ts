import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus } from "@repo/database";
import { createHmac, timingSafeEqual } from "crypto";
import { inngest } from "@/lib/inngest";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptString } from "@/lib/credential-crypto";
import {
    buildTriggerPayloadSnapshot,
    createTriggerEventRecord,
    updateTriggerEventRecord
} from "@/lib/trigger-events";

/**
 * Verify webhook signature
 */
function verifySignature(
    payload: string,
    signature: string | null,
    secret: string,
    timestamp?: string | null
): boolean {
    if (!signature) return false;

    try {
        const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
        const expectedSig = createHmac("sha256", secret).update(signedPayload).digest("hex");

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
 * Webhook ingestion endpoint for triggers targeting agents, workflows, or networks.
 * Validates signature and queues execution via Inngest.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string }> }
) {
    try {
        const { path } = await params;

        const trigger = await prisma.agentTrigger.findUnique({
            where: { webhookPath: path },
            include: {
                agent: {
                    select: { id: true, slug: true, name: true, isActive: true }
                },
                workflow: {
                    select: { id: true, slug: true, name: true, isActive: true }
                },
                network: {
                    select: { id: true, slug: true, name: true, isActive: true }
                }
            }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: "Webhook not found" },
                { status: 404 }
            );
        }

        const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const clientId = forwardedFor || request.headers.get("x-real-ip") || "unknown";
        const rate = await checkRateLimit(`webhook:${path}:${clientId}`, {
            windowMs: 60000,
            max: 60
        });
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429 }
            );
        }

        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");
        const timestampHeader = request.headers.get("x-webhook-timestamp");

        // Parse payload
        let payload: Record<string, unknown> = {};
        try {
            payload = JSON.parse(rawBody);
        } catch {
            payload = { raw: rawBody };
        }

        const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);

        // ── Signature verification (fail-closed — runs BEFORE trigger event creation) ──
        const webhookSecretPlain = trigger.webhookSecret
            ? decryptString(trigger.webhookSecret)
            : null;
        const requireSignatures = process.env.REQUIRE_WEBHOOK_SIGNATURES === "true";
        let signatureVerified = false;

        if (webhookSecretPlain) {
            if (timestampHeader) {
                const parsed = Number(timestampHeader);
                if (Number.isNaN(parsed)) {
                    return NextResponse.json(
                        { success: false, error: "Invalid webhook timestamp" },
                        { status: 400 }
                    );
                }
                const timestampMs = parsed < 1e12 ? parsed * 1000 : parsed;
                const driftMs = Math.abs(Date.now() - timestampMs);
                if (driftMs > 5 * 60 * 1000) {
                    return NextResponse.json(
                        { success: false, error: "Webhook timestamp expired" },
                        { status: 401 }
                    );
                }
            }

            if (!verifySignature(rawBody, signature, webhookSecretPlain, timestampHeader)) {
                console.warn(`[Webhook] Invalid signature for trigger ${trigger.id}`);
                return NextResponse.json(
                    { success: false, error: "Invalid signature" },
                    { status: 401 }
                );
            }
            signatureVerified = true;
        } else if (requireSignatures) {
            console.warn(
                `[Webhook] Rejected: REQUIRE_WEBHOOK_SIGNATURES=true but trigger ${trigger.id} has no secret`
            );
            return NextResponse.json(
                { success: false, error: "Webhook signature required but no secret configured" },
                { status: 403 }
            );
        } else {
            console.warn(
                `[Webhook] Accepting unsigned webhook for trigger ${trigger.id} (no secret configured)`
            );
        }

        // ── Resolve entity type and target ──
        const entityType = trigger.entityType ?? "agent";
        const targetEntity = trigger.agent ?? trigger.workflow ?? trigger.network;

        if (!targetEntity) {
            return NextResponse.json(
                { success: false, error: "Trigger has no target entity configured" },
                { status: 500 }
            );
        }

        // ── Create trigger event AFTER signature verification ──
        let workspaceId = trigger.workspaceId;
        if (!workspaceId) {
            const defaultWorkspace = await prisma.workspace.findFirst({
                where: { isDefault: true },
                select: { id: true }
            });
            workspaceId = defaultWorkspace?.id ?? null;
        }

        const triggerEvent = await createTriggerEventRecord({
            triggerId: trigger.id,
            ...(entityType === "agent" && trigger.agent ? { agentId: trigger.agent.id } : {}),
            ...(entityType === "workflow" && trigger.workflow
                ? { workflowId: trigger.workflow.id }
                : {}),
            ...(entityType === "network" && trigger.network
                ? { networkId: trigger.network.id }
                : {}),
            workspaceId,
            status: TriggerEventStatus.RECEIVED,
            sourceType: "webhook",
            triggerType: trigger.triggerType,
            entityType,
            webhookPath: trigger.webhookPath,
            payload: {
                ...normalizedPayload,
                _signatureVerified: signatureVerified
            }
        });

        if (!trigger.isActive) {
            await updateTriggerEventRecord(triggerEvent.id, {
                status: TriggerEventStatus.SKIPPED,
                errorMessage: "Trigger is disabled"
            });
            return NextResponse.json(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        if (!targetEntity.isActive) {
            await updateTriggerEventRecord(triggerEvent.id, {
                status: TriggerEventStatus.SKIPPED,
                errorMessage: `${entityType} is disabled`
            });
            return NextResponse.json(
                { success: false, error: `${entityType} is disabled` },
                { status: 403 }
            );
        }

        const enrichedPayload = {
            ...normalizedPayload,
            _trigger: {
                id: trigger.id,
                name: trigger.name,
                type: trigger.triggerType
            }
        };

        // ── Dispatch to entity-specific Inngest event ──
        if (entityType === "workflow" && trigger.workflow) {
            await inngest.send({
                name: "workflow/trigger.fire",
                data: {
                    triggerId: trigger.id,
                    workflowId: trigger.workflow.id,
                    workflowSlug: trigger.workflow.slug,
                    triggerEventId: triggerEvent.id,
                    payload: enrichedPayload
                }
            });
        } else if (entityType === "agent" && trigger.agent) {
            await inngest.send({
                name: "agent/trigger.fire",
                data: {
                    triggerId: trigger.id,
                    agentId: trigger.agent.id,
                    triggerEventId: triggerEvent.id,
                    payload: enrichedPayload
                }
            });
        } else {
            await updateTriggerEventRecord(triggerEvent.id, {
                status: TriggerEventStatus.ERROR,
                errorMessage: `Unsupported entity type: ${entityType}`
            });
            return NextResponse.json(
                { success: false, error: `Unsupported entity type: ${entityType}` },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Webhook received",
            trigger: {
                id: trigger.id,
                name: trigger.name
            },
            entityType,
            target: {
                id: targetEntity.id,
                slug: targetEntity.slug
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
            entityType: true,
            agent: {
                select: { slug: true, isActive: true }
            },
            workflow: {
                select: { slug: true, isActive: true }
            },
            network: {
                select: { slug: true, isActive: true }
            }
        }
    });

    if (!trigger) {
        return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 });
    }

    const entityType = trigger.entityType ?? "agent";
    const target = trigger.agent ?? trigger.workflow ?? trigger.network;

    return NextResponse.json({
        success: true,
        webhook: {
            id: trigger.id,
            name: trigger.name,
            isActive: trigger.isActive,
            entityType,
            targetSlug: target?.slug ?? null,
            targetActive: target?.isActive ?? false
        }
    });
}
