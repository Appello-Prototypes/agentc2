/**
 * Tool Result Compressor Processor
 *
 * Mastra-native output processor that compresses large tool results
 * before they enter the context window. Runs after each LLM step
 * via processOutputStep.
 *
 * Replaces both:
 *   - The resolver's toolResultCompression wrapper (which wrapped tool execute fns)
 *   - managedGenerate's compressToolResult logic
 *
 * Compression strategy (in order of preference):
 *   1. If result fits within threshold: pass through unchanged
 *   2. Truncate long string fields within JSON objects
 *   3. Trim arrays to first 3 items
 *   4. LLM-based semantic compression (if compressionModel provided)
 *   5. Hard truncation as last resort
 */

import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";
import type { LanguageModel } from "ai";
import { compressToolResult } from "./context-utils";

export interface ToolResultCompressorConfig {
    /** Character threshold before compression triggers. Default: 3000 */
    threshold?: number;
    /** LLM model for semantic compression of very large results. */
    compressionModel?: LanguageModel;
}

/**
 * Create a tool result compressor processor.
 *
 * Monitors assistant messages with tool invocation results after each step.
 * When a tool result exceeds the threshold, it's compressed using
 * structural heuristics and optionally LLM summarization.
 */
export function createToolResultCompressorProcessor(
    config?: ToolResultCompressorConfig
): Processor<"tool-result-compressor"> {
    const threshold = config?.threshold ?? 3000;
    const compressionModel = config?.compressionModel;

    return {
        id: "tool-result-compressor" as const,
        name: "Tool Result Compressor",

        async processOutputStep(args: ProcessOutputStepArgs) {
            const { messages, toolCalls } = args;

            // No tool calls = no results to compress
            if (!toolCalls || toolCalls.length === 0) {
                return messages;
            }

            // Look at the most recent messages for tool invocation parts
            // and compress results that exceed the threshold
            let modified = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedMessages: any[] = [];

            for (const msg of messages) {
                if (msg.role !== "assistant" || !msg.content || typeof msg.content !== "object") {
                    updatedMessages.push(msg);
                    continue;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const content = msg.content as any;
                if (!content.parts || content.format !== 2) {
                    updatedMessages.push(msg);
                    continue;
                }

                let partsModified = false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newParts: any[] = [];

                for (const part of content.parts) {
                    if (part.type !== "tool-invocation" || part.result === undefined) {
                        newParts.push(part);
                        continue;
                    }

                    const resultStr =
                        typeof part.result === "string"
                            ? part.result
                            : JSON.stringify(part.result ?? "");

                    if (resultStr.length <= threshold) {
                        newParts.push(part);
                        continue;
                    }

                    // Try structural compression first
                    const compressed = structuralCompress(part.result, threshold);
                    if (compressed !== null) {
                        console.log(
                            `[ToolResultCompressor] Structurally compressed ${part.toolName || "unknown"} result: ${resultStr.length} → ${JSON.stringify(compressed).length} chars`
                        );
                        newParts.push({ ...part, result: compressed });
                        partsModified = true;
                        continue;
                    }

                    // Try LLM compression
                    if (compressionModel) {
                        try {
                            const toolName = part.toolName || "unknown";
                            const compressedText = await compressToolResult(
                                toolName,
                                resultStr,
                                Math.min(threshold, 2000),
                                compressionModel
                            );
                            console.log(
                                `[ToolResultCompressor] LLM-compressed ${toolName} result: ${resultStr.length} → ${compressedText.length} chars`
                            );
                            newParts.push({ ...part, result: compressedText });
                            partsModified = true;
                            continue;
                        } catch {
                            // Fall through to hard truncation
                        }
                    }

                    // Hard truncation as last resort
                    console.log(
                        `[ToolResultCompressor] Hard-truncated ${part.toolName || "unknown"} result: ${resultStr.length} → ${threshold} chars`
                    );
                    newParts.push({
                        ...part,
                        result: {
                            _truncated: true,
                            _originalChars: resultStr.length,
                            content: resultStr.slice(0, threshold)
                        }
                    });
                    partsModified = true;
                }

                if (partsModified) {
                    modified = true;
                    updatedMessages.push({
                        ...msg,
                        content: { ...content, format: 2 as const, parts: newParts }
                    });
                } else {
                    updatedMessages.push(msg);
                }
            }

            return modified ? updatedMessages : messages;
        }
    };
}

/**
 * Attempt structural compression of a JSON result.
 * Returns null if structural compression isn't sufficient.
 */
function structuralCompress(result: unknown, threshold: number): unknown | null {
    if (typeof result !== "object" || result === null) return null;

    try {
        // Step 1: Truncate long string fields
        const truncated = JSON.stringify(result, (_, v) => {
            if (typeof v === "string" && v.length > 500) {
                return v.slice(0, 500) + "…[truncated]";
            }
            return v;
        });
        if (truncated.length <= threshold) return JSON.parse(truncated);

        // Step 2: Trim arrays to 3 items
        const shallow = { ...(result as Record<string, unknown>) };
        for (const [k, v] of Object.entries(shallow)) {
            if (Array.isArray(v) && v.length > 3) {
                shallow[k] = [...v.slice(0, 3), `…[${v.length - 3} more items]`];
            }
        }
        const trimmed = JSON.stringify(shallow);
        if (trimmed.length <= threshold * 1.5) return JSON.parse(trimmed);
    } catch {
        // Structural compression failed
    }

    return null;
}
