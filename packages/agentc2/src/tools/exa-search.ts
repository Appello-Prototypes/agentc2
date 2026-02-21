import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const EXA_BASE_URL = "https://api.exa.ai";

function getExaApiKey(): string {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
        throw new Error("EXA_API_KEY is not configured");
    }
    return apiKey;
}

async function exaRequest(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${EXA_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": getExaApiKey()
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exa API error (${response.status}): ${errorText}`);
    }

    return response.json();
}

const searchResultSchema = z.object({
    title: z.string(),
    url: z.string(),
    publishedDate: z.string().optional(),
    author: z.string().optional(),
    score: z.number().optional(),
    text: z.string().optional()
});

/**
 * Exa Search — Neural search engine built for agents.
 * 95% accuracy on SimpleQA benchmark. Returns structured data, not SERPs.
 */
export const exaSearchTool = createTool({
    id: "exa-search",
    description:
        "Search the web using Exa's neural search engine (95% factual accuracy). Returns structured results with titles, URLs, and optionally full text content. Best for research-quality, accurate web search.",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
        numResults: z.number().optional().default(10).describe("Number of results to return"),
        type: z
            .enum(["auto", "keyword", "neural"])
            .optional()
            .default("auto")
            .describe("Search type: auto (recommended), keyword, or neural"),
        useAutoprompt: z
            .boolean()
            .optional()
            .default(true)
            .describe("Let Exa optimize the query for better results"),
        includeText: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include full text content of each result"),
        startPublishedDate: z
            .string()
            .optional()
            .describe("Filter results published after this date (YYYY-MM-DD)"),
        endPublishedDate: z
            .string()
            .optional()
            .describe("Filter results published before this date (YYYY-MM-DD)")
    }),
    outputSchema: z.object({
        results: z.array(searchResultSchema),
        resultCount: z.number(),
        autopromptString: z.string().optional()
    }),
    execute: async ({
        query,
        numResults,
        type,
        useAutoprompt,
        includeText,
        startPublishedDate,
        endPublishedDate
    }) => {
        const body: Record<string, unknown> = {
            query,
            numResults,
            type,
            useAutoprompt
        };

        if (includeText) {
            body.contents = { text: true };
        }
        if (startPublishedDate) body.startPublishedDate = startPublishedDate;
        if (endPublishedDate) body.endPublishedDate = endPublishedDate;

        const data = (await exaRequest("/search", body)) as {
            results: Array<Record<string, unknown>>;
            autopromptString?: string;
        };

        const results = (data.results || []).map((r) => ({
            title: (r.title as string) || "",
            url: (r.url as string) || "",
            publishedDate: r.publishedDate as string | undefined,
            author: r.author as string | undefined,
            score: r.score as number | undefined,
            text: r.text as string | undefined
        }));

        return {
            results,
            resultCount: results.length,
            autopromptString: data.autopromptString
        };
    }
});

/**
 * Exa Find Similar — find pages similar to a given URL.
 */
export const exaFindSimilarTool = createTool({
    id: "exa-find-similar",
    description:
        "Find web pages similar to a given URL. Useful for competitive analysis, finding related content, or discovering alternatives.",
    inputSchema: z.object({
        url: z.string().url().describe("The URL to find similar pages for"),
        numResults: z.number().optional().default(10).describe("Number of similar results"),
        includeText: z.boolean().optional().default(false).describe("Include full text content")
    }),
    outputSchema: z.object({
        results: z.array(searchResultSchema),
        resultCount: z.number()
    }),
    execute: async ({ url, numResults, includeText }) => {
        const body: Record<string, unknown> = { url, numResults };
        if (includeText) {
            body.contents = { text: true };
        }

        const data = (await exaRequest("/findSimilar", body)) as {
            results: Array<Record<string, unknown>>;
        };

        const results = (data.results || []).map((r) => ({
            title: (r.title as string) || "",
            url: (r.url as string) || "",
            publishedDate: r.publishedDate as string | undefined,
            author: r.author as string | undefined,
            score: r.score as number | undefined,
            text: r.text as string | undefined
        }));

        return { results, resultCount: results.length };
    }
});

/**
 * Exa Get Contents — extract clean text/markdown from URLs.
 */
export const exaGetContentsTool = createTool({
    id: "exa-get-contents",
    description:
        "Extract clean text content from one or more URLs. Returns structured content without HTML noise. Useful for reading articles, documentation, or any web page content.",
    inputSchema: z.object({
        urls: z.array(z.string().url()).describe("URLs to extract content from"),
        maxCharacters: z
            .number()
            .optional()
            .default(10000)
            .describe("Maximum characters per result")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                url: z.string(),
                title: z.string(),
                text: z.string(),
                publishedDate: z.string().optional(),
                author: z.string().optional()
            })
        ),
        resultCount: z.number()
    }),
    execute: async ({ urls, maxCharacters }) => {
        const data = (await exaRequest("/contents", {
            ids: urls,
            text: { maxCharacters }
        })) as { results: Array<Record<string, unknown>> };

        const results = (data.results || []).map((r) => ({
            url: (r.url as string) || "",
            title: (r.title as string) || "",
            text: (r.text as string) || "",
            publishedDate: r.publishedDate as string | undefined,
            author: r.author as string | undefined
        }));

        return { results, resultCount: results.length };
    }
});

/**
 * Exa Research — parallelized multi-query research endpoint.
 * Runs multiple searches in parallel and merges results.
 */
export const exaResearchTool = createTool({
    id: "exa-research",
    description:
        "Research a topic in depth by running multiple search queries in parallel and combining the results. Best for comprehensive research that requires multiple angles.",
    inputSchema: z.object({
        queries: z
            .array(z.string())
            .min(1)
            .max(5)
            .describe("List of search queries to run in parallel (1-5 queries)"),
        numResultsPerQuery: z.number().optional().default(5).describe("Results per query"),
        includeText: z.boolean().optional().default(true).describe("Include full text content")
    }),
    outputSchema: z.object({
        queryResults: z.array(
            z.object({
                query: z.string(),
                results: z.array(searchResultSchema),
                resultCount: z.number()
            })
        ),
        totalResults: z.number()
    }),
    execute: async ({ queries, numResultsPerQuery, includeText }) => {
        const searchPromises = queries.map(async (query) => {
            const body: Record<string, unknown> = {
                query,
                numResults: numResultsPerQuery,
                useAutoprompt: true
            };
            if (includeText) {
                body.contents = { text: true };
            }

            const data = (await exaRequest("/search", body)) as {
                results: Array<Record<string, unknown>>;
            };

            const results = (data.results || []).map((r) => ({
                title: (r.title as string) || "",
                url: (r.url as string) || "",
                publishedDate: r.publishedDate as string | undefined,
                author: r.author as string | undefined,
                score: r.score as number | undefined,
                text: r.text as string | undefined
            }));

            return { query, results, resultCount: results.length };
        });

        const queryResults = await Promise.all(searchPromises);
        const totalResults = queryResults.reduce((sum, qr) => sum + qr.resultCount, 0);

        return { queryResults, totalResults };
    }
});
