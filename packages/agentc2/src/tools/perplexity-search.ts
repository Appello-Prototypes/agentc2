import { createTool } from "@mastra/core/tools";
import { z } from "zod";

function getPerplexityApiKey(): string {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
        throw new Error("PERPLEXITY_API_KEY is not configured");
    }
    return apiKey;
}

async function perplexityChat(
    query: string,
    options: { detailed?: boolean }
): Promise<{ answer: string; citations: string[] }> {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getPerplexityApiKey()}`
        },
        body: JSON.stringify({
            model: "sonar",
            messages: [
                {
                    role: "system",
                    content: options.detailed
                        ? "You are a thorough research assistant. Provide comprehensive, well-sourced answers with specific details and data points."
                        : "You are a concise research assistant. Provide brief, accurate answers."
                },
                { role: "user", content: query }
            ],
            return_citations: true,
            ...(options.detailed ? { max_tokens: 4096 } : { max_tokens: 1024 })
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        citations?: string[];
    };

    const answer = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    return { answer, citations };
}

/**
 * Perplexity Research — AI-synthesized, sourced research answers.
 */
export const perplexityResearchTool = createTool({
    id: "perplexity-research",
    description:
        "Get a comprehensive, AI-synthesized research answer with citations using Perplexity Sonar. Best for complex questions that need sourced, in-depth answers rather than raw search results.",
    inputSchema: z.object({
        query: z
            .string()
            .describe(
                "The research question (e.g. 'What are the latest advances in quantum computing?')"
            )
    }),
    outputSchema: z.object({
        answer: z.string(),
        citations: z.array(z.string()),
        citationCount: z.number()
    }),
    execute: async ({ query }) => {
        const { answer, citations } = await perplexityChat(query, { detailed: true });
        return { answer, citations, citationCount: citations.length };
    }
});

/**
 * Perplexity Search — lightweight web search with AI synthesis.
 */
export const perplexitySearchTool = createTool({
    id: "perplexity-search",
    description:
        "Quick web search with a concise AI-synthesized answer and source citations. Use for straightforward factual questions that need a brief, sourced response.",
    inputSchema: z.object({
        query: z.string().describe("The search question (e.g. 'What is the population of Tokyo?')")
    }),
    outputSchema: z.object({
        answer: z.string(),
        citations: z.array(z.string()),
        citationCount: z.number()
    }),
    execute: async ({ query }) => {
        const { answer, citations } = await perplexityChat(query, { detailed: false });
        return { answer, citations, citationCount: citations.length };
    }
});
