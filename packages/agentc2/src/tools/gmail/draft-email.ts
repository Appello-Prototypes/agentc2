/**
 * Gmail Draft Email Tool
 *
 * Creates a draft email in Gmail for human review before sending.
 * Supports reply-to threading via In-Reply-To / References headers.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGmailApi, resolveGmailAddress } from "./shared";

type GmailDraftResponse = {
    id: string;
    message?: {
        id: string;
        threadId: string;
    };
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

export const gmailDraftEmailTool = createTool({
    id: "gmail-draft-email",
    description:
        "Create a draft email in Gmail for human review. The draft appears in the Drafts folder and is NOT sent. Use for composing replies or new messages that Corey can review before sending.",
    inputSchema: z.object({
        to: z.string().describe("Recipient email address(es), comma-separated"),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Plain text email body"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
        bcc: z.string().optional().describe("BCC recipients, comma-separated"),
        threadId: z
            .string()
            .optional()
            .describe("Gmail thread ID to attach the draft to (for replies)"),
        inReplyTo: z
            .string()
            .optional()
            .describe("Message-ID header of the email being replied to"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        draftId: z.string().optional(),
        messageId: z.string().optional(),
        threadId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ to, subject, body, cc, bcc, threadId, inReplyTo, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
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

            const requestBody: Record<string, unknown> = {
                message: { raw }
            };

            // Attach to existing thread for replies
            if (threadId) {
                (requestBody.message as Record<string, unknown>).threadId = threadId;
            }

            const response = await callGmailApi(address, "/users/me/drafts", {
                method: "POST",
                body: requestBody
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Gmail draft creation failed (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as GmailDraftResponse;
            return {
                success: true,
                draftId: data.id,
                messageId: data.message?.id,
                threadId: data.message?.threadId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
