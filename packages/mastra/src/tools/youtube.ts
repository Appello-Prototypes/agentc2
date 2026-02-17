import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { YoutubeTranscript } from "youtube-transcript"
import { ingestDocument } from "../rag/pipeline"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INLINE_THRESHOLD = 20_000 // chars – roughly ~15 min of speech

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any YouTube URL variant (or bare video ID) into the canonical
 * `https://www.youtube.com/watch?v=VIDEO_ID` form.
 */
export function normalizeYouTubeUrl(input: string): string {
    const trimmed = input.trim()

    // youtu.be/VIDEO_ID
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`

    // youtube.com/watch?v=VIDEO_ID (already canonical – normalise host)
    const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
    if (watchMatch) return `https://www.youtube.com/watch?v=${watchMatch[1]}`

    // Bare video ID (11 chars, alphanumeric + _ + -)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return `https://www.youtube.com/watch?v=${trimmed}`
    }

    // Fallback: return as-is
    return trimmed
}

/**
 * Extract the video ID from a normalised YouTube URL.
 */
function extractVideoId(url: string): string | null {
    const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// YouTube Data Fetchers (no web scraping required)
// ---------------------------------------------------------------------------

interface YouTubeVideoMetadata {
    title: string
    channel: string
    thumbnailUrl: string
}

/**
 * Fetch video metadata via YouTube's public oEmbed endpoint.
 * No API key required.
 */
async function fetchVideoMetadata(url: string): Promise<YouTubeVideoMetadata> {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const response = await fetch(oembedUrl)
        if (!response.ok) {
            return { title: "", channel: "", thumbnailUrl: "" }
        }
        const data = await response.json()
        return {
            title: (data.title as string) || "",
            channel: (data.author_name as string) || "",
            thumbnailUrl: (data.thumbnail_url as string) || ""
        }
    } catch {
        return { title: "", channel: "", thumbnailUrl: "" }
    }
}

interface TranscriptSegment {
    text: string
    offset: number
    duration: number
}

/**
 * Fetch transcript via the youtube-transcript package.
 * Uses YouTube's internal captions API — no scraping, no API key needed.
 */
async function fetchTranscript(videoIdOrUrl: string): Promise<TranscriptSegment[]> {
    const segments = await YoutubeTranscript.fetchTranscript(videoIdOrUrl)
    return segments.map((s) => ({
        text: s.text,
        offset: s.offset,
        duration: s.duration
    }))
}

/**
 * Convert transcript segments into plain text.
 */
function segmentsToText(segments: TranscriptSegment[]): string {
    return segments.map((s) => s.text).join(" ")
}

/**
 * Convert millisecond offset to HH:MM:SS or MM:SS timestamp.
 */
function msToTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Estimate video duration from the last transcript segment.
 */
function estimateDuration(segments: TranscriptSegment[]): string {
    if (segments.length === 0) return ""
    const last = segments[segments.length - 1]
    return msToTimestamp(last.offset + last.duration)
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
        url: z.string(),
        mode: z.enum(["inline", "rag"]),
        transcript: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        error: z.string().optional()
    }),
    execute: async ({ url }) => {
        const normalizedUrl = normalizeYouTubeUrl(url)
        const videoId = extractVideoId(normalizedUrl) || url

        // Fetch metadata and transcript in parallel
        const [metadata, segments] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(videoId).catch(() => [] as TranscriptSegment[])
        ])

        const base = {
            title: metadata.title,
            channel: metadata.channel,
            duration: estimateDuration(segments),
            url: normalizedUrl
        }

        // No transcript available
        if (segments.length === 0) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: "",
                error: "No transcript available for this video. The video may not have captions enabled."
            }
        }

        const transcriptText = segmentsToText(segments)

        // Short transcript – return inline
        if (transcriptText.length < INLINE_THRESHOLD) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: transcriptText
            }
        }

        // Long transcript – auto-ingest into RAG
        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            estimateDuration(segments),
            normalizedUrl,
            transcriptText
        )
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        })

        return {
            ...base,
            mode: "rag" as const,
            ragDocumentId: ragResult.documentId,
            ragChunkCount: ragResult.chunksIngested
        }
    }
})

// ---------------------------------------------------------------------------
// Tool 2: youtube-search-videos
// ---------------------------------------------------------------------------

export const youtubeSearchVideosTool = createTool({
    id: "youtube-search-videos",
    description:
        "Search YouTube for videos on any topic. Returns a list of matching videos with titles, URLs, and descriptions.",
    inputSchema: z.object({
        query: z
            .string()
            .describe("Search query (e.g. 'AI agent orchestration 2026')"),
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
        const apiKey = process.env.FIRECRAWL_API_KEY
        if (!apiKey) {
            throw new Error("FIRECRAWL_API_KEY is not configured")
        }

        const limit = maxResults ?? 5

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
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Firecrawl search failed (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        const rawResults = Array.isArray(data.data) ? data.data : data.data?.web || []

        const results = rawResults.map((r: Record<string, unknown>) => ({
            title: (r.title as string) || "Untitled",
            url: (r.url as string) || "",
            description: (r.description as string) || (r.snippet as string) || ""
        }))

        return {
            results,
            resultCount: results.length
        }
    }
})

// ---------------------------------------------------------------------------
// Tool 3: youtube-analyze-video
// ---------------------------------------------------------------------------

export const youtubeAnalyzeVideoTool = createTool({
    id: "youtube-analyze-video",
    description:
        "Extract a YouTube video transcript with timestamps and metadata, formatted for analysis. For short videos the formatted content is returned inline. For long videos the content is auto-ingested into the knowledge base. The LLM then performs the actual analysis (summarisation, key points, etc.) using the returned data.",
    inputSchema: z.object({
        url: z
            .string()
            .describe("YouTube video URL or video ID"),
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
        mode: z.enum(["inline", "rag"]),
        formattedContent: z.string().optional(),
        ragDocumentId: z.string().optional(),
        ragChunkCount: z.number().optional(),
        analysisType: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ url, analysisType }) => {
        const normalizedUrl = normalizeYouTubeUrl(url)
        const videoId = extractVideoId(normalizedUrl) || url
        const type = analysisType || "full"

        const [metadata, segments] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(videoId).catch(() => [] as TranscriptSegment[])
        ])

        const base = {
            title: metadata.title,
            channel: metadata.channel,
            duration: estimateDuration(segments),
            analysisType: type
        }

        if (segments.length === 0) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: "",
                error: "No transcript available for this video."
            }
        }

        // Build timestamped transcript for analysis
        const timestampedTranscript = buildTimestampedTranscript(segments)
        const formatted = `# ${metadata.title}\n**Channel:** ${metadata.channel} | **Duration:** ${estimateDuration(segments)}\n**URL:** ${normalizedUrl}\n**Requested analysis:** ${type}\n\n### Transcript\n${timestampedTranscript}\n`

        if (formatted.length < INLINE_THRESHOLD) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: formatted
            }
        }

        // Long content – ingest to RAG
        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            estimateDuration(segments),
            normalizedUrl,
            segmentsToText(segments)
        )
        const ragResult = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        })

        return {
            ...base,
            mode: "rag" as const,
            ragDocumentId: ragResult.documentId,
            ragChunkCount: ragResult.chunksIngested
        }
    }
})

// ---------------------------------------------------------------------------
// Tool 4: youtube-ingest-to-knowledge
// ---------------------------------------------------------------------------

export const youtubeIngestToKnowledgeTool = createTool({
    id: "youtube-ingest-to-knowledge",
    description:
        "Extract a YouTube video transcript and ingest the full content into the RAG knowledge base for later semantic search. Always ingests the complete transcript regardless of length. Use this to build a searchable library of expert knowledge from YouTube videos.",
    inputSchema: z.object({
        url: z
            .string()
            .describe("YouTube video URL or video ID"),
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
        const normalizedUrl = normalizeYouTubeUrl(url)
        const videoId = extractVideoId(normalizedUrl) || url

        const [metadata, segments] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscript(videoId).catch(() => [] as TranscriptSegment[])
        ])

        if (segments.length === 0) {
            return {
                documentId: "",
                title: metadata.title || "Unknown",
                channel: metadata.channel || "Unknown",
                chunkCount: 0,
                message: "",
                error: "No transcript available for this video. Cannot ingest."
            }
        }

        const transcriptText = segmentsToText(segments)
        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
            estimateDuration(segments),
            normalizedUrl,
            transcriptText,
            tags
        )

        const result = await ingestDocument(ragContent, {
            type: "markdown",
            sourceId: `youtube:${videoId}`,
            sourceName: `${metadata.channel} - ${metadata.title}`,
            chunkOptions: { strategy: "markdown", maxSize: 1024, overlap: 100 }
        })

        return {
            documentId: result.documentId,
            title: metadata.title,
            channel: metadata.channel,
            chunkCount: result.chunksIngested,
            message: `Successfully ingested "${metadata.title}" by ${metadata.channel} (${result.chunksIngested} chunks). Use rag-query with documentId "${result.documentId}" to search this content.`
        }
    }
})

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatForRagIngestion(
    title: string,
    channel: string,
    duration: string,
    url: string,
    transcriptText: string,
    tags?: string[]
): string {
    const tagLine = tags && tags.length > 0 ? `- Tags: ${tags.join(", ")}\n` : ""

    return `# Video: ${title}
- Channel: ${channel}
- Duration: ${duration}
- URL: ${url}
${tagLine}
## Transcript
${transcriptText}
`
}

function buildTimestampedTranscript(segments: TranscriptSegment[]): string {
    // Group segments into ~30-second blocks for readability
    const blocks: string[] = []
    let currentBlock = ""
    let blockStartMs = 0

    for (const segment of segments) {
        if (currentBlock === "") {
            blockStartMs = segment.offset
        }

        currentBlock += segment.text + " "

        // Emit block every ~30 seconds
        if (segment.offset - blockStartMs > 30_000) {
            blocks.push(`[${msToTimestamp(blockStartMs)}] ${currentBlock.trim()}`)
            currentBlock = ""
        }
    }

    // Emit final block
    if (currentBlock.trim()) {
        blocks.push(`[${msToTimestamp(blockStartMs)}] ${currentBlock.trim()}`)
    }

    return blocks.join("\n\n")
}
