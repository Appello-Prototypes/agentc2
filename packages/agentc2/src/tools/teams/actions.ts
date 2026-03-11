/**
 * Microsoft Teams Action Tools
 *
 * Mastra tools for listing teams/channels, sending messages,
 * and managing chats via Microsoft Graph.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function callGraph(params: {
    connectionId: string;
    path: string;
    method?: string;
    body?: unknown;
    organizationId?: string;
}) {
    const { prisma } = await import("@repo/database");
    const { createDecipheriv } = await import("crypto");

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            id: params.connectionId,
            ...(params.organizationId ? { organizationId: params.organizationId } : {})
        }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Microsoft connection not found or inactive");
    }

    if (params.organizationId && connection.organizationId !== params.organizationId) {
        throw new Error("Microsoft connection does not belong to your organization");
    }

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

export const teamsListTeamsTool = createTool({
    id: "teams-list-teams",
    description: "List the Microsoft Teams the authenticated user is a member of.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        organizationId: z.string().optional().describe("Organization ID for tenant scoping")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        teams: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId }) => {
        try {
            const result = (await callGraph({
                connectionId,
                organizationId,
                path: "/me/joinedTeams?$select=id,displayName,description"
            })) as { value?: unknown[] };

            return {
                success: true,
                teams: (result.value as Record<string, unknown>[]) || []
            };
        } catch (error) {
            return {
                success: false,
                teams: [],
                error: error instanceof Error ? error.message : "Failed to list teams"
            };
        }
    }
});

export const teamsListChannelsTool = createTool({
    id: "teams-list-channels",
    description: "List channels in a specific Microsoft Teams team.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        organizationId: z.string().optional().describe("Organization ID for tenant scoping"),
        teamId: z.string().describe("The Teams team ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        channels: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, teamId }) => {
        try {
            const result = (await callGraph({
                connectionId,
                organizationId,
                path: `/teams/${teamId}/channels?$select=id,displayName,description,membershipType`
            })) as { value?: unknown[] };

            return {
                success: true,
                channels: (result.value as Record<string, unknown>[]) || []
            };
        } catch (error) {
            return {
                success: false,
                channels: [],
                error: error instanceof Error ? error.message : "Failed to list channels"
            };
        }
    }
});

export const teamsSendChannelMessageTool = createTool({
    id: "teams-send-channel-message",
    description: "Send a message to a Microsoft Teams channel.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        organizationId: z.string().optional().describe("Organization ID for tenant scoping"),
        teamId: z.string().describe("The Teams team ID"),
        channelId: z.string().describe("The channel ID"),
        message: z.string().describe("The message content (plain text or HTML)"),
        contentType: z
            .enum(["text", "html"])
            .optional()
            .default("text")
            .describe("Content type of the message")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messageId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, teamId, channelId, message, contentType }) => {
        try {
            const result = (await callGraph({
                connectionId,
                organizationId,
                path: `/teams/${teamId}/channels/${channelId}/messages`,
                method: "POST",
                body: {
                    body: {
                        contentType: contentType || "text",
                        content: message
                    }
                }
            })) as { id?: string };

            return { success: true, messageId: result.id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to send channel message"
            };
        }
    }
});

export const teamsListChatsTool = createTool({
    id: "teams-list-chats",
    description: "List recent 1:1 and group chats in Microsoft Teams.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        organizationId: z.string().optional().describe("Organization ID for tenant scoping"),
        top: z.number().optional().default(20).describe("Number of chats to return (max 50)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        chats: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, top }) => {
        try {
            const result = (await callGraph({
                connectionId,
                organizationId,
                path: `/me/chats?$top=${Math.min(top || 20, 50)}&$orderby=lastMessagePreview/createdDateTime desc&$select=id,topic,chatType,lastMessagePreview,createdDateTime`
            })) as { value?: unknown[] };

            return {
                success: true,
                chats: (result.value as Record<string, unknown>[]) || []
            };
        } catch (error) {
            return {
                success: false,
                chats: [],
                error: error instanceof Error ? error.message : "Failed to list chats"
            };
        }
    }
});

export const teamsSendChatMessageTool = createTool({
    id: "teams-send-chat-message",
    description: "Send a message in an existing Microsoft Teams chat.",
    inputSchema: z.object({
        connectionId: z.string().describe("Microsoft IntegrationConnection ID"),
        organizationId: z.string().optional().describe("Organization ID for tenant scoping"),
        chatId: z.string().describe("The Teams chat ID"),
        message: z.string().describe("The message content (plain text or HTML)"),
        contentType: z
            .enum(["text", "html"])
            .optional()
            .default("text")
            .describe("Content type of the message")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messageId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, chatId, message, contentType }) => {
        try {
            const result = (await callGraph({
                connectionId,
                organizationId,
                path: `/me/chats/${chatId}/messages`,
                method: "POST",
                body: {
                    body: {
                        contentType: contentType || "text",
                        content: message
                    }
                }
            })) as { id?: string };

            return { success: true, messageId: result.id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to send chat message"
            };
        }
    }
});
