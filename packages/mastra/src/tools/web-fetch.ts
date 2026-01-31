import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Web Fetch Tool
 *
 * Fetches content from a URL and returns text or structured data.
 */
export const webFetchTool = createTool({
    id: "web-fetch",
    description: "Fetch content from a URL. Returns the text content of the page or API response.",
    inputSchema: z.object({
        url: z.string().url().describe("The URL to fetch"),
        extractText: z.boolean().optional().default(true).describe("Extract plain text from HTML"),
        maxLength: z.number().optional().default(5000).describe("Maximum characters to return")
    }),
    outputSchema: z.object({
        url: z.string(),
        status: z.number(),
        contentType: z.string(),
        content: z.string(),
        truncated: z.boolean()
    }),
    execute: async ({ url, extractText = true, maxLength = 5000 }) => {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "MastraBot/1.0 (AI Assistant)",
                    Accept: "text/html,application/json,text/plain"
                }
            });

            const contentType = response.headers.get("content-type") || "text/plain";
            let content = await response.text();

            // Simple HTML text extraction
            if (extractText && contentType.includes("text/html")) {
                content = content
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            }

            const truncated = content.length > maxLength;
            if (truncated) {
                content = content.substring(0, maxLength) + "...";
            }

            return {
                url,
                status: response.status,
                contentType,
                content,
                truncated
            };
        } catch (error) {
            throw new Error(
                `Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
});
