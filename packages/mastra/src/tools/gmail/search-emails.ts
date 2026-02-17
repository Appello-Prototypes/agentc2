/**
 * Gmail Search Emails Tool
 *
 * Searches Gmail using Gmail search syntax (same as the Gmail search bar).
 * Returns message summaries with sender, subject, date, and snippet.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGmailApi, resolveGmailAddress } from "./shared";

type GmailMessage = {
    id: string;
    threadId: string;
    snippet?: string;
    payload?: {
        headers?: Array<{ name?: string; value?: string }>;
    };
    internalDate?: string;
    labelIds?: string[];
};

type GmailListResponse = {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate?: number;
};

const getHeader = (headers: Array<{ name?: string; value?: string }> | undefined, name: string) =>
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

export const gmailSearchEmailsTool = createTool({
    id: "gmail-search-emails",
    description:
        "Search Gmail emails using Gmail search syntax. Returns message summaries with sender, subject, date, and snippet. Use queries like 'from:user@example.com newer_than:30d' or 'subject:invoice is:unread'.",
    inputSchema: z.object({
        query: z
            .string()
            .describe(
                "Gmail search query (same syntax as Gmail search bar). Examples: 'from:dan@thomasinsulation.ca newer_than:30d', 'subject:invoice', 'is:unread from:@example.com'"
            ),
        maxResults: z
            .number()
            .min(1)
            .max(20)
            .default(5)
            .describe("Maximum number of results to return (1-20, default 5)"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        totalEstimate: z.number().optional(),
        messages: z.array(
            z.object({
                id: z.string(),
                threadId: z.string(),
                messageIdHeader: z
                    .string()
                    .describe(
                        "RFC822 Message-ID header. Use for Gmail web links: https://mail.google.com/mail/u/0/#search/rfc822msgid:<value>"
                    ),
                from: z.string(),
                to: z.string(),
                subject: z.string(),
                date: z.string(),
                snippet: z.string(),
                labels: z.array(z.string())
            })
        ),
        error: z.string().optional()
    }),
    execute: async ({ query, maxResults, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            // Step 1: Search for message IDs
            const listResponse = await callGmailApi(address, "/users/me/messages", {
                params: {
                    q: query,
                    maxResults: String(maxResults || 5)
                }
            });

            if (!listResponse.ok) {
                const errorText = await listResponse.text();
                return {
                    success: false,
                    messages: [],
                    error: `Gmail search failed (${listResponse.status}): ${errorText}`
                };
            }

            const listData = (await listResponse.json()) as GmailListResponse;
            if (!listData.messages || listData.messages.length === 0) {
                return {
                    success: true,
                    totalEstimate: 0,
                    messages: []
                };
            }

            // Step 2: Fetch details for each message (minimal format for speed)
            const messageDetails = await Promise.all(
                listData.messages.slice(0, maxResults || 5).map(async (msg) => {
                    const detailResponse = await callGmailApi(
                        address,
                        `/users/me/messages/${msg.id}`,
                        {
                            params: {
                                format: "metadata",
                                metadataHeaders: "From,To,Subject,Date,Message-ID"
                            }
                        }
                    );
                    if (!detailResponse.ok) return null;
                    return (await detailResponse.json()) as GmailMessage;
                })
            );

            const messages = messageDetails
                .filter((m): m is GmailMessage => m !== null)
                .map((m) => ({
                    id: m.id,
                    threadId: m.threadId,
                    messageIdHeader: getHeader(m.payload?.headers, "Message-ID"),
                    from: getHeader(m.payload?.headers, "From"),
                    to: getHeader(m.payload?.headers, "To"),
                    subject: getHeader(m.payload?.headers, "Subject"),
                    date: getHeader(m.payload?.headers, "Date"),
                    snippet: m.snippet || "",
                    labels: m.labelIds || []
                }));

            return {
                success: true,
                totalEstimate: listData.resultSizeEstimate || messages.length,
                messages
            };
        } catch (error) {
            return {
                success: false,
                messages: [],
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
