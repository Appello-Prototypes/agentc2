/**
 * GitHub Review Webhook Handler
 *
 * Receives `issue_comment` events from GitHub and parses slash commands
 * (/approve, /reject, /feedback) to resolve pending human engagements.
 *
 * Configure this as a GitHub webhook URL on the repository:
 *   URL: https://agentc2.ai/agent/api/webhooks/github-review
 *   Events: Issue comments
 *   Secret: GITHUB_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
    findEngagementByGitHubIssue,
    resolveEngagement,
    type EngagementDecision
} from "@repo/agentc2/workflows";

function verifyGitHubSignature(payload: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    try {
        const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length) return false;
        return timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

interface ParsedCommand {
    decision: EngagementDecision;
    message?: string;
}

function parseSlashCommand(body: string): ParsedCommand | null {
    const trimmed = body.trim();

    if (/^\/approve\b/i.test(trimmed)) {
        const msg = trimmed.replace(/^\/approve\s*/i, "").trim();
        return { decision: "approved", message: msg || undefined };
    }
    if (/^\/reject\b/i.test(trimmed)) {
        const msg = trimmed.replace(/^\/reject\s*/i, "").trim();
        return { decision: "rejected", message: msg || undefined };
    }
    if (/^\/feedback\b/i.test(trimmed)) {
        const msg = trimmed.replace(/^\/feedback\s*/i, "").trim();
        if (!msg) return null;
        return { decision: "feedback", message: msg };
    }

    return null;
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (webhookSecret) {
            const signature = request.headers.get("x-hub-signature-256");
            if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const event = request.headers.get("x-github-event");

        if (event === "ping") {
            return NextResponse.json({ ok: true, message: "pong" });
        }

        if (event !== "issue_comment") {
            return NextResponse.json({ ok: true, message: "Event ignored", event });
        }

        const payload = JSON.parse(rawBody) as {
            action: string;
            issue: { number: number };
            comment: { body: string; user: { login: string } };
            repository: { full_name: string };
        };

        if (payload.action !== "created") {
            return NextResponse.json({
                ok: true,
                message: "Only new comments are processed"
            });
        }

        const command = parseSlashCommand(payload.comment.body);
        if (!command) {
            return NextResponse.json({
                ok: true,
                message: "No slash command found"
            });
        }

        const repo = payload.repository.full_name;
        const issueNumber = payload.issue.number;

        const approvalId = await findEngagementByGitHubIssue(repo, issueNumber);
        if (!approvalId) {
            return NextResponse.json({
                ok: true,
                message: "No pending engagement for this issue"
            });
        }

        const result = await resolveEngagement({
            approvalRequestId: approvalId,
            decision: command.decision,
            message: command.message,
            decidedBy: payload.comment.user.login,
            channel: "github"
        });

        if (!result.resumed) {
            console.warn(`[GitHub Review] Could not resume: ${result.error}`);
            return NextResponse.json({
                ok: false,
                error: result.error
            });
        }

        console.log(
            `[GitHub Review] ${command.decision} by ${payload.comment.user.login} ` +
                `on ${repo}#${issueNumber}`
        );

        return NextResponse.json({
            ok: true,
            decision: command.decision,
            resumed: true
        });
    } catch (error) {
        console.error("[GitHub Review] Webhook error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal error"
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        ok: true,
        endpoint: "github-review",
        description:
            "GitHub issue comment webhook for AgentC2 human review. " +
            "Listens for /approve, /reject, /feedback slash commands."
    });
}
