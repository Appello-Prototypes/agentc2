import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ingestDocument } from "../rag/pipeline";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INLINE_THRESHOLD = 20_000; // chars – roughly ~15 min of speech
const SUPADATA_BASE = "https://api.supadata.ai/v1/transcript";
const MIN_CALL_INTERVAL_MS = 200; // 200ms — paid tier allows higher throughput
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

// ---------------------------------------------------------------------------
// Supadata rate-limit throttle (paid plan)
// ---------------------------------------------------------------------------

let lastSupadataCall = 0;

async function throttleSupadata(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastSupadataCall;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
    }
    lastSupadataCall = Date.now();
}

// ---------------------------------------------------------------------------
// URL Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any YouTube URL variant (or bare video ID) into the canonical
 * `https://www.youtube.com/watch?v=VIDEO_ID` form.
 */
export function normalizeYouTubeUrl(input: string): string {
    const trimmed = input.trim();

    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`;

    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;

    const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return `https://www.youtube.com/watch?v=${watchMatch[1]}`;

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return `https://www.youtube.com/watch?v=${trimmed}`;
    }

    return trimmed;
}

function extractVideoId(url: string): string | null {
    const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Supadata Transcript API
// ---------------------------------------------------------------------------

/**
 * Fetch transcript via the Supadata API.
 *
 * Supadata handles YouTube's anti-bot measures with residential proxies and
 * AI fallback for videos without native captions.
 * Requires SUPADATA_API_KEY environment variable.
 *
 * Free tier: 100 transcripts/month. Pro: 3,000 for $17/month.
 * https://supadata.ai
 */
async function fetchTranscript(
    videoUrl: string
): Promise<{ content: string; lang: string } | null> {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
        throw new Error(
            "SUPADATA_API_KEY is not configured. Add the Supadata integration in Settings > Integrations, or set the SUPADATA_API_KEY environment variable. Sign up free at https://supadata.ai"
        );
    }

    const encodedUrl = encodeURIComponent(videoUrl);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        await throttleSupadata();

        const response = await fetch(`${SUPADATA_BASE}?url=${encodedUrl}&text=true&mode=auto`, {
            headers: { "x-api-key": apiKey }
        });

        // Async job for long videos (>20 min) — poll for result
        if (response.status === 202) {
            const { jobId } = await response.json();
            return await pollTranscriptJob(apiKey, jobId);
        }

        // Rate-limited — back off and retry
        if (response.status === 429 && attempt < MAX_RETRIES) {
            console.warn(
                `[YouTube] Supadata rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms…`
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = (errData as Record<string, string>).message || `HTTP ${response.status}`;
            throw new Error(`Supadata transcript fetch failed: ${msg}`);
        }

        const data = await response.json();
        return {
            content: (data.content as string) || "",
            lang: (data.lang as string) || "en"
        };
    }

    throw new Error("Supadata transcript fetch failed: max retries exceeded");
}

/**
 * Poll a Supadata async transcript job until complete.
 * Long videos (>20 min) are processed asynchronously.
 */
async function pollTranscriptJob(
    apiKey: string,
    jobId: string,
    maxAttempts = 90
): Promise<{ content: string; lang: string } | null> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const res = await fetch(`${SUPADATA_BASE}/${jobId}`, {
            headers: { "x-api-key": apiKey }
        });
        if (!res.ok) continue;

        const data = await res.json();
        if (data.status === "completed") {
            return {
                content: (data.content as string) || "",
                lang: (data.lang as string) || "en"
            };
        }
        if (data.status === "failed") return null;
    }
    return null;
}

// ---------------------------------------------------------------------------
// YouTube Metadata (oEmbed — free, public, no API key)
// ---------------------------------------------------------------------------

interface YouTubeVideoMetadata {
    title: string;
    channel: string;
}

async function fetchVideoMetadata(url: string): Promise<YouTubeVideoMetadata> {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl);
        if (!response.ok) return { title: "", channel: "" };
        const data = await response.json();
        return {
            title: (data.title as string) || "",
            channel: (data.author_name as string) || ""
        };
    } catch (error) {
        console.error("[YouTube] Failed to fetch video metadata via oEmbed:", error);
        return { title: "", channel: "" };
    }
}

// ---------------------------------------------------------------------------
// Tool 1: youtube-get-transcript
// ---------------------------------------------------------------------------

export const youtubeGetTranscriptTool = createTool({
    id: "youtube-get-transcript",
    description:
        "Extract the full transcript and metadata from a YouTube video. Accepts any YouTube URL format or a bare video ID. For short videos the transcript is returned inline. For long videos the transcript is automatically ingested into the knowledge base and a document ID is returned for targeted RAG queries. Powered by Supadata — requires SUPADATA_API_KEY.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID (auto-injected by platform)")
    }),
    outputSchema: z.object({
        title: z.string(),
        channel: z.string(),
        url: z.string(),
        mode: z.enum(["inline", "rag"]),
        transcript: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({ url, organizationId }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;

        const [metadata, transcriptResult] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(normalizedUrl).catch((e: Error) => ({
                content: "",
                lang: "en",
                _error: e.message
            }))
        ]);

        const base = { title: metadata.title, channel: metadata.channel, url: normalizedUrl };
        const errorMsg = (transcriptResult as Record<string, string>)?._error || undefined;
        const transcriptText = transcriptResult?.content || "";

        if (!transcriptText || transcriptText.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: "",
                error:
                    errorMsg ||
                    "No transcript available for this video. The video may not have captions enabled."
            };
        }

        // Short transcript — return inline
        if (transcriptText.length < INLINE_THRESHOLD) {
            return { ...base, mode: "inline" as const, transcript: transcriptText };
        }

        // Long transcript — auto-ingest into RAG for efficient retrieval
        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            normalizedUrl,
            transcriptText
        );
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 },
            organizationId
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
        "Search YouTube for videos on any topic. Returns a list of matching videos with titles, URLs, and descriptions. Uses Firecrawl search with YouTube scoping.",
    inputSchema: z.object({
        query: z.string().describe("Search query (e.g. 'AI agent orchestration 2026')"),
        maxResults: z
            .number()
            .min(1)
            .max(10)
            .optional()
            .describe("Maximum number of results (default 5, max 10)")
    }),
    outputSchema: z.object({
        results: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })),
        resultCount: z.number()
    }),
    execute: async ({ query, maxResults }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

        const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ query: `${query} site:youtube.com`, limit: maxResults ?? 5 })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Search failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const rawResults = Array.isArray(data.data) ? data.data : data.data?.web || [];
        const results = rawResults.map((r: Record<string, unknown>) => ({
            title: (r.title as string) || "Untitled",
            url: (r.url as string) || "",
            description: (r.description as string) || (r.snippet as string) || ""
        }));

        return { results, resultCount: results.length };
    }
});

// ---------------------------------------------------------------------------
// Tool 3: youtube-analyze-video
// ---------------------------------------------------------------------------

export const youtubeAnalyzeVideoTool = createTool({
    id: "youtube-analyze-video",
    description:
        "Extract a YouTube video transcript with metadata, formatted for analysis. For short videos content is returned inline. For long videos it is auto-ingested into the knowledge base. The LLM performs the actual analysis using the returned data.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        analysisType: z
            .enum(["summary", "key-points", "action-items", "full"])
            .optional()
            .describe("Kind of analysis the agent should perform (default: full)"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID (auto-injected by platform)")
    }),
    outputSchema: z.object({
        title: z.string(),
        channel: z.string(),
        mode: z.enum(["inline", "rag"]),
        formattedContent: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        analysisType: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ url, analysisType, organizationId }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;
        const type = analysisType || "full";

        const [metadata, transcriptResult] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(normalizedUrl).catch((error) => {
                console.error("[YouTube] Transcript fetch failed for analysis:", error);
                return null;
            })
        ]);

        const base = { title: metadata.title, channel: metadata.channel, analysisType: type };

        if (!transcriptResult?.content || transcriptResult.content.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: "",
                error: "No transcript available for this video."
            };
        }

        const formatted = `# ${metadata.title}\n**Channel:** ${metadata.channel}\n**URL:** ${normalizedUrl}\n**Requested analysis:** ${type}\n\n### Transcript\n${transcriptResult.content}\n`;

        if (formatted.length < INLINE_THRESHOLD) {
            return { ...base, mode: "inline" as const, formattedContent: formatted };
        }

        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            normalizedUrl,
            transcriptResult.content
        );
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 },
            organizationId
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
        "Extract a YouTube video transcript and ingest the full content into the RAG knowledge base for later semantic search. Always ingests the complete transcript regardless of length. Use this to build a searchable library of expert knowledge from YouTube videos.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        tags: z.array(z.string()).optional().describe("Optional tags (e.g. ['AI', 'agents'])"),
        organizationId: z
            .string()
            .optional()
            .describe("Organization ID (auto-injected by platform)")
    }),
    outputSchema: z.object({
        documentId: z.string(),
        title: z.string(),
        channel: z.string(),
        chunkCount: z.number(),
        message: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ url, tags, organizationId }) => {
        const normalizedUrl = normalizeYouTubeUrl(url);
        const videoId = extractVideoId(normalizedUrl) || url;

        const [metadata, transcriptResult] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(normalizedUrl).catch((error) => {
                console.error("[YouTube] Transcript fetch failed for ingestion:", error);
                return null;
            })
        ]);

        if (!transcriptResult?.content || transcriptResult.content.length < 20) {
            return {
                documentId: "",
                title: metadata.title || "Unknown",
                channel: metadata.channel || "Unknown",
                chunkCount: 0,
                message: "",
                error: "No transcript available for this video. Cannot ingest."
            };
        }

        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            normalizedUrl,
            transcriptResult.content,
            tags
        );

        const result = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 },
            organizationId
        });

        return {
            documentId: result.documentId,
            title: metadata.title,
            channel: metadata.channel,
            chunkCount: result.chunksIngested,
            message: `Successfully ingested "${metadata.title}" by ${metadata.channel} (${result.chunksIngested} chunks). Use rag-query with documentId "${result.documentId}" to search this content.`
        };
    }
});

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatForRagIngestion(
    title: string,
    channel: string,
    url: string,
    transcriptText: string,
    tags?: string[]
): string {
    const tagLine = tags && tags.length > 0 ? `- Tags: ${tags.join(", ")}\n` : "";

    return `# Video: ${title}
- Channel: ${channel}
- URL: ${url}
${tagLine}
## Transcript
${transcriptText}
`;
}
