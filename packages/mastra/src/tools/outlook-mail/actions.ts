/**
 * Outlook Mail Action Tools
 *
 * Mastra tools for sending, reading, listing, and archiving
 * Outlook emails via Microsoft Graph.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ── Shared helper: resolve connection + call Graph ─────────────────

async function callGraph(params: {
    connectionId: string;
    path: string;
    method?: string;
    body?: unknown;
}) {
    // Tools in @repo/mastra can't import from apps/agent directly.
    // They call Graph via raw fetch, loading tokens from the database.
    const { prisma } = await import("@repo/database");
    const { createDecipheriv } = await import("crypto");

    const connection = await prisma.integrationConnection.findUnique({
        where: { id: params.connectionId }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Microsoft connection not found or inactive");
    }

    // Decrypt credentials
    let creds: Record<string, unknown> = {};
    if (connection.credentials && typeof connection.credentials === "object") {
        const value = connection.credentials as Record<string, unknown>;
        if (value.__enc === "v1") {
            const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
            if (key) {
                const buf = Buffer.from(key, "hex");
                if (buf.length === 32) {
                    const iv = Buffer.from(value.iv as string, "base64");
                    const tag = Buffer.from(value.tag as string, "base64");
                    const encrypted = Buffer.from(value.data as string, "base64");
                    const decipher = createDecipheriv("aes-256-gcm", buf, iv);
                    decipher.setAuthTag(tag);
                    const decrypted = Buffer.concat([
                        decipher.update(encrypted),
                        decipher.final()
                    ]).toString("utf8");
                    try {
                        creds = JSON.parse(decrypted);
                    } catch {
                        /* empty */
                    }
                }
            }
        } else {
            creds = value;
        }
    }

    const accessToken = creds.accessToken as string;
    if (!accessToken) {
        throw new Error("No access token found for Microsoft connection");
    }

    const url = params.path.startsWith("http") ? params.path : `${GRAPH_BASE}${params.path}`;

    const response = await fetch(url, {
        method: params.method || "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: params.body ? JSON.stringify(params.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Graph API error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) return {};
    return response.json();
}

// ── Tools ──────────────────────────────────────────────────────────

export const outlookMailListEmailsTool = createTool({
    id: "outlook-mail-list-emails",
    description:
        "List recent emails from Outlook inbox. Returns subject, sender, date, and preview for each message.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        top: z.number().optional().default(10).describe("Number of emails to return (max 50)"),
        filter: z.string().optional().describe("OData filter expression (e.g., 'isRead eq false')")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messages: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, top, filter }) => {
        try {
            const filterParam = filter ? `&$filter=${encodeURIComponent(filter)}` : "";
            const result = (await callGraph({
                connectionId,
                path: `/me/mailFolders/Inbox/messages?$top=${Math.min(top || 10, 50)}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments,webLink${filterParam}`
            })) as { value?: unknown[] };

            return { success: true, messages: (result.value as Record<string, unknown>[]) || [] };
        } catch (error) {
            return {
                success: false,
                messages: [],
                error: error instanceof Error ? error.message : "Failed to list emails"
            };
        }
    }
});

export const outlookMailGetEmailTool = createTool({
    id: "outlook-mail-get-email",
    description: "Get a specific Outlook email by ID, including full body content.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        messageId: z.string().describe("The Outlook message ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, messageId }) => {
        try {
            const result = await callGraph({
                connectionId,
                path: `/me/messages/${messageId}?$select=id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,conversationId,webLink`
            });
            return { success: true, message: result as Record<string, unknown> };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get email"
            };
        }
    }
});

export const outlookMailSendEmailTool = createTool({
    id: "outlook-mail-send-email",
    description: "Send an email via Outlook. Supports To, CC, subject, and body.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        to: z.array(z.string().email()).describe("Recipient email addresses"),
        cc: z.array(z.string().email()).optional().describe("CC email addresses"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body content"),
        contentType: z
            .enum(["Text", "HTML"])
            .optional()
            .default("Text")
            .describe("Body content type")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, to, cc, subject, body, contentType }) => {
        try {
            await callGraph({
                connectionId,
                path: "/me/sendMail",
                method: "POST",
                body: {
                    message: {
                        subject,
                        body: { contentType: contentType || "Text", content: body },
                        toRecipients: to.map((addr) => ({
                            emailAddress: { address: addr }
                        })),
                        ...(cc && cc.length > 0
                            ? {
                                  ccRecipients: cc.map((addr) => ({
                                      emailAddress: { address: addr }
                                  }))
                              }
                            : {})
                    }
                }
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to send email"
            };
        }
    }
});

export const outlookMailArchiveEmailTool = createTool({
    id: "outlook-mail-archive-email",
    description: "Archive an Outlook email by moving it to the Archive folder.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        messageId: z.string().describe("The Outlook message ID to archive")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, messageId }) => {
        try {
            await callGraph({
                connectionId,
                path: `/me/messages/${messageId}/move`,
                method: "POST",
                body: { destinationId: "archive" }
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to archive email"
            };
        }
    }
});
