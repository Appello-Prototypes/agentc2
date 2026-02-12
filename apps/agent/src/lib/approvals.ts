import { prisma, type Prisma } from "@repo/database";
import { getGmailClient } from "./gmail";
import { sendSlackApprovalRequest } from "./slack";

const APPROVE_REACTIONS = new Set(["white_check_mark", "heavy_check_mark", "thumbsup"]);
const REJECT_REACTIONS = new Set(["x", "no_entry_sign", "thumbsdown"]);

type ApprovalAction =
    | {
          type: "gmail.send";
          gmailAddress: string;
          to: string;
          subject: string;
          bodyText: string;
          bodyHtml?: string;
          threadId?: string;
      }
    | {
          type: "none";
      };

type CreateApprovalOptions = {
    organizationId: string;
    workspaceId?: string | null;
    agentId?: string | null;
    triggerEventId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    integrationConnectionId?: string | null;
    slackUserId?: string | null;
    title?: string | null;
    summary?: string | null;
    payload?: Record<string, unknown> | null;
    action?: ApprovalAction | null;
    metadata?: Record<string, unknown> | null;
    /** Explicit bot token for multi-tenant Slack support */
    botToken?: string;
};

const normalizeJson = (value: unknown) =>
    value && typeof value === "object"
        ? (JSON.parse(JSON.stringify(value)) as Record<string, unknown>)
        : null;

const truncateText = (value: string, max = 900) =>
    value.length > max ? `${value.slice(0, max)}...(truncated)` : value;

const buildApprovalMessage = (options: {
    title?: string | null;
    summary?: string | null;
    payload?: Record<string, unknown> | null;
}) => {
    const title = options.title || "Approval requested";
    const summary = options.summary ? `\n${options.summary}` : "";
    const output = options.payload?.outputText;
    const preview =
        typeof output === "string" && output.trim()
            ? `\n\nDraft preview:\n${truncateText(output.trim())}`
            : "";
    return `${title}${summary}${preview}\n\nReact with :white_check_mark: to approve or :x: to reject.`;
};

const buildGmailMessage = (options: {
    to: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
}) => {
    const headers = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        "MIME-Version: 1.0",
        options.bodyHtml
            ? 'Content-Type: text/html; charset="UTF-8"'
            : 'Content-Type: text/plain; charset="UTF-8"'
    ];
    const body = options.bodyHtml || options.bodyText;
    return `${headers.join("\r\n")}\r\n\r\n${body}`;
};

const sendGmailDraft = async (
    action: Extract<ApprovalAction, { type: "gmail.send" }>,
    organizationId: string
) => {
    const gmail = await getGmailClient(organizationId, action.gmailAddress);
    const rawMessage = buildGmailMessage({
        to: action.to,
        subject: action.subject,
        bodyText: action.bodyText,
        bodyHtml: action.bodyHtml
    });
    const encoded = Buffer.from(rawMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encoded,
            ...(action.threadId ? { threadId: action.threadId } : {})
        }
    });
};

export const extractGmailDraftAction = (options: {
    outputText: string | null | undefined;
    gmailAddress: string;
    threadId?: string | null;
}): ApprovalAction | null => {
    if (!options.outputText) return null;

    const jsonMatch = options.outputText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const candidate = parsed?.draft || parsed?.gmailDraft || parsed;
        if (!candidate || typeof candidate !== "object") return null;

        const to = candidate.to || candidate.recipient;
        const subject = candidate.subject || candidate.title;
        const bodyText = candidate.bodyText || candidate.body || candidate.content;
        const bodyHtml = candidate.bodyHtml;

        if (typeof to !== "string" || typeof subject !== "string" || typeof bodyText !== "string") {
            return null;
        }

        return {
            type: "gmail.send",
            gmailAddress: options.gmailAddress,
            to,
            subject,
            bodyText,
            bodyHtml: typeof bodyHtml === "string" ? bodyHtml : undefined,
            threadId: options.threadId || undefined
        };
    } catch {
        return null;
    }
};

export const createApprovalRequest = async (options: CreateApprovalOptions) => {
    const payloadJson = normalizeJson(options.payload);
    const payloadJsonValue = payloadJson ? (payloadJson as Prisma.InputJsonValue) : undefined;
    const metadata = {
        ...(options.metadata || {}),
        ...(options.action && options.action.type !== "none" ? { action: options.action } : {})
    };
    const metadataValue = metadata
        ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue)
        : undefined;

    const approval = await prisma.approvalRequest.create({
        data: {
            organizationId: options.organizationId,
            workspaceId: options.workspaceId ?? null,
            agentId: options.agentId ?? null,
            triggerEventId: options.triggerEventId ?? null,
            sourceType: options.sourceType,
            sourceId: options.sourceId ?? null,
            payloadJson: payloadJsonValue,
            metadata: metadataValue
        }
    });

    if (options.slackUserId) {
        try {
            const message = buildApprovalMessage({
                title: options.title,
                summary: options.summary,
                payload: options.payload || null
            });
            const slackResponse = await sendSlackApprovalRequest({
                userId: options.slackUserId,
                text: message,
                botToken: options.botToken
            });
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: {
                    slackChannelId: slackResponse.channelId,
                    slackMessageTs: slackResponse.messageTs
                }
            });
        } catch (error) {
            console.warn("[Approvals] Failed to send Slack approval:", error);
        }
    }

    await prisma.crmAuditLog.create({
        data: {
            organizationId: options.organizationId,
            workspaceId: options.workspaceId ?? null,
            integrationConnectionId: options.integrationConnectionId ?? null,
            eventType: "approval.requested",
            recordType: "approval_request",
            recordId: approval.id,
            sourceType: options.sourceType,
            sourceId: options.sourceId ?? undefined,
            payloadJson: payloadJsonValue
        }
    });

    return approval;
};

export const handleSlackApprovalReaction = async (options: {
    channelId: string;
    messageTs: string;
    reaction: string;
    slackUserId: string;
}) => {
    const normalizedReaction = options.reaction.toLowerCase();
    const status = APPROVE_REACTIONS.has(normalizedReaction)
        ? "approved"
        : REJECT_REACTIONS.has(normalizedReaction)
          ? "rejected"
          : null;

    if (!status) {
        return null;
    }

    const approval = await prisma.approvalRequest.findFirst({
        where: {
            slackChannelId: options.channelId,
            slackMessageTs: options.messageTs,
            status: "pending"
        }
    });

    if (!approval) {
        return null;
    }

    const updated = await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: {
            status,
            decidedBy: options.slackUserId,
            decidedAt: new Date(),
            decisionReason: normalizedReaction
        }
    });

    await prisma.crmAuditLog.create({
        data: {
            organizationId: updated.organizationId,
            workspaceId: updated.workspaceId ?? null,
            eventType: status === "approved" ? "approval.approved" : "approval.rejected",
            recordType: "approval_request",
            recordId: updated.id,
            sourceType: "slack",
            sourceId: options.slackUserId,
            payloadJson: updated.payloadJson ?? undefined
        }
    });

    if (status === "approved") {
        const metadata =
            updated.metadata && typeof updated.metadata === "object"
                ? (updated.metadata as Record<string, unknown>)
                : {};
        const action = metadata.action as ApprovalAction | undefined;
        if (action?.type === "gmail.send") {
            await sendGmailDraft(action, updated.organizationId);
        }
    }

    if (updated.workflowRunId) {
        try {
            const { humanApprovalWorkflow } = await import("@repo/mastra");
            const workflow = humanApprovalWorkflow as unknown as {
                resume: (
                    runId: string,
                    input: {
                        approved: boolean;
                        approvedBy: string;
                        rejectionReason?: string;
                    }
                ) => Promise<void>;
            };
            await workflow.resume(updated.workflowRunId, {
                approved: status === "approved",
                approvedBy: options.slackUserId,
                rejectionReason: status === "rejected" ? "Rejected via Slack" : undefined
            });
        } catch (error) {
            console.warn("[Approvals] Failed to resume workflow:", error);
        }
    }

    return updated;
};
