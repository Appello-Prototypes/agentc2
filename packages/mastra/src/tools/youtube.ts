import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { execFile } from "node:child_process"
import { readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { ingestDocument } from "../rag/pipeline"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INLINE_THRESHOLD = 20_000 // chars – roughly ~15 min of speech

// ---------------------------------------------------------------------------
// URL Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any YouTube URL variant (or bare video ID) into the canonical
 * `https://www.youtube.com/watch?v=VIDEO_ID` form.
 */
export function normalizeYouTubeUrl(input: string): string {
    const trimmed = input.trim()

    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`

    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`

    const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
    if (watchMatch) return `https://www.youtube.com/watch?v=${watchMatch[1]}`

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return `https://www.youtube.com/watch?v=${trimmed}`
    }

    return trimmed
}

function extractVideoId(url: string): string | null {
    const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// yt-dlp Transcript Extraction
// ---------------------------------------------------------------------------

/**
 * Run yt-dlp to download auto-generated or manual subtitles as VTT,
 * then parse the VTT into clean plain text.
 *
 * Requires `yt-dlp` to be installed on the system (pip install yt-dlp).
 * No API keys, no paid services, no rate limits.
 */
async function fetchTranscriptWithYtDlp(videoUrl: string): Promise<string> {
    const tmpBase = join(tmpdir(), `yt-${randomBytes(6).toString("hex")}`)
    const expectedFile = `${tmpBase}.en.vtt`

    try {
        await new Promise<void>((resolve, reject) => {
            execFile(
                "yt-dlp",
                [
                    "--write-auto-sub",
                    "--sub-lang",
                    "en",
                    "--skip-download",
                    "--sub-format",
                    "vtt",
                    "-o",
                    tmpBase,
                    videoUrl
                ],
                { timeout: 30_000 },
                (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(`yt-dlp failed: ${stderr || error.message}`))
                    } else {
                        resolve()
                    }
                }
            )
        })

        const vtt = await readFile(expectedFile, "utf-8")
        return parseVttToText(vtt)
    } finally {
        // Clean up temp file
        await unlink(expectedFile).catch(() => {})
    }
}

/**
 * Parse WebVTT subtitle content into clean, deduplicated plain text.
 * Strips timestamps, VTT tags, position metadata, and removes the
 * duplicate lines that auto-generated captions produce.
 */
function parseVttToText(vtt: string): string {
    const lines = vtt
        // Strip VTT header (everything before the first double newline)
        .replace(/WEBVTT[\s\S]*?\n\n/, "")
        // Strip inline timestamp tags like <00:00:01.234>
        .replace(/<[^>]+>/g, "")
        // Strip timestamp lines
        .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n/g, "")
        // Strip alignment/position metadata
        .replace(/align:.*$/gm, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

    // Deduplicate consecutive identical lines (auto-captions repeat each line)
    const deduped: string[] = []
    for (const line of lines) {
        if (deduped[deduped.length - 1] !== line) {
            deduped.push(line)
        }
    }

    return deduped.join(" ")
}

// ---------------------------------------------------------------------------
// YouTube Metadata (oEmbed — free, no API key)
// ---------------------------------------------------------------------------

interface YouTubeVideoMetadata {
    title: string
    channel: string
}

async function fetchVideoMetadata(url: string): Promise<YouTubeVideoMetadata> {
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const response = await fetch(oembedUrl)
        if (!response.ok) return { title: "", channel: "" }
        const data = await response.json()
        return {
            title: (data.title as string) || "",
            channel: (data.author_name as string) || ""
        }
    } catch {
        return { title: "", channel: "" }
    }
}

// ---------------------------------------------------------------------------
// Tool 1: youtube-get-transcript
// ---------------------------------------------------------------------------

export const youtubeGetTranscriptTool = createTool({
    id: "youtube-get-transcript",
    description:
        "Extract the full transcript and metadata from a YouTube video using yt-dlp. Accepts any YouTube URL format or a bare video ID. For short videos the transcript is returned inline. For long videos the transcript is automatically ingested into the knowledge base and a document ID is returned for targeted RAG queries.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID")
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
    execute: async ({ url }) => {
        const normalizedUrl = normalizeYouTubeUrl(url)
        const videoId = extractVideoId(normalizedUrl) || url

        const [metadata, transcriptText] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscriptWithYtDlp(normalizedUrl).catch((e: Error) => e.message)
        ])

        const base = { title: metadata.title, channel: metadata.channel, url: normalizedUrl }

        // yt-dlp returned an error string instead of transcript
        const isError = transcriptText.startsWith("yt-dlp failed:")
        if (isError || !transcriptText || transcriptText.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                transcript: "",
                error: isError
                    ? transcriptText
                    : "No transcript available for this video. The video may not have captions enabled."
            }
        }

        // Short transcript – return inline
        if (transcriptText.length < INLINE_THRESHOLD) {
            return { ...base, mode: "inline" as const, transcript: transcriptText }
        }

        // Long transcript – auto-ingest into RAG
        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
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
        query: z.string().describe("Search query (e.g. 'AI agent orchestration 2026')"),
        maxResults: z
            .number()
            .min(1)
            .max(10)
            .optional()
            .describe("Maximum number of results (default 5, max 10)")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({ title: z.string(), url: z.string(), description: z.string() })
        ),
        resultCount: z.number()
    }),
    execute: async ({ query, maxResults }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY
        if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured")

        const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ query: `${query} site:youtube.com`, limit: maxResults ?? 5 })
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

        return { results, resultCount: results.length }
    }
})

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
            .describe("Kind of analysis the agent should perform (default: full)")
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
    execute: async ({ url, analysisType }) => {
        const normalizedUrl = normalizeYouTubeUrl(url)
        const videoId = extractVideoId(normalizedUrl) || url
        const type = analysisType || "full"

        const [metadata, transcriptText] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscriptWithYtDlp(normalizedUrl).catch(() => "")
        ])

        const base = { title: metadata.title, channel: metadata.channel, analysisType: type }

        if (!transcriptText || transcriptText.length < 20) {
            return {
                ...base,
                mode: "inline" as const,
                formattedContent: "",
                error: "No transcript available for this video."
            }
        }

        const formatted = `# ${metadata.title}\n**Channel:** ${metadata.channel}\n**URL:** ${normalizedUrl}\n**Requested analysis:** ${type}\n\n### Transcript\n${transcriptText}\n`

        if (formatted.length < INLINE_THRESHOLD) {
            return { ...base, mode: "inline" as const, formattedContent: formatted }
        }

        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
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
// Tool 4: youtube-ingest-to-knowledge
// ---------------------------------------------------------------------------

export const youtubeIngestToKnowledgeTool = createTool({
    id: "youtube-ingest-to-knowledge",
    description:
        "Extract a YouTube video transcript and ingest the full content into the RAG knowledge base for later semantic search. Always ingests the complete transcript regardless of length.",
    inputSchema: z.object({
        url: z.string().describe("YouTube video URL or video ID"),
        tags: z.array(z.string()).optional().describe("Optional tags (e.g. ['AI', 'agents'])")
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

        const [metadata, transcriptText] = await Promise.all([
            fetchVideoMetadata(normalizedUrl),
            fetchTranscriptWithYtDlp(normalizedUrl).catch(() => "")
        ])

        if (!transcriptText || transcriptText.length < 20) {
            return {
                documentId: "",
                title: metadata.title || "Unknown",
                channel: metadata.channel || "Unknown",
                chunkCount: 0,
                message: "",
                error: "No transcript available for this video. Cannot ingest."
            }
        }

        const ragContent = formatForRagIngestion(
            metadata.title,
            metadata.channel,
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
    url: string,
    transcriptText: string,
    tags?: string[]
): string {
    const tagLine = tags && tags.length > 0 ? `- Tags: ${tags.join(", ")}\n` : ""

    return `# Video: ${title}
- Channel: ${channel}
- URL: ${url}
${tagLine}
## Transcript
${transcriptText}
`
}
