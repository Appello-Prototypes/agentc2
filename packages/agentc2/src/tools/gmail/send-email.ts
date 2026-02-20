/**
 * Gmail Send Email Tool
 *
 * Sends an email via Gmail. Includes a confirmSend safeguard —
 * when confirmSend is false (default), returns a preview instead of sending.
 * The agent must show the preview and get explicit user approval before
 * calling again with confirmSend=true.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGmailApi, resolveGmailAddress } from "./shared";

type GmailSendResponse = {
    id: string;
    threadId: string;
    labelIds?: string[];
};

/**
 * Encode an email message in RFC 2822 format for the Gmail API.
 */
const buildRawMessage = (params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    inReplyTo?: string;
    references?: string;
    fromAddress?: string;
}): string => {
    const lines: string[] = [];

    if (params.fromAddress) {
        lines.push(`From: ${params.fromAddress}`);
    }
    lines.push(`To: ${params.to}`);
    if (params.cc) lines.push(`Cc: ${params.cc}`);
    if (params.bcc) lines.push(`Bcc: ${params.bcc}`);
    lines.push(`Subject: ${params.subject}`);

    // Threading headers for replies
    if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
    if (params.references) lines.push(`References: ${params.references}`);

    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("");
    lines.push(params.body);

    const raw = lines.join("\r\n");
    // Gmail API expects URL-safe base64
    return Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

export const gmailSendEmailTool = createTool({
    id: "gmail-send-email",
    description:
        "Send an email via Gmail. IMPORTANT: You MUST show the user a preview of the email (recipients, subject, body) and get their explicit confirmation BEFORE calling this tool with confirmSend=true. When confirmSend is false (default), returns a preview without sending.",
    inputSchema: z.object({
        to: z.string().describe("Recipient email address(es), comma-separated"),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Plain text email body"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
        bcc: z.string().optional().describe("BCC recipients, comma-separated"),
        threadId: z.string().optional().describe("Gmail thread ID to send in (for replies)"),
        inReplyTo: z
            .string()
            .optional()
            .describe("Message-ID header of the email being replied to"),
        confirmSend: z
            .boolean()
            .default(false)
            .describe(
                "Set to true only AFTER showing the user a preview and getting their explicit approval. When false, returns a preview instead of sending."
            ),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        preview: z.boolean().optional(),
        messageId: z.string().optional(),
        threadId: z.string().optional(),
        to: z.string().optional(),
        subject: z.string().optional(),
        bodySnippet: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({
        to,
        subject,
        body,
        cc,
        bcc,
        threadId,
        inReplyTo,
        confirmSend,
        gmailAddress
    }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            // If confirmSend is false, return a preview
            if (!confirmSend) {
                return {
                    success: true,
                    preview: true,
                    to,
                    subject,
                    bodySnippet: body.length > 200 ? body.slice(0, 200) + "..." : body
                };
            }

            const raw = buildRawMessage({
                to,
                subject,
                body,
                cc,
                bcc,
                inReplyTo,
                references: inReplyTo,
                fromAddress: address
            });

            const requestBody: Record<string, unknown> = { raw };

            // Attach to existing thread for replies
            if (threadId) {
                requestBody.threadId = threadId;
            }

            const response = await callGmailApi(address, "/users/me/messages/send", {
                method: "POST",
                body: requestBody
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Gmail send failed (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as GmailSendResponse;
            return {
                success: true,
                preview: false,
                messageId: data.id,
                threadId: data.threadId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
