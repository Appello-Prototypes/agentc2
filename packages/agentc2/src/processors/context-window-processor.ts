/**
 * Context Window Processor
 *
 * Mastra-native input processor that implements sliding-window context
 * management with optional conversation compaction. Runs at every step
 * of the agentic loop via processInputStep.
 *
 * Replaces the context windowing logic from managedGenerate, applying it
 * uniformly across both streaming (agent.stream) and non-streaming
 * (agent.generate) execution paths.
 *
 * Behavior:
 *   1. Always preserves the first user message (original request)
 *   2. When messages exceed windowSize * 2, older exchanges are
 *      summarized into a compact "[Conversation summary]" message
 *   3. Token budget is enforced — if over maxContextTokens, middle
 *      messages are dropped until within budget
 */

import type {
    Processor,
    ProcessInputStepArgs,
    ProcessInputStepResult
} from "@mastra/core/processors";
import { countTokens } from "./context-utils";
import { compactMessages } from "./conversation-compactor";
import type { LanguageModel } from "ai";

export interface ContextWindowConfig {
    /** Number of recent assistant+user exchange pairs to keep in full. Default: 5 */
    windowSize: number;
    /** Maximum estimated tokens for the context window. Default: 50_000 */
    maxContextTokens: number;
    /** Whether to generate an LLM summary of dropped messages. Default: true */
    enableCompaction: boolean;
    /** LLM model to use for compaction summaries. */
    compactionModel?: LanguageModel;
    /** Organization ID for model resolution. */
    organizationId?: string;
}

interface ContextWindowState {
    /** Whether we've already compacted in this request */
    lastCompactedAt: number;
}

/**
 * Create a context window processor that manages message history size.
 *
 * Uses processInputStep to run at every step of the agentic loop,
 * keeping the context window within budget while preserving the
 * original user request and recent conversation history.
 */
export function createContextWindowProcessor(config: {
    windowSize?: number;
    maxContextTokens?: number;
    enableCompaction?: boolean;
    compactionModel?: LanguageModel;
    organizationId?: string;
}): Processor<"context-window"> {
    const windowSize = config.windowSize ?? 5;
    const maxContextTokens = config.maxContextTokens ?? 50_000;
    const enableCompaction = config.enableCompaction ?? true;
    const compactionModel = config.compactionModel;

    return {
        id: "context-window" as const,
        name: "Context Window",

        async processInputStep(
            args: ProcessInputStepArgs
        ): Promise<ProcessInputStepResult | undefined> {
            const { messages, state } = args;
            const cwState = state as unknown as ContextWindowState;

            // Only process if we have enough messages to warrant windowing
            // windowSize * 2 accounts for user+assistant pairs
            const threshold = windowSize * 2 + 2; // +2 for original message + some buffer
            if (messages.length <= threshold) {
                return undefined;
            }

            // Estimate total context size
            let totalTokens = 0;
            for (const msg of messages) {
                const text = extractMessageText(msg);
                totalTokens += countTokens(text);
            }

            // Add system messages to the token count
            if (args.systemMessages) {
                for (const sysMsg of args.systemMessages) {
                    const text =
                        typeof sysMsg.content === "string"
                            ? sysMsg.content
                            : JSON.stringify(sysMsg.content);
                    totalTokens += countTokens(text);
                }
            }

            // If within budget, no action needed
            if (totalTokens <= maxContextTokens) {
                return undefined;
            }

            console.log(
                `[ContextWindow] Step ${args.stepNumber}: ${messages.length} messages, ~${totalTokens} tokens (budget: ${maxContextTokens}). Compacting...`
            );

            // Find the first user message (original request) — always preserve it
            const firstUserIdx = messages.findIndex((m) => m.role === "user");
            if (firstUserIdx === -1) return undefined;

            // Split messages into:
            //   - firstUser: the original request (always kept)
            //   - middle: older exchanges that can be compacted/dropped
            //   - recent: last windowSize * 2 messages (always kept)
            const recentStart = Math.max(firstUserIdx + 1, messages.length - windowSize * 2);
            const firstUser = messages[firstUserIdx]!;
            const middle = messages.slice(firstUserIdx + 1, recentStart);
            const recent = messages.slice(recentStart);

            if (middle.length === 0) {
                // Nothing to compact — the window is already just first + recent
                return undefined;
            }

            // Build compacted messages
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const compactedMessages: any[] = [firstUser];

            // Try LLM-based compaction if enabled and we haven't compacted too recently
            const stepsSinceCompact = args.stepNumber - (cwState.lastCompactedAt ?? -1);
            if (enableCompaction && compactionModel && stepsSinceCompact >= 3) {
                try {
                    const { summary } = await compactMessages(middle, {
                        targetTokens: Math.min(500, Math.floor(maxContextTokens * 0.05)),
                        model: compactionModel
                    });
                    cwState.lastCompactedAt = args.stepNumber;
                    console.log(
                        `[ContextWindow] Compacted ${middle.length} messages into ${summary.length}-char summary`
                    );

                    // Insert summary as a user message
                    compactedMessages.push({
                        id: `compaction-${Date.now()}`,
                        role: "user" as const,
                        createdAt: new Date(),
                        content: {
                            format: 2 as const,
                            parts: [
                                {
                                    type: "text" as const,
                                    text: `[Conversation summary of ${middle.length} earlier messages]\n${summary}`
                                }
                            ]
                        }
                    });
                } catch (err) {
                    console.warn(
                        "[ContextWindow] Compaction failed, falling back to truncation:",
                        err
                    );
                    // Fall through to simple truncation below
                    const summaryLines = middle.map((m, i) => {
                        const text = extractMessageText(m);
                        const preview = text.length > 80 ? text.substring(0, 80) + "..." : text;
                        return `  ${m.role}[${i}]: ${preview}`;
                    });
                    compactedMessages.push({
                        id: `compaction-${Date.now()}`,
                        role: "user" as const,
                        createdAt: new Date(),
                        content: {
                            format: 2 as const,
                            parts: [
                                {
                                    type: "text" as const,
                                    text: `[Earlier conversation - ${middle.length} messages dropped]\n${summaryLines.join("\n")}`
                                }
                            ]
                        }
                    });
                }
            } else {
                // Simple truncation: just summarize what was dropped
                const summaryLines = middle.map((m, i) => {
                    const text = extractMessageText(m);
                    const preview = text.length > 80 ? text.substring(0, 80) + "..." : text;
                    return `  ${m.role}[${i}]: ${preview}`;
                });
                compactedMessages.push({
                    id: `compaction-${Date.now()}`,
                    role: "user" as const,
                    createdAt: new Date(),
                    content: {
                        format: 2 as const,
                        parts: [
                            {
                                type: "text" as const,
                                text: `[Earlier conversation - ${middle.length} messages summarized]\n${summaryLines.join("\n")}`
                            }
                        ]
                    }
                });
            }

            // Add recent messages
            compactedMessages.push(...recent);

            return { messages: compactedMessages };
        }
    };
}

/**
 * Extract plain text content from a MastraDBMessage.
 */
function extractMessageText(msg: { content: unknown }): string {
    const content = msg.content;
    if (typeof content === "string") return content;

    // MastraMessageContentV2 format
    if (content && typeof content === "object" && "parts" in content) {
        const parts = (content as { parts: Array<{ type: string; text?: string }> }).parts;
        return parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text!)
            .join(" ");
    }

    // Fallback
    return JSON.stringify(content);
}
