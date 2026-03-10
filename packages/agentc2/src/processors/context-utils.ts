/**
 * Context Utilities
 *
 * Shared helper functions extracted from managed-generate.ts for use
 * across the unified context management processors.
 */

import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";

// ── Token Counting ──────────────────────────────────────────────────────────

let _encoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder(): ReturnType<typeof encodingForModel> {
    if (!_encoder) {
        try {
            _encoder = encodingForModel("gpt-4o" as TiktokenModel);
        } catch {
            _encoder = encodingForModel("gpt-4" as TiktokenModel);
        }
    }
    return _encoder;
}

/**
 * Estimate the number of tokens in a string using tiktoken.
 * Falls back to a character-based approximation on error.
 */
export function countTokens(text: string): number {
    try {
        return getEncoder().encode(text).length;
    } catch {
        return Math.ceil(text.length / 4);
    }
}

// ── String Utilities ────────────────────────────────────────────────────────

/**
 * Truncate a value to a maximum length, appending "..." if truncated.
 */
export function preview(value: unknown, maxLen: number = 200): string {
    if (value === null || value === undefined) return "(empty)";
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + "...";
}

// ── Tool Call Resolution ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveToolName(value?: any): string | undefined {
    return (
        value?.toolName ||
        value?.name ||
        value?.tool ||
        value?.function?.name ||
        value?.payload?.toolName ||
        value?.payload?.tool ||
        value?.payload?.name ||
        value?.payload?.function?.name
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveToolArgs(value?: any): unknown {
    return (
        value?.args ??
        value?.input ??
        value?.arguments ??
        value?.function?.arguments ??
        value?.payload?.args ??
        value?.payload?.arguments
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveToolResult(value?: any): unknown {
    return value?.result ?? value?.output ?? value?.payload?.result;
}

// ── Tool Call Summary ───────────────────────────────────────────────────────

export interface ToolCallRecord {
    step: number;
    toolName: string;
    inputPreview: string;
    outputPreview: string;
}

/**
 * Build a compact one-line summary of a tool call for context compaction.
 */
export function buildToolCallSummary(record: ToolCallRecord): string {
    return `[Step ${record.step}: ${record.toolName}(${record.inputPreview}) → ${record.outputPreview}]`;
}

// ── Semantic Compression ────────────────────────────────────────────────────

const compressionCache = new Map<string, string>();

/**
 * Simple hash for caching compressed results.
 */
export function hashForCache(input: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(input.length, 500); i++) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return `${hash}_${input.length}`;
}

/**
 * Compress a large tool result using an LLM.
 * Results are cached by content hash.
 */
export async function compressToolResult(
    toolName: string,
    result: string,
    maxOutputChars: number,
    compressionModel: LanguageModel
): Promise<string> {
    const cacheKey = hashForCache(result);
    const cached = compressionCache.get(cacheKey);
    if (cached) return cached;

    try {
        const { text } = await generateText({
            model: compressionModel,
            prompt: [
                `Summarize this tool output from "${toolName}".`,
                `Preserve all data values, IDs, names, status codes, URLs, and actionable information.`,
                `Remove formatting, boilerplate, HTML, and redundant fields.`,
                `Keep it under ${maxOutputChars} characters.\n\n`,
                result
            ].join(" ")
        });

        const compressed = text || result.substring(0, maxOutputChars);
        compressionCache.set(cacheKey, compressed);

        // Evict old entries to prevent unbounded growth
        if (compressionCache.size > 200) {
            const firstKey = compressionCache.keys().next().value;
            if (firstKey) compressionCache.delete(firstKey);
        }

        return compressed;
    } catch (error) {
        console.warn(
            `[ContextUtils] Compression failed for ${toolName}, falling back to truncation:`,
            error instanceof Error ? error.message : error
        );
        return result.substring(0, maxOutputChars) + "...[truncated]";
    }
}

// ── Shared Types ────────────────────────────────────────────────────────────

export interface ContextConfig {
    maxContextTokens?: number;
    windowSize?: number;
    anchorInstructions?: boolean;
    anchorInterval?: number;
    toolResultCompression?: {
        enabled?: boolean;
        threshold?: number;
    };
}
