import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ingestDocument } from "../rag/pipeline";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INLINE_THRESHOLD = 20_000; // chars – roughly ~15 min of speech

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any YouTube URL variant (or bare video ID) into the canonical
 * `https://www.youtube.com/watch?v=VIDEO_ID` form.
 */
export function normalizeYouTubeUrl(input: string): string {
    const trimmed = input.trim();

    // youtu.be/VIDEO_ID
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`;

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;

    // youtube.com/watch?v=VIDEO_ID (already canonical – normalise host)
    const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return `https://www.youtube.com/watch?v=${watchMatch[1]}`;

    // Bare video ID (11 chars, alphanumeric + _ + -)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return `https://www.youtube.com/watch?v=${trimmed}`;
    }

    // Fallback: return as-is and let Firecrawl handle it
    return trimmed;
}

/**
 * Extract the video ID from a normalised YouTube URL.
 */
function extractVideoId(url: string): string | null {
    const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

export interface ParsedYouTubeVideo {
    title: string;
    channel: string;
    duration: string;
    views: string;
    likes: string;
    category: string;
    uploadDate: string;
    description: string;
    chapters: { timestamp: string; title: string }[];
    transcript: string;
}

/**
 * Parse the markdown returned by Firecrawl's YouTube post-processor into
 * structured fields. The format was validated against a real scrape.
 */
export function parseYouTubeMarkdown(markdown: string): ParsedYouTubeVideo {
    const result: ParsedYouTubeVideo = {
        title: "",
        channel: "",
        duration: "",
        views: "",
        likes: "",
        category: "",
        uploadDate: "",
        description: "",
        chapters: [],
        transcript: ""
    };

    // Title – first markdown heading  "# [Title](url)"  or  "# Title"
    const titleMatch = markdown.match(/^#\s+\[([^\]]+)\]/m) || markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) result.title = titleMatch[1].trim();

    // Channel – "**Uploaded by**: [Name](url)" or just text
    const channelMatch = markdown.match(/\*\*Uploaded by\*\*:\s*\[([^\]]+)\]/);
    if (channelMatch) result.channel = channelMatch[1].trim();

    // Duration / Length
    const durationMatch = markdown.match(/\*\*Length\*\*:\s*(.+)/);
    if (durationMatch) result.duration = durationMatch[1].trim();

    // Views
    const viewsMatch = markdown.match(/\*\*Views\*\*:\s*(.+)/);
    if (viewsMatch) result.views = viewsMatch[1].trim();

    // Likes
    const likesMatch = markdown.match(/\*\*Likes\*\*:\s*(.+)/);
    if (likesMatch) result.likes = likesMatch[1].trim();

    // Category
    const categoryMatch = markdown.match(/\*\*Category\*\*:\s*(.+)/);
    if (categoryMatch) result.category = categoryMatch[1].trim();

    // Upload date
    const dateMatch = markdown.match(/\*\*(?:Uploaded|Published) at\*\*:\s*(.+)/);
    if (dateMatch) result.uploadDate = dateMatch[1].trim();

    // Description – inside a code fence after "## Description" heading,
    // or between "## Description" and the next heading / "## Transcript".
    const descBlock = markdown.match(/## Description\s*\n```[\s\S]*?\n([\s\S]*?)\n```/);
    if (descBlock) {
        result.description = descBlock[1].trim();
    } else {
        // Firecrawl sometimes puts it in a plain code fence after metadata
        const altDesc = markdown.match(/```\n([\s\S]*?)\n```/);
        if (altDesc) result.description = altDesc[1].trim();
    }

    // Chapters – lines like "00:00 Title" or "00:00:00 Title"
    const chapterMatches = result.description.matchAll(/(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/g);
    for (const m of chapterMatches) {
        result.chapters.push({ timestamp: m[1], title: m[2].trim() });
    }

    // Transcript – everything after "## Transcript"
    const transcriptIdx = markdown.indexOf("## Transcript");
    if (transcriptIdx !== -1) {
        result.transcript = markdown
            .slice(transcriptIdx + "## Transcript".length)
            .trim()
            // Strip any trailing markdown noise
            .replace(/\n+$/, "");
    }

    return result;
}

// ---------------------------------------------------------------------------
// Shared Firecrawl helpers
// ---------------------------------------------------------------------------

async function firecrawlScrapeYouTube(
    url: string
): Promise<{ markdown: string; metadata: Record<string, unknown> }> {
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
    return {
        markdown: (data.data?.markdown as string) || "",
        metadata: (data.data?.metadata as Record<string, unknown>) || {}
    };
}

// ---------------------------------------------------------------------------
// Tool 1: youtube-get-transcript
// ---------------------------------------------------------------------------

export const youtubeGetTranscriptTool = createTool({
    id: "youtube-get-transcript",
    description:
        "Extract the full transcript and metadata from a YouTube video. Accepts any YouTube URL format or a bare video ID. For short videos the transcript is returned inline. For long videos the transcript is automatically ingested into the knowledge base and a document ID is returned for targeted RAG queries.",
    inputSchema: z.object({
        url: z
            .string()
            .describe(
                "YouTube video URL or video ID (e.g. 'https://www.youtube.com/watch?v=abc123' or 'abc123')"
            )
    }),
    outputSchema: z.object({
        title: z.string(),
        channel: z.string(),
        duration: z.string(),
        views: z.string(),
        likes: z.string(),
        chapters: z.array(z.object({ timestamp: z.string(), title: z.string() })),
        description: z.string(),
        url: z.string(),
        mode: z.enum(["inline", "rag"]),
        transcript: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({ url }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;

        const { markdown } = await firecrawlScrapeYouTube(normalizedUrl);
        const parsed = parseYouTubeMarkdown(markdown);

        const base = {
            title: parsed.title,
            channel: parsed.channel,
            duration: parsed.duration,
            views: parsed.views,
            likes: parsed.likes,
            chapters: parsed.chapters,
            description: parsed.description,
            url: normalizedUrl
        };

        // No transcript available
        if (!parsed.transcript || parsed.transcript.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: "",
                error: "No transcript available for this video. The video may not have captions enabled."
            };
        }

        // Short transcript – return inline
        if (parsed.transcript.length < INLINE_THRESHOLD) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: parsed.transcript
            };
        }

        // Long transcript – auto-ingest into RAG
        const ragContent = formatForRagIngestion(parsed, normalizedUrl);
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${parsed.channel} - ${parsed.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        });

        return {
            ...base,
            mode: "rag" as const,
            ragDocumentId: ragResult.documentId,
            ragChunkCount: ragResult.chunksIngested
        };
    }
});

// ---------------------------------------------------------------------------
// Tool 2: youtube-search-videos
// ---------------------------------------------------------------------------

export const youtubeSearchVideosTool = createTool({
    id: "youtube-search-videos",
    description:
        "Search YouTube for videos on any topic. Returns a list of matching videos with titles, URLs, and descriptions.",
    inputSchema: z.object({
        query: z.string().describe("Search query (e.g. 'AI agent orchestration 2026')"),
        maxResults: z
            .number()
            .min(1)
            .max(10)
            .optional()
            .describe("Maximum number of results to return (default 5, max 10)")
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
    execute: async ({ query, maxResults }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
            throw new Error("FIRECRAWL_API_KEY is not configured");
        }

        const limit = maxResults ?? 5;

        const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: `${query} site:youtube.com`,
                limit
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Firecrawl search failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
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

// ---------------------------------------------------------------------------
// Tool 3: youtube-analyze-video
// ---------------------------------------------------------------------------

export const youtubeAnalyzeVideoTool = createTool({
    id: "youtube-analyze-video",
    description:
        "Scrape a YouTube video and return its transcript with metadata formatted for analysis. For short videos the formatted content is returned inline. For long videos the content is auto-ingested into the knowledge base. The LLM then performs the actual analysis (summarisation, key points, etc.) using the returned data.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        analysisType: z
            .enum(["summary", "key-points", "action-items", "full"])
            .optional()
            .describe(
                "Hint for the kind of analysis the agent should perform on the content (default: full)"
            )
    }),
    outputSchema: z.object({
        title: z.string(),
        channel: z.string(),
        duration: z.string(),
        chapters: z.array(z.object({ timestamp: z.string(), title: z.string() })),
        mode: z.enum(["inline", "rag"]),
        formattedContent: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        analysisType: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ url, analysisType }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;
        const type = analysisType || "full";

        const { markdown } = await firecrawlScrapeYouTube(normalizedUrl);
        const parsed = parseYouTubeMarkdown(markdown);

        const base = {
            title: parsed.title,
            channel: parsed.channel,
            duration: parsed.duration,
            chapters: parsed.chapters,
            analysisType: type
        };

        if (!parsed.transcript || parsed.transcript.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: "",
                error: "No transcript available for this video."
            };
        }

        // Build a structured markdown document for the LLM
        const formatted = buildFormattedContent(parsed, normalizedUrl, type);

        if (formatted.length < INLINE_THRESHOLD) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: formatted
            };
        }

        // Long content – ingest to RAG
        const ragContent = formatForRagIngestion(parsed, normalizedUrl);
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${parsed.channel} - ${parsed.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        });

        return {
            ...base,
            mode: "rag" as const,
            ragDocumentId: ragResult.documentId,
            ragChunkCount: ragResult.chunksIngested
        };
    }
});

// ---------------------------------------------------------------------------
// Tool 4: youtube-ingest-to-knowledge
// ---------------------------------------------------------------------------

export const youtubeIngestToKnowledgeTool = createTool({
    id: "youtube-ingest-to-knowledge",
    description:
        "Scrape a YouTube video transcript and ingest the full content into the RAG knowledge base for later semantic search. Always ingests the complete transcript regardless of length. Use this to build a searchable library of expert knowledge from YouTube videos.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        tags: z
            .array(z.string())
            .optional()
            .describe("Optional tags for categorising the ingested content (e.g. ['AI', 'agents'])")
    }),
    outputSchema: z.object({
        documentId: z.string(),
        title: z.string(),
        channel: z.string(),
        chunkCount: z.number(),
        message: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ url, tags }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;

        const { markdown } = await firecrawlScrapeYouTube(normalizedUrl);
        const parsed = parseYouTubeMarkdown(markdown);

        if (!parsed.transcript || parsed.transcript.length < 20) {
            return {
                documentId: "",
                title: parsed.title || "Unknown",
                channel: parsed.channel || "Unknown",
                chunkCount: 0,
                message: "",
                error: "No transcript available for this video. Cannot ingest."
            };
        }

        const ragContent = formatForRagIngestion(parsed, normalizedUrl, tags);

        const result = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${parsed.channel} - ${parsed.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        });

        return {
            documentId: result.documentId,
            title: parsed.title,
            channel: parsed.channel,
            chunkCount: result.chunksIngested,
            message: `Successfully ingested "${parsed.title}" by ${parsed.channel} (${result.chunksIngested} chunks). Use rag-query with documentId "${result.documentId}" to search this content.`
        };
    }
});

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatForRagIngestion(parsed: ParsedYouTubeVideo, url: string, tags?: string[]): string {
    const tagLine = tags && tags.length > 0 ? `- Tags: ${tags.join(", ")}\n` : "";

    const chaptersSection =
        parsed.chapters.length > 0
            ? `\n## Chapters\n${parsed.chapters.map((c) => `- ${c.timestamp} ${c.title}`).join("\n")}\n`
            : "";

    return `# Video: ${parsed.title}
- Channel: ${parsed.channel}
- Duration: ${parsed.duration}
- URL: ${url}
- Upload Date: ${parsed.uploadDate}
- Views: ${parsed.views}
- Likes: ${parsed.likes}
${tagLine}
## Description
${parsed.description}
${chaptersSection}
## Transcript
${parsed.transcript}
`;
}

function buildFormattedContent(
    parsed: ParsedYouTubeVideo,
    url: string,
    analysisType: string
): string {
    const chaptersBlock =
        parsed.chapters.length > 0
            ? `\n### Chapters\n${parsed.chapters.map((c) => `- **${c.timestamp}** ${c.title}`).join("\n")}\n`
            : "";

    return `# ${parsed.title}
**Channel:** ${parsed.channel} | **Duration:** ${parsed.duration} | **Views:** ${parsed.views}
**URL:** ${url}
**Requested analysis:** ${analysisType}
${chaptersBlock}
### Transcript
${parsed.transcript}
`;
}
