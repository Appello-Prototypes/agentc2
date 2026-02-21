import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { lookup } from "dns/promises";
import { isIP } from "net";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function isPrivateIp(ip: string): boolean {
    if (ip === "127.0.0.1" || ip === "0.0.0.0" || ip === "::1" || ip === "::") return true;
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (ip.startsWith("169.254.")) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
    if (/^127\./.test(ip)) return true;
    return false;
}

async function assertSafeFetchUrl(input: string) {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Only http/https URLs are allowed");
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
        throw new Error("Fetching localhost is not allowed");
    }

    const knownBlockedHosts = new Set([
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.aws.internal",
        "metadata.azure.internal",
        "0.0.0.0"
    ]);
    if (knownBlockedHosts.has(hostname)) {
        throw new Error("Fetching metadata/blocked endpoints is not allowed");
    }

    if (isIP(hostname) && isPrivateIp(hostname)) {
        throw new Error("Fetching private IP ranges is not allowed");
    }

    const resolved = await lookup(hostname);
    if (isPrivateIp(resolved.address)) {
        throw new Error("Resolved address is in a private network range");
    }
}

async function fetchWithRedirectValidation(
    url: string,
    headers: Record<string, string>,
    remainingRedirects: number = MAX_REDIRECTS
): Promise<Response> {
    const response = await fetch(url, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (remainingRedirects <= 0) {
            throw new Error("Too many redirects");
        }
        const location = response.headers.get("location");
        if (!location) {
            throw new Error("Redirect response missing Location header");
        }
        const redirectUrl = new URL(location, url).toString();
        await assertSafeFetchUrl(redirectUrl);
        return fetchWithRedirectValidation(redirectUrl, headers, remainingRedirects - 1);
    }

    return response;
}

/**
 * Web Fetch Tool
 *
 * Fetches content from a URL and returns text or structured data.
 * Includes SSRF protections: private IP blocking, redirect validation,
 * DNS rebinding protection, and configurable timeouts.
 */
export const webFetchTool = createTool({
    id: "web-fetch",
    description: "Fetch content from a URL. Returns the text content of the page or API response.",
    inputSchema: z.object({
        url: z.string().url().describe("The URL to fetch"),
        extractText: z.boolean().optional().default(true).describe("Extract plain text from HTML"),
        maxLength: z.number().optional().default(25000).describe("Maximum characters to return"),
        preferMarkdown: z
            .boolean()
            .optional()
            .default(true)
            .describe("Request markdown from Cloudflare-enabled sites via content negotiation")
    }),
    outputSchema: z.object({
        url: z.string(),
        status: z.number(),
        contentType: z.string(),
        content: z.string(),
        truncated: z.boolean(),
        markdownTokens: z.number().optional()
    }),
    execute: async ({ url, extractText = true, maxLength = 25000, preferMarkdown = true }) => {
        try {
            await assertSafeFetchUrl(url);
            const acceptHeader = preferMarkdown
                ? "text/markdown, text/html;q=0.9, application/json;q=0.8, text/plain;q=0.7"
                : "text/html, application/json, text/plain";
            const response = await fetchWithRedirectValidation(url, {
                "User-Agent": "AgentC2Bot/1.0 (AI Assistant)",
                Accept: acceptHeader
            });

            const contentType = response.headers.get("content-type") || "text/plain";
            const markdownTokensHeader = response.headers.get("x-markdown-tokens");
            const markdownTokens = markdownTokensHeader
                ? parseInt(markdownTokensHeader, 10)
                : undefined;
            let content = await response.text();

            const isMarkdown =
                contentType.includes("text/markdown") || contentType.includes("text/x-markdown");

            if (extractText && contentType.includes("text/html") && !isMarkdown) {
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
                truncated,
                ...(markdownTokens !== undefined && !isNaN(markdownTokens) && { markdownTokens })
            };
        } catch (error) {
            throw new Error(
                `Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
});
