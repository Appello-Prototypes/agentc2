/**
 * Slack Interactions Handler
 *
 * Receives interactive message payloads from Slack (button clicks, modal submissions).
 * Processes human review actions (approve, reject, feedback) for workflow engagements.
 *
 * Slack sends interaction payloads as form-urlencoded with a `payload` field.
 * Configure in Slack App Settings > Interactivity & Shortcuts:
 *   Request URL: https://agentc2.ai/agent/api/slack/interactions
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
    findEngagementBySlackMessage,
    resolveEngagement,
    type EngagementDecision
} from "@repo/agentc2/workflows";

function verifySlackSignature(
    body: string,
    timestamp: string | null,
    signature: string | null
): boolean {
    const secret = process.env.SLACK_SIGNING_SECRET;
    if (!secret || !timestamp || !signature) return false;

    const fiveMinutes = 5 * 60;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > fiveMinutes) return false;

    try {
        const baseString = `v0:${timestamp}:${body}`;
        const expected = "v0=" + createHmac("sha256", secret).update(baseString).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length) return false;
        return timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

interface SlackInteractionPayload {
    type: string;
    user: { id: string; username: string; name: string };
    channel: { id: string };
    message: { ts: string };
    actions?: Array<{
        action_id: string;
        value: string;
    }>;
    trigger_id?: string;
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        const timestamp = request.headers.get("x-slack-request-timestamp");
        const signature = request.headers.get("x-slack-signature");

        if (process.env.SLACK_SIGNING_SECRET) {
            if (!verifySlackSignature(rawBody, timestamp, signature)) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const formData = new URLSearchParams(rawBody);
        const payloadStr = formData.get("payload");
        if (!payloadStr) {
            return NextResponse.json({ error: "Missing payload" }, { status: 400 });
        }

        const payload = JSON.parse(payloadStr) as SlackInteractionPayload;

        if (payload.type !== "block_actions") {
            return NextResponse.json({ ok: true, message: "Ignored interaction type" });
        }

        const action = payload.actions?.[0];
        if (!action) {
            return NextResponse.json({ ok: true, message: "No action" });
        }

        const actionMap: Record<string, EngagementDecision> = {
            engagement_approve: "approved",
            engagement_reject: "rejected",
            engagement_feedback: "feedback"
        };

        const decision = actionMap[action.action_id];
        if (!decision) {
            return NextResponse.json({ ok: true, message: "Unknown action" });
        }

        const channelId = payload.channel.id;
        const messageTs = payload.message.ts;

        const approvalId = await findEngagementBySlackMessage(channelId, messageTs);
        if (!approvalId) {
            return NextResponse.json({ ok: true, message: "No pending engagement" });
        }

        if (decision === "feedback" && payload.trigger_id) {
            await openFeedbackModal(payload.trigger_id, approvalId);
            return NextResponse.json({ ok: true });
        }

        const result = await resolveEngagement({
            approvalRequestId: approvalId,
            decision,
            decidedBy: payload.user.username || payload.user.id,
            channel: "slack"
        });

        if (!result.resumed) {
            console.warn(`[Slack Interactions] Could not resume: ${result.error}`);
        } else {
            console.log(`[Slack Interactions] ${decision} by ${payload.user.username}`);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[Slack Interactions] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

async function openFeedbackModal(triggerId: string, approvalId: string) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return;

    await fetch("https://slack.com/api/views.open", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            trigger_id: triggerId,
            view: {
                type: "modal",
                callback_id: `engagement_feedback_${approvalId}`,
                title: { type: "plain_text", text: "Provide Feedback" },
                submit: { type: "plain_text", text: "Submit" },
                close: { type: "plain_text", text: "Cancel" },
                blocks: [
                    {
                        type: "input",
                        block_id: "feedback_block",
                        element: {
                            type: "plain_text_input",
                            action_id: "feedback_text",
                            multiline: true,
                            placeholder: {
                                type: "plain_text",
                                text: "Describe what changes or additional analysis you want..."
                            }
                        },
                        label: { type: "plain_text", text: "Your Feedback" }
                    }
                ]
            }
        })
    });
}
