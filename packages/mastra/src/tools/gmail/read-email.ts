/**
 * Gmail Read Email Tool
 *
 * Reads the full content of a specific email by message ID.
 * Returns headers, body text, and attachment metadata.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGmailApi, resolveGmailAddress, buildGmailWebUrl } from "./shared";

type GmailFullMessage = {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    labelIds?: string[];
    payload?: {
        mimeType?: string;
        headers?: Array<{ name?: string; value?: string }>;
        body?: { data?: string; size?: number };
        parts?: GmailPart[];
    };
};

type GmailPart = {
    mimeType?: string;
    filename?: string;
    body?: { data?: string; size?: number; attachmentId?: string };
    parts?: GmailPart[];
};

const getHeader = (headers: Array<{ name?: string; value?: string }> | undefined, name: string) =>
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

const decodeBase64 = (value?: string | null) => {
    if (!value) return "";
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
};

const extractBody = (payload?: GmailFullMessage["payload"]): { text: string; html: string } => {
    if (!payload) return { text: "", html: "" };
    const texts: string[] = [];
    const htmls: string[] = [];

    const walk = (part: GmailPart | GmailFullMessage["payload"]) => {
        if (!part) return;
        if (part.mimeType === "text/plain" && part.body?.data) {
            texts.push(decodeBase64(part.body.data));
        }
        if (part.mimeType === "text/html" && part.body?.data) {
            htmls.push(decodeBase64(part.body.data));
        }
        if ("parts" in part && Array.isArray(part.parts)) {
            part.parts.forEach((child) => walk(child));
        }
    };

    walk(payload);
    return { text: texts.join("\n").trim(), html: htmls.join("\n").trim() };
};

const extractAttachments = (
    payload?: GmailFullMessage["payload"]
): Array<{ filename: string; mimeType: string; size: number }> => {
    if (!payload) return [];
    const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];

    const walk = (part: GmailPart | GmailFullMessage["payload"]) => {
        if (!part) return;
        const filename = "filename" in part ? part.filename : undefined;
        if (filename) {
            attachments.push({
                filename,
                mimeType: part.mimeType || "application/octet-stream",
                size: part.body?.size || 0
            });
        }
        if ("parts" in part && Array.isArray(part.parts)) {
            part.parts.forEach((child) => walk(child));
        }
    };

    walk(payload);
    return attachments;
};

export const gmailReadEmailTool = createTool({
    id: "gmail-read-email",
    description:
        "Read the full content of a Gmail email by message ID. Returns subject, from, to, date, body text, and attachment info.",
    inputSchema: z.object({
        messageId: z.string().describe("The Gmail message ID to read"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z
            .object({
                id: z.string(),
                threadId: z.string(),
                webUrl: z
                    .string()
                    .describe("Direct Gmail web URL that opens this email thread in the browser"),
                messageIdHeader: z.string(),
                from: z.string(),
                to: z.string(),
                cc: z.string(),
                subject: z.string(),
                date: z.string(),
                bodyText: z.string(),
                snippet: z.string(),
                labels: z.array(z.string()),
                attachments: z.array(
                    z.object({
                        filename: z.string(),
                        mimeType: z.string(),
                        size: z.number()
                    })
                )
            })
            .optional(),
        error: z.string().optional()
    }),
    execute: async ({ messageId, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const response = await callGmailApi(address, `/users/me/messages/${messageId}`, {
                params: { format: "full" }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Gmail read failed (${response.status}): ${errorText}`
                };
            }

            const msg = (await response.json()) as GmailFullMessage;
            const { text } = extractBody(msg.payload);
            const attachments = extractAttachments(msg.payload);

            return {
                success: true,
                message: {
                    id: msg.id,
                    threadId: msg.threadId,
                    webUrl: buildGmailWebUrl(msg.threadId),
                    messageIdHeader: getHeader(msg.payload?.headers, "Message-ID"),
                    from: getHeader(msg.payload?.headers, "From"),
                    to: getHeader(msg.payload?.headers, "To"),
                    cc: getHeader(msg.payload?.headers, "Cc"),
                    subject: getHeader(msg.payload?.headers, "Subject"),
                    date: getHeader(msg.payload?.headers, "Date"),
                    bodyText: text.slice(0, 3000), // Cap at 3k chars to avoid token bloat
                    snippet: msg.snippet || "",
                    labels: msg.labelIds || [],
                    attachments
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
