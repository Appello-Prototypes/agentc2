import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma, TriggerEventStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { createTriggerEventRecord } from "@/lib/trigger-events";

const verifyPubSubRequest = async (request: NextRequest) => {
    const verificationToken = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get("token");
    const headerToken = request.headers.get("x-pubsub-token");

    if (verificationToken) {
        if (verificationToken !== tokenParam && verificationToken !== headerToken) {
            throw new Error("Invalid Pub/Sub verification token");
        }
        return;
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        throw new Error("Missing Pub/Sub authorization");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const client = new OAuth2Client();
    await client.verifyIdToken({
        idToken: jwt,
        audience: request.url
    });
};

/**
 * POST /api/gmail/webhook
 *
 * Thin Pub/Sub push receiver for Gmail watch notifications.
 *
 * This handler does the minimum work to acknowledge the notification:
 *   1. Verify the Pub/Sub request
 *   2. Decode the payload (emailAddress + historyId)
 *   3. Look up the integration and trigger
 *   4. Advance the stored historyId
 *   5. Dispatch a "gmail/message.process" Inngest event
 *   6. Return 200 immediately
 *
 * All Gmail API calls (listHistory, getMessage), enrichment, DB writes,
 * and agent trigger firing are handled asynchronously by the Inngest
 * worker function. This prevents Pub/Sub retry storms when Gmail API
 * quota is exceeded during burst traffic.
 */
export async function POST(request: NextRequest) {
    try {
        await verifyPubSubRequest(request);

        const body = await request.json();
        const messageData = body?.message?.data;

        if (!messageData) {
            return NextResponse.json(
                { success: false, error: "Missing Pub/Sub message" },
                { status: 400 }
            );
        }

        const decoded = JSON.parse(Buffer.from(messageData, "base64").toString("utf8"));
        const gmailAddress = decoded.emailAddress as string | undefined;
        const newHistoryId = decoded.historyId != null ? String(decoded.historyId) : undefined;

        if (!gmailAddress || !newHistoryId) {
            return NextResponse.json(
                { success: false, error: "Invalid Gmail notification payload" },
                { status: 400 }
            );
        }

        // ── Look up integration ────────────────────────────────────────
        const integration = await prisma.gmailIntegration.findFirst({
            where: { gmailAddress, isActive: true },
            include: {
                workspace: {
                    select: { organizationId: true }
                },
                agent: {
                    select: { id: true, slug: true, isActive: true }
                }
            }
        });

        const organizationId = integration?.workspace?.organizationId;
        if (!integration || !organizationId) {
            // Acknowledge but do nothing — no integration configured
            return NextResponse.json({ success: true, queued: false });
        }

        if (!integration.agent.isActive) {
            await createTriggerEventRecord({
                agentId: integration.agentId,
                workspaceId: integration.workspaceId,
                status: TriggerEventStatus.SKIPPED,
                sourceType: "integration",
                triggerType: "event",
                entityType: "agent",
                integrationKey: "gmail",
                integrationId: integration.id,
                eventName: "gmail.message.received",
                payload: { gmailAddress, historyId: newHistoryId },
                errorMessage: "Agent is disabled"
            });
            return NextResponse.json({ success: true, queued: false });
        }

        // ── Check trigger exists ───────────────────────────────────────
        const trigger = await prisma.agentTrigger.findFirst({
            where: {
                agentId: integration.agentId,
                triggerType: "event",
                eventName: "gmail.message.received",
                isActive: true
            }
        });

        if (!trigger) {
            await createTriggerEventRecord({
                agentId: integration.agentId,
                workspaceId: integration.workspaceId,
                status: TriggerEventStatus.SKIPPED,
                sourceType: "integration",
                triggerType: "event",
                entityType: "agent",
                integrationKey: "gmail",
                integrationId: integration.id,
                eventName: "gmail.message.received",
                payload: { gmailAddress, historyId: newHistoryId },
                errorMessage: "Gmail trigger not configured"
            });
            // Still return 200 to acknowledge — don't make Pub/Sub retry
            return NextResponse.json({ success: true, queued: false });
        }

        // ── Advance historyId and dispatch to Inngest ──────────────────
        const previousHistoryId = integration.historyId;

        // Always advance the stored historyId so subsequent notifications
        // don't re-fetch the same range, even if Inngest processing fails.
        await prisma.gmailIntegration.update({
            where: { id: integration.id },
            data: { historyId: newHistoryId }
        });

        // If there was no previous historyId, this is the initial baseline.
        // Store the historyId but don't process — there's no range to query.
        if (!previousHistoryId) {
            console.log(
                `[Gmail Webhook] Baseline historyId set to ${newHistoryId} for ${gmailAddress}`
            );
            return NextResponse.json({ success: true, queued: false, baseline: true });
        }

        // Dispatch async processing via Inngest
        await inngest.send({
            name: "gmail/message.process",
            data: {
                integrationId: integration.id,
                gmailAddress,
                organizationId,
                triggerId: trigger.id,
                agentId: integration.agentId,
                workspaceId: integration.workspaceId,
                slackUserId: integration.slackUserId || null,
                previousHistoryId,
                newHistoryId
            }
        });

        console.log(
            `[Gmail Webhook] Queued processing for ${gmailAddress}: ` +
                `history ${previousHistoryId} → ${newHistoryId}`
        );

        return NextResponse.json({ success: true, queued: true });
    } catch (error) {
        console.error("[Gmail Webhook] Error:", error);

        // Always return 200 for known transient errors so Pub/Sub stops retrying.
        // The Inngest worker handles retries with proper backoff.
        const message = error instanceof Error ? error.message : "Unknown error";
        const isTransient =
            message.includes("Quota exceeded") ||
            message.includes("Rate Limit Exceeded") ||
            message.includes("UNAVAILABLE") ||
            message.includes("DEADLINE_EXCEEDED");

        if (isTransient) {
            console.warn("[Gmail Webhook] Transient error — acknowledging to prevent retry storm");
            return NextResponse.json({ success: false, error: message, acknowledged: true });
        }

        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
