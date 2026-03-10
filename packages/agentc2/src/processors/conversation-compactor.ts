/**
 * Conversation Compactor
 *
 * Generates LLM-powered summaries of message sequences that are being
 * dropped from the context window. Preserves key information (decisions,
 * tool results, user requests) while removing verbosity.
 *
 * Used by ContextWindowProcessor when enableCompaction is true.
 */

import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { countTokens } from "./context-utils";

export interface CompactionResult {
    /** Generated summary of the dropped messages */
    summary: string;
    /** Number of messages that were compacted */
    droppedCount: number;
}

/**
 * Generate a structured summary of messages being dropped from context.
 *
 * Preserves:
 *   - User requests and questions
 *   - Decisions made by the agent
 *   - Tool results that led to actions or decisions
 *   - Key data points (IDs, names, counts)
 *
 * Drops:
 *   - Intermediate tool calls that didn't produce useful results
 *   - Failed attempts and retries
 *   - Verbose JSON responses
 *   - Repeated or redundant information
 */
export async function compactMessages(
    messages: Array<{ role: string; content: unknown }>,
    options: {
        targetTokens: number;
        model?: LanguageModel;
    }
): Promise<CompactionResult> {
    const { targetTokens, model } = options;

    if (!model || messages.length === 0) {
        return {
            summary: `(${messages.length} earlier messages omitted)`,
            droppedCount: messages.length
        };
    }

    // Build a condensed representation of the messages for the summarizer
    const messageTexts = messages.map((m, i) => {
        const text = extractText(m.content);
        // Cap each message at 500 chars for the summarizer input
        const truncated = text.length > 500 ? text.substring(0, 500) + "..." : text;
        return `[${i + 1}] ${m.role}: ${truncated}`;
    });

    const inputText = messageTexts.join("\n");

    // Don't bother with LLM if the input is tiny
    if (countTokens(inputText) < targetTokens) {
        return {
            summary: inputText,
            droppedCount: messages.length
        };
    }

    try {
        const { text } = await generateText({
            model,
            prompt: [
                `Summarize this conversation excerpt into a concise summary of ${targetTokens} tokens or fewer.`,
                `Preserve: user requests, agent decisions, important tool results (IDs, names, data points).`,
                `Drop: verbose JSON, intermediate failed tool calls, redundant information.`,
                `Format as a brief narrative paragraph, not a list.\n\n`,
                inputText
            ].join(" ")
        });

        return {
            summary: text || `(${messages.length} earlier messages compacted)`,
            droppedCount: messages.length
        };
    } catch (error) {
        console.warn(
            "[ConversationCompactor] LLM summarization failed:",
            error instanceof Error ? error.message : error
        );
        // Fallback: simple truncation
        return {
            summary: `(${messages.length} earlier messages - summarization failed)`,
            droppedCount: messages.length
        };
    }
}

function extractText(content: unknown): string {
    if (typeof content === "string") return content;
    if (content && typeof content === "object" && "parts" in content) {
        const parts = (content as { parts: Array<{ type: string; text?: string }> }).parts;
        return parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text!)
            .join(" ");
    }
    return JSON.stringify(content);
}
