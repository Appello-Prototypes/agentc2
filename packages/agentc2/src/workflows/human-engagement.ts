/**
 * Human Engagement Manager
 *
 * Transport-agnostic system for human-in-the-loop workflow reviews.
 * When a workflow suspends at a "human" step, this creates an engagement
 * record and dispatches notifications to configured channels (GitHub, Slack, etc.).
 * Responses from any channel are normalized and used to resume the workflow.
 */

import type { Prisma } from "@repo/database";
import {
    resolveGitHubToken,
    parseRepoOwnerName,
    githubFetch,
    buildSignatureFooter
} from "../tools/github-helpers";

const PLATFORM_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type EngagementDecision = "approved" | "rejected" | "feedback" | "conditional";

export interface EngagementContext {
    summary?: string;
    issueUrl?: string;
    issueNumber?: number;
    repository?: string;
    analysisUrl?: string;
    prUrl?: string;
    prNumber?: number;
    riskLevel?: string;
    filesChanged?: string[];
    prompt?: string;
    stepsCompleted?: number;
    stepNames?: string[];
}

export interface CreateEngagementOptions {
    organizationId: string;
    workspaceId?: string | null;
    workflowRunId: string;
    workflowSlug: string;
    suspendedStep: string;
    suspendData?: Record<string, unknown>;
    stepOutputs: Array<{
        stepId: string;
        stepType: string;
        output?: unknown;
    }>;
    channels?: string[];
}

export interface ConditionalMeta {
    conditionType: "ci-checks";
    repository?: string;
    ref?: string;
}

export interface ResolveEngagementOptions {
    approvalRequestId: string;
    decision: EngagementDecision;
    message?: string;
    decidedBy?: string;
    channel: string;
    conditionMeta?: ConditionalMeta;
}

/* ─── Context extraction ──────────────────────────────────────────────────── */

/**
 * Extract review context from completed workflow step outputs.
 * Looks for known step IDs from SDLC workflows (intake, post-analysis, etc.)
 * and pulls out GitHub issue URLs, analysis summaries, and other context.
 */
export function getEngagementContext(
    stepOutputs: Array<{ stepId: string; stepType: string; output?: unknown }>,
    suspendData?: Record<string, unknown>
): EngagementContext {
    const ctx: EngagementContext = {};

    if (suspendData?.prompt) {
        ctx.prompt = String(suspendData.prompt);
    }

    ctx.stepsCompleted = stepOutputs.length;
    ctx.stepNames = stepOutputs.map((s) => s.stepId);

    for (const step of stepOutputs) {
        const out = step.output as Record<string, unknown> | undefined;
        if (!out || typeof out !== "object") continue;

        if (step.stepId === "intake" || step.stepId === "ingest-ticket") {
            if (out.issueUrl) ctx.issueUrl = String(out.issueUrl);
            if (out.issueNumber) ctx.issueNumber = Number(out.issueNumber);
            if (out.repository) ctx.repository = String(out.repository);
        }

        if (step.stepId === "post-analysis") {
            if (out.commentUrl) ctx.analysisUrl = String(out.commentUrl);
        }

        if (step.stepId === "analyze-wait" || step.stepId === "analyze-result") {
            if (out.summary && !ctx.summary) {
                const full = String(out.summary);
                ctx.summary = full.length > 1000 ? full.slice(0, 1000) + "…" : full;
            }
        }

        if (step.stepId === "classify-risk") {
            if (out.riskLevel) ctx.riskLevel = String(out.riskLevel);
            if (out.filesChanged && Array.isArray(out.filesChanged)) {
                ctx.filesChanged = (out.filesChanged as string[]).slice(0, 50);
            }
        }

        if (
            step.stepId === "analyze-codebase" ||
            step.stepId === "analyze" ||
            step.stepId === "analyze-wait"
        ) {
            if (out.riskLevel && !ctx.riskLevel) ctx.riskLevel = String(out.riskLevel);
            if (out.filesChanged && Array.isArray(out.filesChanged) && !ctx.filesChanged) {
                ctx.filesChanged = (out.filesChanged as string[]).slice(0, 50);
            }
            if (out.summary && !ctx.summary) {
                const full = String(out.summary);
                ctx.summary = full.length > 1000 ? full.slice(0, 1000) + "…" : full;
            }
        }

        if (step.stepId === "fix-audit") {
            const text = (out.text || out.response) as string | undefined;
            if (text) {
                ctx.summary = text.length > 1000 ? text.slice(0, 1000) + "…" : text;
            }
            if (out.riskLevel && !ctx.riskLevel) ctx.riskLevel = String(out.riskLevel);
            if (out.filesChanged && Array.isArray(out.filesChanged) && !ctx.filesChanged) {
                ctx.filesChanged = (out.filesChanged as string[]).slice(0, 50);
            }
        }

        if (step.stepId === "create-pr") {
            if (out.htmlUrl) ctx.prUrl = String(out.htmlUrl);
            if (out.prNumber) ctx.prNumber = Number(out.prNumber);
        }

        if (step.stepId === "poll-cursor") {
            if (out.prNumber && !ctx.prNumber) ctx.prNumber = Number(out.prNumber);
            if (out.repository && !ctx.repository) ctx.repository = String(out.repository);
            if (out.branchName && !ctx.prUrl) {
                ctx.prUrl = out.repository
                    ? `${String(out.repository).replace(/\.git$/, "")}/tree/${String(out.branchName)}`
                    : undefined;
            }
        }

        if (step.stepId === "implement-wait") {
            if (out.summary && !ctx.summary) {
                const full = String(out.summary);
                ctx.summary = full.length > 1000 ? full.slice(0, 1000) + "…" : full;
            }
        }
    }

    return ctx;
}

/* ─── GitHub transport ────────────────────────────────────────────────────── */

function buildReviewComment(
    workflowSlug: string,
    runId: string,
    stepId: string,
    context: EngagementContext
): string {
    const lines: string[] = [];

    lines.push("## 🔍 Review Required\n");

    const shortRunId = runId.length > 12 ? runId.slice(0, 12) + "…" : runId;
    const runUrl = `${PLATFORM_URL}/workflows/${workflowSlug}/runs/${runId}`;
    lines.push(`**Workflow:** \`${workflowSlug}\` | **Run:** [\`${shortRunId}\`](${runUrl})\n`);

    if (context.prompt) {
        lines.push(`> ${context.prompt}\n`);
    }

    if (context.summary) {
        lines.push("### Summary\n");
        lines.push(context.summary + "\n");
    }

    if (context.analysisUrl) {
        lines.push(`**Full analysis:** ${context.analysisUrl}\n`);
    }

    if (context.prUrl) {
        lines.push(`**Pull Request:** ${context.prUrl}\n`);
    }

    lines.push("### Actions\n");
    lines.push("| Command | Description |");
    lines.push("|---------|-------------|");
    lines.push("| `/approve` | Proceed to implementation |");
    lines.push("| `/reject` | Cancel this workflow run |");
    lines.push("| `/feedback <your comments>` | Provide feedback and re-analyze |");
    lines.push("");

    const footer = buildSignatureFooter({ workflowSlug, runId, stepId });
    lines.push(footer.trim());

    return lines.join("\n");
}

async function notifyGitHub(
    context: EngagementContext,
    workflowSlug: string,
    runId: string,
    stepId: string,
    organizationId: string
): Promise<{ commentId: bigint; commentUrl: string } | null> {
    if (!context.issueNumber || !context.repository) return null;

    try {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(context.repository);
        const body = buildReviewComment(workflowSlug, runId, stepId, context);

        const response = await githubFetch(
            `/repos/${owner}/${repo}/issues/${context.issueNumber}/comments`,
            token,
            { method: "POST", body: JSON.stringify({ body }) }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error("[HumanEngagement] GitHub comment failed:", err);
            return null;
        }

        const data = (await response.json()) as { id: number; html_url: string };
        return { commentId: BigInt(data.id), commentUrl: data.html_url };
    } catch (err) {
        console.error("[HumanEngagement] GitHub notification error:", err);
        return null;
    }
}

async function acknowledgeGitHub(
    repository: string,
    issueNumber: number,
    decision: EngagementDecision,
    message: string | undefined,
    decidedBy: string | undefined,
    organizationId: string
): Promise<void> {
    try {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        const emoji = decision === "approved" ? "✅" : decision === "rejected" ? "❌" : "💬";
        const label =
            decision === "approved"
                ? "Approved"
                : decision === "rejected"
                  ? "Rejected"
                  : "Feedback provided";

        const parts = [`${emoji} **${label}**`];
        if (decidedBy) parts.push(`by \`${decidedBy}\``);
        if (message) parts.push(`\n\n${message}`);
        parts.push(`\n\n---\n_Automated by [AgentC2](${PLATFORM_URL})_`);

        await githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token, {
            method: "POST",
            body: JSON.stringify({ body: parts.join(" ") })
        });
    } catch (err) {
        console.error("[HumanEngagement] GitHub acknowledge error:", err);
    }
}

/* ─── Slack transport ─────────────────────────────────────────────────────── */

async function notifySlack(
    context: EngagementContext,
    workflowSlug: string,
    runId: string,
    organizationId: string,
    _config?: { channel?: string; users?: string[] }
): Promise<{ channelId: string; messageTs: string } | null> {
    try {
        const { prisma } = await import("@repo/database");
        const { decryptJson } = await import("../crypto/encryption");

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                isActive: true,
                provider: { key: "slack" }
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
        });

        if (!connection?.credentials) {
            const envToken = process.env.SLACK_BOT_TOKEN;
            if (!envToken) return null;
            const envChannel = process.env.SLACK_ALERTS_CHANNEL;
            if (!envChannel) return null;
            return await postSlackReviewMessage(
                envToken,
                _config?.channel || envChannel,
                context,
                workflowSlug,
                runId
            );
        }

        const decrypted = decryptJson(connection.credentials);
        const botToken =
            (decrypted?.bot_token as string) ||
            (decrypted?.SLACK_BOT_TOKEN as string) ||
            (decrypted?.token as string);

        if (!botToken) return null;

        const meta =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};
        const defaultChannel =
            _config?.channel ||
            (meta.alertsChannelId as string) ||
            (meta.defaultChannelId as string);

        if (!defaultChannel) return null;

        return await postSlackReviewMessage(botToken, defaultChannel, context, workflowSlug, runId);
    } catch (err) {
        console.error("[HumanEngagement] Slack notification error:", err);
        return null;
    }
}

async function postSlackReviewMessage(
    botToken: string,
    channel: string,
    context: EngagementContext,
    workflowSlug: string,
    runId: string
): Promise<{ channelId: string; messageTs: string } | null> {
    const shortRunId = runId.length > 12 ? runId.slice(0, 12) + "…" : runId;
    const runUrl = `${PLATFORM_URL}/workflows/${workflowSlug}/runs/${runId}`;

    const blocks: Record<string, unknown>[] = [
        {
            type: "header",
            text: { type: "plain_text", text: "🔍 Review Required", emoji: true }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Workflow:* \`${workflowSlug}\` | *Run:* <${runUrl}|\`${shortRunId}\`>`
            }
        }
    ];

    if (context.summary) {
        const truncated =
            context.summary.length > 500 ? context.summary.slice(0, 500) + "…" : context.summary;
        blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: truncated }
        });
    }

    if (context.issueUrl || context.prUrl) {
        const links: string[] = [];
        if (context.issueUrl) links.push(`📋 <${context.issueUrl}|View GitHub Issue>`);
        if (context.analysisUrl) links.push(`🔎 <${context.analysisUrl}|View Analysis>`);
        if (context.prUrl) links.push(`🔀 <${context.prUrl}|View Pull Request>`);
        blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: links.join(" | ") }
        });
    }

    blocks.push({
        type: "actions",
        block_id: "review_actions",
        elements: [
            {
                type: "button",
                text: { type: "plain_text", text: "✅ Approve", emoji: true },
                style: "primary",
                action_id: "engagement_approve",
                value: "approve"
            },
            {
                type: "button",
                text: { type: "plain_text", text: "❌ Reject", emoji: true },
                style: "danger",
                action_id: "engagement_reject",
                value: "reject"
            },
            {
                type: "button",
                text: { type: "plain_text", text: "💬 Feedback", emoji: true },
                action_id: "engagement_feedback",
                value: "feedback"
            }
        ]
    });

    const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${botToken}`
        },
        body: JSON.stringify({
            channel,
            text: `🔍 Review required for workflow \`${workflowSlug}\``,
            blocks
        })
    });

    const data = (await response.json()) as { ok: boolean; ts?: string; channel?: string };
    if (!data.ok) return null;

    return {
        channelId: data.channel || channel,
        messageTs: data.ts || ""
    };
}

/* ─── Telegram transport ──────────────────────────────────────────────────── */

function buildTelegramReviewText(
    workflowSlug: string,
    runId: string,
    context: EngagementContext
): string {
    const shortRunId = runId.length > 12 ? runId.slice(0, 12) + "…" : runId;
    const runUrl = `${PLATFORM_URL}/workflows/${workflowSlug}/runs/${runId}`;

    const lines: string[] = [];
    lines.push("🔍 *Review Required*\n");
    lines.push(`*Workflow:* \`${workflowSlug}\` | *Run:* [${shortRunId}](${runUrl})\n`);

    if (context.prompt) {
        lines.push(`> ${context.prompt}\n`);
    }

    if (context.summary) {
        const truncated =
            context.summary.length > 500 ? context.summary.slice(0, 500) + "…" : context.summary;
        lines.push(truncated + "\n");
    }

    const links: string[] = [];
    if (context.issueUrl) links.push(`[GitHub Issue](${context.issueUrl})`);
    if (context.analysisUrl) links.push(`[Analysis](${context.analysisUrl})`);
    if (context.prUrl) links.push(`[Pull Request](${context.prUrl})`);
    if (links.length > 0) lines.push(links.join(" | "));

    return lines.join("\n");
}

async function notifyTelegram(
    context: EngagementContext,
    workflowSlug: string,
    runId: string,
    approvalId: string,
    organizationId: string
): Promise<{ chatId: string; messageId: number } | null> {
    try {
        const { prisma } = await import("@repo/database");
        const { decryptJson } = await import("../crypto/encryption");

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                isActive: true,
                provider: { key: "telegram-bot" }
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
        });

        if (!connection?.credentials) return null;

        const decrypted = decryptJson(connection.credentials);
        const botToken =
            (decrypted?.TELEGRAM_BOT_TOKEN as string) || (decrypted?.bot_token as string);
        if (!botToken) return null;

        const meta =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};
        const alertsChatId = (meta.alertsChatId as string) || (meta.defaultChatId as string);
        if (!alertsChatId) return null;

        const text = buildTelegramReviewText(workflowSlug, runId, context);

        const inlineKeyboard = [
            [
                { text: "✅ Approve", callback_data: `engagement_approve:${approvalId}` },
                { text: "❌ Reject", callback_data: `engagement_reject:${approvalId}` }
            ],
            [{ text: "💬 Feedback", callback_data: `engagement_feedback:${approvalId}` }]
        ];

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: alertsChatId,
                text,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: inlineKeyboard }
            })
        });

        const data = (await response.json()) as {
            ok: boolean;
            result?: { message_id: number; chat: { id: number } };
        };
        if (!data.ok || !data.result) return null;

        return {
            chatId: String(data.result.chat.id),
            messageId: data.result.message_id
        };
    } catch (err) {
        console.error("[HumanEngagement] Telegram notification error:", err);
        return null;
    }
}

/* ─── WhatsApp transport ──────────────────────────────────────────────────── */

function buildWhatsAppReviewText(
    workflowSlug: string,
    runId: string,
    approvalId: string,
    context: EngagementContext
): string {
    const shortRunId = runId.length > 12 ? runId.slice(0, 12) + "…" : runId;
    const runUrl = `${PLATFORM_URL}/workflows/${workflowSlug}/runs/${runId}`;

    const lines: string[] = [];
    lines.push("🔍 *Review Required*\n");
    lines.push(`*Workflow:* ${workflowSlug} | *Run:* ${shortRunId}`);
    lines.push(runUrl + "\n");

    if (context.prompt) {
        lines.push(`> ${context.prompt}\n`);
    }

    if (context.summary) {
        const truncated =
            context.summary.length > 500 ? context.summary.slice(0, 500) + "…" : context.summary;
        lines.push(truncated + "\n");
    }

    if (context.issueUrl) lines.push(`📋 Issue: ${context.issueUrl}`);
    if (context.prUrl) lines.push(`🔀 PR: ${context.prUrl}`);

    lines.push("\n*Reply with one of:*");
    lines.push(`/approve ${approvalId}`);
    lines.push(`/reject ${approvalId}`);
    lines.push(`/feedback ${approvalId} <your comments>`);

    return lines.join("\n");
}

async function notifyWhatsApp(
    context: EngagementContext,
    workflowSlug: string,
    runId: string,
    approvalId: string,
    organizationId: string
): Promise<{ jid: string } | null> {
    try {
        const { prisma } = await import("@repo/database");
        const { decryptJson } = await import("../crypto/encryption");

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                isActive: true,
                provider: { key: "whatsapp-web" }
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
        });

        if (!connection) return null;

        const meta =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};
        const status = meta.status as string | undefined;
        if (status !== "connected") return null;

        const alertsJid = (meta.alertsJid as string) || (meta.defaultJid as string);
        if (!alertsJid) return null;

        let botToken: string | undefined;
        if (connection.credentials) {
            const decrypted = decryptJson(connection.credentials);
            botToken = decrypted?.WHATSAPP_ENABLED as string | undefined;
        }
        if (!botToken && !connection.isActive) return null;

        const text = buildWhatsAppReviewText(workflowSlug, runId, approvalId, context);

        const agentBaseUrl = process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/agent`
            : "http://localhost:3001";

        const res = await fetch(`${agentBaseUrl}/api/channels/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: alertsJid, text })
        });

        if (!res.ok) return null;

        return { jid: alertsJid };
    } catch (err) {
        console.error("[HumanEngagement] WhatsApp notification error:", err);
        return null;
    }
}

/* ─── Core engagement manager ─────────────────────────────────────────────── */

export async function createEngagement(options: CreateEngagementOptions): Promise<string | null> {
    const { prisma } = await import("@repo/database");

    const context = getEngagementContext(options.stepOutputs, options.suspendData);
    const channels = options.channels || ["github", "slack", "telegram", "whatsapp"];
    const notifiedChannels: string[] = [];

    const approval = await prisma.approvalRequest.create({
        data: {
            organizationId: options.organizationId,
            workspaceId: options.workspaceId!,
            workflowRunId: options.workflowRunId,
            sourceType: "workflow-review",
            sourceId: options.suspendedStep,
            reviewContext: context as unknown as Prisma.InputJsonValue,
            githubRepo: context.repository ?? null,
            githubIssueNumber: context.issueNumber ?? null,
            notifiedChannels: [],
            payloadJson: options.suspendData
                ? (options.suspendData as Prisma.InputJsonValue)
                : undefined
        }
    });

    if (channels.includes("github")) {
        const ghResult = await notifyGitHub(
            context,
            options.workflowSlug,
            options.workflowRunId,
            options.suspendedStep,
            options.organizationId
        );
        if (ghResult) {
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: { githubCommentId: ghResult.commentId }
            });
            notifiedChannels.push("github");
            console.log(`[HumanEngagement] GitHub review comment posted: ${ghResult.commentUrl}`);
        }
    }

    if (channels.includes("slack")) {
        const slackResult = await notifySlack(
            context,
            options.workflowSlug,
            options.workflowRunId,
            options.organizationId
        );
        if (slackResult) {
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: {
                    slackChannelId: slackResult.channelId,
                    slackMessageTs: slackResult.messageTs
                }
            });
            notifiedChannels.push("slack");
            console.log("[HumanEngagement] Slack review message sent");
        }
    }

    if (channels.includes("telegram")) {
        const tgResult = await notifyTelegram(
            context,
            options.workflowSlug,
            options.workflowRunId,
            approval.id,
            options.organizationId
        );
        if (tgResult) {
            const existingMeta = (approval.metadata as Record<string, unknown>) || {};
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: {
                    metadata: {
                        ...existingMeta,
                        telegramChatId: tgResult.chatId,
                        telegramMessageId: tgResult.messageId
                    } as unknown as Prisma.InputJsonValue
                }
            });
            notifiedChannels.push("telegram");
            console.log("[HumanEngagement] Telegram review message sent");
        }
    }

    if (channels.includes("whatsapp")) {
        const waResult = await notifyWhatsApp(
            context,
            options.workflowSlug,
            options.workflowRunId,
            approval.id,
            options.organizationId
        );
        if (waResult) {
            const existingMeta = (approval.metadata as Record<string, unknown>) || {};
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: {
                    metadata: {
                        ...existingMeta,
                        whatsappJid: waResult.jid
                    } as unknown as Prisma.InputJsonValue
                }
            });
            notifiedChannels.push("whatsapp");
            console.log("[HumanEngagement] WhatsApp review message sent");
        }
    }

    await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { notifiedChannels }
    });

    console.log(
        `[HumanEngagement] Engagement ${approval.id} created. ` +
            `Channels: ${notifiedChannels.join(", ") || "none"}`
    );

    return approval.id;
}

export async function resolveEngagement(
    options: ResolveEngagementOptions
): Promise<{ resumed: boolean; conditional?: boolean; error?: string }> {
    const { prisma } = await import("@repo/database");

    const approval = await prisma.approvalRequest.findUnique({
        where: { id: options.approvalRequestId },
        include: {
            workflowRun: {
                include: { workflow: { select: { slug: true } } }
            }
        }
    });

    if (!approval) {
        return { resumed: false, error: "Approval request not found" };
    }

    const allowedTransitions = new Set(["pending", "conditional"]);
    if (!allowedTransitions.has(approval.status)) {
        return { resumed: false, error: `Already resolved: ${approval.status}` };
    }

    if (!approval.workflowRunId || !approval.workflowRun) {
        return { resumed: false, error: "No workflow run linked" };
    }

    if (options.decision === "conditional") {
        const existingMeta = (approval.metadata as Record<string, unknown>) || {};
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                status: "conditional",
                decidedBy: options.decidedBy,
                decidedAt: new Date(),
                decisionReason: options.message || "Conditional approval - awaiting conditions",
                responseChannel: options.channel,
                metadata: {
                    ...existingMeta,
                    conditional: options.conditionMeta || { conditionType: "ci-checks" }
                } as unknown as Prisma.InputJsonValue
            }
        });

        console.log(
            `[HumanEngagement] Engagement ${approval.id} set to conditional. Workflow stays suspended.`
        );
        return { resumed: false, conditional: true };
    }

    const status =
        options.decision === "approved"
            ? "approved"
            : options.decision === "rejected"
              ? "rejected"
              : "feedback";

    await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: {
            status,
            decidedBy: options.decidedBy,
            decidedAt: new Date(),
            decisionReason: options.message || options.decision,
            responseChannel: options.channel,
            feedbackText: options.decision === "feedback" ? options.message : null
        }
    });

    const resumeData: Record<string, unknown> = {
        decision: options.decision,
        approved: options.decision === "approved",
        decidedBy: options.decidedBy,
        channel: options.channel
    };
    if (options.message) {
        resumeData.feedback = options.message;
    }

    const workflowSlug = approval.workflowRun.workflow?.slug;
    if (!workflowSlug) {
        return { resumed: false, error: "Workflow slug not found" };
    }

    try {
        const agentBaseUrl = process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/agent`
            : "http://localhost:3001";

        const res = await fetch(
            `${agentBaseUrl}/api/workflows/${workflowSlug}/runs/${approval.workflowRunId}/resume`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resumeData,
                    requestContext: { organizationId: approval.organizationId }
                })
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error("[HumanEngagement] Resume API error:", errText);
            return { resumed: false, error: `Resume API error: ${res.status}` };
        }

        console.log(
            `[HumanEngagement] Workflow resumed: ${workflowSlug} run ${approval.workflowRunId}`
        );
    } catch (err) {
        console.error("[HumanEngagement] Resume call failed:", err);
        return { resumed: false, error: "Resume call failed" };
    }

    // Acknowledge on all notified channels
    const reviewCtx = approval.reviewContext as EngagementContext | null;
    if (
        approval.notifiedChannels.includes("github") &&
        reviewCtx?.repository &&
        reviewCtx?.issueNumber
    ) {
        await acknowledgeGitHub(
            reviewCtx.repository,
            reviewCtx.issueNumber,
            options.decision,
            options.message,
            options.decidedBy,
            approval.organizationId
        );
    }

    return { resumed: true };
}

/**
 * Find a pending engagement by GitHub repo + issue number.
 * Used by the GitHub webhook inbound handler.
 */
export async function findEngagementByGitHubIssue(
    repo: string,
    issueNumber: number
): Promise<string | null> {
    const { prisma } = await import("@repo/database");

    const approval = await prisma.approvalRequest.findFirst({
        where: {
            githubRepo: repo,
            githubIssueNumber: issueNumber,
            status: "pending"
        },
        orderBy: { createdAt: "desc" },
        select: { id: true }
    });

    return approval?.id ?? null;
}

/**
 * Find pending merge-review engagements for a set of issue numbers in a repo.
 *
 * Used by the PR-merge webhook handler. Scoped to:
 *  - exact `githubRepo` match
 *  - `sourceId = "merge-review"` (the PR merge gate, not the triage gate)
 *  - `status = "pending"`
 *
 * Each returned record includes its `workflowRunId` and `workflowSlug`
 * so the caller can verify it's resuming the correct workflow instance.
 */
export async function findMergeReviewEngagements(
    repo: string,
    issueNumbers: number[]
): Promise<
    Array<{
        id: string;
        issueNumber: number;
        workflowRunId: string | null;
        workflowSlug: string | null;
    }>
> {
    if (issueNumbers.length === 0) return [];

    const { prisma } = await import("@repo/database");

    const approvals = await prisma.approvalRequest.findMany({
        where: {
            githubRepo: repo,
            githubIssueNumber: { in: issueNumbers },
            sourceId: "merge-review",
            status: "pending"
        },
        select: {
            id: true,
            githubIssueNumber: true,
            workflowRunId: true,
            workflowRun: {
                select: { workflow: { select: { slug: true } } }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return approvals.map((a) => ({
        id: a.id,
        issueNumber: a.githubIssueNumber!,
        workflowRunId: a.workflowRunId,
        workflowSlug: a.workflowRun?.workflow?.slug ?? null
    }));
}

/**
 * Find a pending engagement by Slack channel + message timestamp.
 * Used by the Slack interactions handler.
 */
export async function findEngagementBySlackMessage(
    channelId: string,
    messageTs: string
): Promise<string | null> {
    const { prisma } = await import("@repo/database");

    const approval = await prisma.approvalRequest.findFirst({
        where: {
            slackChannelId: channelId,
            slackMessageTs: messageTs,
            status: "pending"
        },
        select: { id: true }
    });

    return approval?.id ?? null;
}

/**
 * Find a pending engagement by its ID.
 * Used by Telegram callback queries and WhatsApp reply commands.
 */
export async function findEngagementById(approvalId: string): Promise<string | null> {
    const { prisma } = await import("@repo/database");

    const approval = await prisma.approvalRequest.findFirst({
        where: {
            id: approvalId,
            status: { in: ["pending", "conditional"] }
        },
        select: { id: true }
    });

    return approval?.id ?? null;
}
