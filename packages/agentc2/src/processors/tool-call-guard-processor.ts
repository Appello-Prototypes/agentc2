/**
 * Tool Call Guard Processor
 *
 * Mastra-native output processor that consolidates tool guardrails from
 * managedGenerate into a single processor. Runs after each LLM step
 * via processOutputStep.
 *
 * Guards against:
 *   - Per-tool call budget exceeded (same tool called too many times)
 *   - Global tool call budget exceeded (total across all tools)
 *   - Duplicate tool calls (same tool + same args repeated)
 *   - Empty/false results accumulating (tool returning nothing useful)
 *
 * When thresholds are hit, nudge messages are injected to steer the agent.
 * On hard limits, the generation is aborted.
 */

import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";

export interface ToolCallGuardConfig {
    /** Max times any single tool can be invoked. Default: 8 */
    maxCallsPerTool?: number;
    /** Max total tool invocations across all tools. Default: 30 */
    maxTotalToolCalls?: number;
    /** Number of empty results before injecting a stop nudge. Default: 3 */
    emptyResultThreshold?: number;
    /** Number of identical (tool+args) calls before aborting. Default: 3 */
    deduplicateThreshold?: number;
}

interface GuardState {
    /** Per-tool call counts */
    perToolCallCount: Record<string, number>;
    /** Per-tool empty result counts */
    perToolEmptyCount: Record<string, number>;
    /** Duplicate tracker: key = "toolName::argsJSON", value = count */
    duplicateTracker: Record<string, number>;
    /** Total tool calls across all tools */
    totalToolCalls: number;
    /** Whether a nudge was already injected in a recent step */
    lastNudgeStep: number;
}

/**
 * Create a tool call guard processor that monitors tool usage patterns
 * and intervenes when pathological behavior is detected.
 */
export function createToolCallGuardProcessor(
    config?: ToolCallGuardConfig
): Processor<"tool-call-guard"> {
    const maxCallsPerTool = config?.maxCallsPerTool ?? 8;
    const maxTotalToolCalls = config?.maxTotalToolCalls ?? 30;
    const emptyResultThreshold = config?.emptyResultThreshold ?? 3;
    const deduplicateThreshold = config?.deduplicateThreshold ?? 3;

    return {
        id: "tool-call-guard" as const,
        name: "Tool Call Guard",

        async processOutputStep(args: ProcessOutputStepArgs) {
            const { messages, toolCalls, abort, state, stepNumber } = args;

            // Initialize state on first call
            const gs = state as unknown as GuardState;
            if (!gs.perToolCallCount) {
                gs.perToolCallCount = {};
                gs.perToolEmptyCount = {};
                gs.duplicateTracker = {};
                gs.totalToolCalls = 0;
                gs.lastNudgeStep = -1;
            }

            // No tool calls this step — nothing to guard
            if (!toolCalls || toolCalls.length === 0) {
                return messages;
            }

            // Track total
            gs.totalToolCalls += toolCalls.length;

            // Global tool budget check
            if (gs.totalToolCalls > maxTotalToolCalls) {
                console.warn(
                    `[ToolCallGuard] Step ${stepNumber}: global budget exceeded (${gs.totalToolCalls}/${maxTotalToolCalls}). Aborting.`
                );
                abort(
                    `Global tool budget exceeded: ${gs.totalToolCalls} calls (limit: ${maxTotalToolCalls})`
                );
            }

            const emptyNudgeTools: string[] = [];
            const duplicateNudgeTools: string[] = [];

            for (const tc of toolCalls) {
                const toolName = tc.toolName;
                const argsStr = JSON.stringify(tc.args ?? {});

                // Per-tool call count
                const count = (gs.perToolCallCount[toolName] ?? 0) + 1;
                gs.perToolCallCount[toolName] = count;

                if (count > maxCallsPerTool) {
                    console.warn(
                        `[ToolCallGuard] Step ${stepNumber}: per-tool budget exceeded for ${toolName} (${count}/${maxCallsPerTool}). Aborting.`
                    );
                    abort(
                        `Per-tool budget exceeded: ${toolName} called ${count} times (limit: ${maxCallsPerTool})`
                    );
                }

                // Duplicate detection (tool+args combo)
                const dupKey = `${toolName}::${argsStr}`;
                const dupCount = (gs.duplicateTracker[dupKey] ?? 0) + 1;
                gs.duplicateTracker[dupKey] = dupCount;

                if (dupCount >= deduplicateThreshold) {
                    console.warn(
                        `[ToolCallGuard] Step ${stepNumber}: duplicate loop detected for ${toolName} (${dupCount}x identical args). Aborting.`
                    );
                    abort(
                        `Duplicate tool call loop: ${toolName} called ${dupCount} times with identical args`
                    );
                }

                if (dupCount === 2) {
                    duplicateNudgeTools.push(toolName);
                }

                // Check for empty results in the message history
                // Look at the most recent tool-result messages to see if this tool returned empty
                const recentToolResults = findRecentToolResults(messages, toolName);
                if (recentToolResults.empty) {
                    const emptyCount = (gs.perToolEmptyCount[toolName] ?? 0) + 1;
                    gs.perToolEmptyCount[toolName] = emptyCount;
                    if (emptyCount >= emptyResultThreshold) {
                        emptyNudgeTools.push(toolName);
                    }
                }
            }

            // Inject nudge messages (at most once per 2 steps to avoid spam)
            if (stepNumber - gs.lastNudgeStep < 2) {
                return messages;
            }

            const nudges: string[] = [];

            if (emptyNudgeTools.length > 0) {
                const toolList = [...new Set(emptyNudgeTools)].join(", ");
                nudges.push(
                    `[System] ${toolList} has returned empty/no results ${emptyResultThreshold}+ times. ` +
                        `Stop calling it and use what's already in your context. ` +
                        `If you don't have what you need, inform the user rather than retrying.`
                );
            }

            if (duplicateNudgeTools.length > 0) {
                const toolList = [...new Set(duplicateNudgeTools)].join(", ");
                nudges.push(
                    `[System] You have called ${toolList} with identical arguments multiple times. ` +
                        `The results are the same each time. Do NOT call ${duplicateNudgeTools.length === 1 ? "it" : "them"} again with the same arguments. ` +
                        `Choose a different approach, try different arguments, or report what you found.`
                );
            }

            if (nudges.length > 0) {
                console.log(
                    `[ToolCallGuard] Step ${stepNumber}: injecting ${nudges.length} nudge(s) — empty: [${emptyNudgeTools.join(", ")}], duplicate: [${duplicateNudgeTools.join(", ")}]`
                );
                gs.lastNudgeStep = stepNumber;
                // Append nudge as a user message to guide the agent
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nudgeMsg: any = {
                    id: `guard-nudge-${stepNumber}`,
                    role: "user" as const,
                    createdAt: new Date(),
                    content: {
                        format: 2 as const,
                        parts: [
                            {
                                type: "text" as const,
                                text: nudges.join("\n\n")
                            }
                        ]
                    }
                };
                return [...messages, nudgeMsg];
            }

            return messages;
        }
    };
}

/**
 * Check recent messages for empty tool results from a specific tool.
 */
function findRecentToolResults(
    messages: Array<{ role: string; content: unknown }>,
    toolName: string
): { empty: boolean } {
    // Look at the last few messages for tool invocation results
    const recent = messages.slice(-5);
    for (const msg of recent) {
        if (msg.role !== "assistant") continue;
        const content = msg.content;
        if (!content || typeof content !== "object" || !("parts" in content)) continue;

        const parts = (
            content as { parts: Array<{ type: string; toolName?: string; result?: unknown }> }
        ).parts;
        for (const part of parts) {
            if (part.type === "tool-invocation" && part.toolName === toolName) {
                const result = part.result;
                const resultStr =
                    typeof result === "string" ? result : JSON.stringify(result ?? "");
                if (
                    !result ||
                    resultStr === "" ||
                    resultStr === "false" ||
                    resultStr === "null" ||
                    resultStr === "[]" ||
                    resultStr === "{}" ||
                    resultStr === '""'
                ) {
                    return { empty: true };
                }
            }
        }
    }
    return { empty: false };
}
