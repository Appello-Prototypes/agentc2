import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { lookup } from "dns/promises";
import { isIP } from "net";

function isPrivateIp(ip: string): boolean {
    if (ip === "127.0.0.1" || ip === "::1") return true;
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (ip.startsWith("169.254.")) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
    return false;
}

async function assertSafeFetchUrl(input: string) {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only http/https URLs are allowed");
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
        throw new Error("Fetching localhost is not allowed");
    }

    const knownBlockedHosts = new Set([
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.aws.internal"
    ]);
    if (knownBlockedHosts.has(hostname)) {
        throw new Error("Fetching metadata endpoints is not allowed");
    }

    if (isIP(hostname) && isPrivateIp(hostname)) {
        throw new Error("Fetching private IP ranges is not allowed");
    }

    const resolved = await lookup(hostname);
    if (isPrivateIp(resolved.address)) {
        throw new Error("Resolved address is in a private network range");
    }
}

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
            await assertSafeFetchUrl(url);
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "AgentC2Bot/1.0 (AI Assistant)",
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
