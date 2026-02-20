import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Web Search Tool
 *
 * Searches the web using Firecrawl's search API with a minimal, clean schema.
 * This tool bypasses the MCP layer to avoid schema bloat that causes
 * "Invalid request body" errors with the Firecrawl MCP package.
 *
 * Requires FIRECRAWL_API_KEY environment variable.
 */
export const webSearchTool = createTool({
    id: "web-search",
    description:
        "Search the web for any topic. Returns search results with titles, URLs, and descriptions. Use this to find current information, news, or research any topic.",
    inputSchema: z.object({
        query: z
            .string()
            .describe("The search query (e.g. 'latest AI news', 'best restaurants in NYC')")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                description: z.string()
            })
        ),
        resultCount: z.number()
    }),
    execute: async ({ query }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
            throw new Error("FIRECRAWL_API_KEY is not configured");
        }

        const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query,
                limit: 5
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Firecrawl search failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Handle both v1 and v2 response formats
        const rawResults = Array.isArray(data.data) ? data.data : data.data?.web || [];

        const results = rawResults.map((r: Record<string, unknown>) => ({
            title: (r.title as string) || "Untitled",
            url: (r.url as string) || "",
            description: (r.description as string) || (r.snippet as string) || ""
        }));

        return {
            results,
            resultCount: results.length
        };
    }
});

/**
 * Web Scrape Tool
 *
 * Reads the full content of any webpage using Firecrawl's scrape API.
 * Returns clean markdown content extracted from the page.
 *
 * Requires FIRECRAWL_API_KEY environment variable.
 */
export const webScrapeTool = createTool({
    id: "web-scrape",
    description:
        "Read the full content of any webpage. Give it a URL and it returns the page content as clean markdown text. Use this to read articles, documentation, or any web page.",
    inputSchema: z.object({
        url: z
            .string()
            .url()
            .describe("The URL of the webpage to read (e.g. 'https://example.com')")
    }),
    outputSchema: z.object({
        url: z.string(),
        title: z.string(),
        content: z.string(),
        truncated: z.boolean()
    }),
    execute: async ({ url }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
            throw new Error("FIRECRAWL_API_KEY is not configured");
        }

        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url,
                formats: ["markdown"]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Firecrawl scrape failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const result = data.data || {};

        let content = (result.markdown as string) || (result.content as string) || "";
        const maxLength = 8000;
        const truncated = content.length > maxLength;
        if (truncated) {
            content = content.substring(0, maxLength) + "\n\n[Content truncated...]";
        }

        return {
            url,
            title: (result.metadata?.title as string) || "Untitled",
            content,
            truncated
        };
    }
});
