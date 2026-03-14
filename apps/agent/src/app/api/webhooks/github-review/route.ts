/**
 * GitHub Review Webhook Handler
 *
 * Handles two GitHub event types:
 *
 * 1. `issue_comment` — Slash commands (/approve, /reject, /feedback) on issues
 *    resolve pending human engagements for any matching workflow gate.
 *
 * 2. `pull_request` (closed + merged) — Auto-approves pending `merge-review`
 *    engagements whose issue number is referenced in the PR body or title.
 *    This is scoped to the exact workflow run (via `sourceId = "merge-review"`)
 *    so triage gates and other workflow types are never affected.
 *
 * Configure this as a GitHub webhook URL on the repository:
 *   URL: https://agentc2.ai/agent/api/webhooks/github-review
 *   Events: Issue comments, Pull requests
 *   Secret: GITHUB_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
    findEngagementByGitHubIssue,
    findMergeReviewEngagements,
    resolveEngagement,
    type EngagementDecision
} from "@repo/agentc2/workflows";

/* ─── Signature verification ─────────────────────────────────────────────── */

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

/* ─── Slash command parsing (for issue_comment events) ───────────────────── */

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

/* ─── Issue number extraction (for pull_request events) ──────────────────── */

/**
 * Extract referenced issue numbers from a PR body and title.
 *
 * Matches GitHub close-keywords (Fixes, Closes, Resolves) and bare `#N`
 * references. Deduplicates results.
 */
function extractIssueNumbers(prBody: string | null, prTitle: string | null): number[] {
    const numbers = new Set<number>();
    const text = [prBody ?? "", prTitle ?? ""].join("\n");

    const closeKeywordPattern = /(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = closeKeywordPattern.exec(text)) !== null) {
        numbers.add(Number(match[1]));
    }

    const hashPattern = /#(\d+)/g;
    while ((match = hashPattern.exec(text)) !== null) {
        numbers.add(Number(match[1]));
    }

    return [...numbers].filter((n) => n > 0);
}

/* ─── Event handlers ─────────────────────────────────────────────────────── */

interface PullRequestPayload {
    action: string;
    pull_request: {
        number: number;
        merged: boolean;
        title: string;
        body: string | null;
        head: { ref: string };
        user: { login: string };
        merged_by?: { login: string } | null;
    };
    repository: { full_name: string };
}

interface IssueCommentPayload {
    action: string;
    issue: { number: number };
    comment: { body: string; user: { login: string } };
    repository: { full_name: string };
}

async function handlePullRequestMerged(payload: PullRequestPayload): Promise<NextResponse> {
    const pr = payload.pull_request;
    const repo = payload.repository.full_name;
    const mergedBy = pr.merged_by?.login ?? pr.user.login;

    const issueNumbers = extractIssueNumbers(pr.body, pr.title);
    if (issueNumbers.length === 0) {
        console.log(
            `[GitHub Review] PR #${pr.number} merged on ${repo} but no issue references found`
        );
        return NextResponse.json({
            ok: true,
            message: "PR merged but no issue references found",
            pr: pr.number
        });
    }

    const engagements = await findMergeReviewEngagements(repo, issueNumbers);
    if (engagements.length === 0) {
        return NextResponse.json({
            ok: true,
            message: "No pending merge-review engagements for referenced issues",
            pr: pr.number,
            issueNumbers
        });
    }

    const results: Array<{
        approvalId: string;
        issueNumber: number;
        workflowSlug: string | null;
        success: boolean;
        error?: string;
    }> = [];

    for (const eng of engagements) {
        const result = await resolveEngagement({
            approvalRequestId: eng.id,
            decision: "approved",
            message: `Auto-approved: PR #${pr.number} merged by ${mergedBy}`,
            decidedBy: mergedBy,
            channel: "github-pr-merge"
        });

        results.push({
            approvalId: eng.id,
            issueNumber: eng.issueNumber,
            workflowSlug: eng.workflowSlug,
            success: result.resumed,
            error: result.error
        });

        if (result.resumed) {
            console.log(
                `[GitHub Review] PR #${pr.number} merge auto-approved ` +
                    `merge-review for issue #${eng.issueNumber} ` +
                    `(workflow: ${eng.workflowSlug}, run: ${eng.workflowRunId})`
            );
        } else {
            console.warn(
                `[GitHub Review] PR #${pr.number} merge: approval record updated ` +
                    `for issue #${eng.issueNumber} but workflow resume failed: ${result.error}`
            );
        }
    }

    return NextResponse.json({
        ok: true,
        event: "pr-merge-reconciliation",
        pr: pr.number,
        mergedBy,
        results
    });
}

async function handleIssueComment(payload: IssueCommentPayload): Promise<NextResponse> {
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
}

/* ─── Route handler ──────────────────────────────────────────────────────── */

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

        const payload = JSON.parse(rawBody);

        if (event === "pull_request") {
            const prPayload = payload as PullRequestPayload;
            if (prPayload.action === "closed" && prPayload.pull_request.merged) {
                return handlePullRequestMerged(prPayload);
            }
            return NextResponse.json({
                ok: true,
                message: "PR event ignored (not a merge)",
                action: prPayload.action
            });
        }

        if (event === "issue_comment") {
            return handleIssueComment(payload as IssueCommentPayload);
        }

        return NextResponse.json({ ok: true, message: "Event ignored", event });
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
            "GitHub webhook for AgentC2 human review. " +
            "Handles issue_comment (slash commands) and pull_request (merge auto-reconciliation).",
        events: ["issue_comment", "pull_request"],
        slashCommands: ["/approve", "/reject", "/feedback [message]"],
        prMerge:
            "When a PR is merged, pending merge-review gates are auto-approved " +
            "for any issue referenced in the PR body or title (scoped to exact workflow run)."
    });
}
