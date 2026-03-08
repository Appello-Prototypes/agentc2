/**
 * Managed Generate
 *
 * Custom multi-step execution loop that wraps Mastra's agent.generate()
 * with context windowing, instruction anchoring, prompt caching, and
 * semantic compression of tool results.
 *
 * Architecture:
 *   [Instructions (via options.instructions)] -- CACHED (stable prefix)
 *   [User message (original input)]           -- CACHED (stable)
 *   [Assistant + tool history (windowed)]      -- changes per step
 *
 * System instructions are kept architecturally separate from the message
 * history by passing them via the `instructions` generate option. This
 * ensures they're always first in the prompt and enables Anthropic prompt
 * caching for the stable prefix.
 */

import type { Agent } from "@mastra/core/agent";
import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";
import { supportsAdaptiveThinking } from "../agents/model-config-types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContextConfig {
    maxContextTokens?: number;
    windowSize?: number;
    anchorInstructions?: boolean;
    anchorInterval?: number;
}

export interface ManagedGenerateOptions {
    maxSteps: number;
    maxContextTokens?: number;
    windowSize?: number;
    anchorInstructions?: boolean;
    anchorInterval?: number;
    maxTokens?: number;
    memory?: { thread: string; resource: string };
    onStep?: (step: number, summary: StepSummary) => void;
    modelProvider?: string;
    modelName?: string;
    compressionModel?: LanguageModel;
    compressionThreshold?: number;
    isReasoningModel?: boolean;
    /** Max times any single tool can be invoked (any args). Default: 8 */
    maxCallsPerTool?: number;
    /** Max total tool invocations across all tools. Default: maxSteps * 2 */
    maxTotalToolCalls?: number;
    /** Number of empty/false results before injecting a stop nudge. Default: 3 */
    emptyResultThreshold?: number;
}

export interface StepSummary {
    toolName?: string;
    inputPreview: string;
    outputPreview: string;
    promptTokens: number;
    completionTokens: number;
    hasToolCall: boolean;
    text: string;
}

export interface ManagedGenerateResult {
    text: string;
    steps: StepSummary[];
    totalSteps: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    finishReason: string;
    abortReason?: string;
}

interface ToolCallRecord {
    step: number;
    toolName: string;
    inputPreview: string;
    outputPreview: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function countTokens(text: string): number {
    try {
        return getEncoder().encode(text).length;
    } catch {
        return Math.ceil(text.length / 4);
    }
}

function preview(value: unknown, maxLen: number = 200): string {
    if (value === null || value === undefined) return "(empty)";
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + "...";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveToolName(value?: any): string | undefined {
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
function resolveToolArgs(value?: any): unknown {
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
function resolveToolResult(value?: any): unknown {
    return value?.result ?? value?.output ?? value?.payload?.result;
}

function buildToolCallSummary(record: ToolCallRecord): string {
    return `[Step ${record.step}: ${record.toolName}(${record.inputPreview}) → ${record.outputPreview}]`;
}

/**
 * Build step instructions with optional anchoring.
 * For most steps, returns base instructions unchanged (stable prefix = cacheable).
 * Every anchorInterval steps, appends a progress summary.
 */
function buildStepInstructions(
    baseInstructions: string,
    currentStep: number,
    maxSteps: number,
    toolCallHistory: ToolCallRecord[],
    anchorInstructions: boolean,
    anchorInterval: number
): string {
    if (
        !anchorInstructions ||
        !baseInstructions ||
        currentStep <= 1 ||
        (currentStep - 1) % anchorInterval !== 0
    ) {
        return baseInstructions;
    }

    const progressLines = toolCallHistory.slice(-5).map((t) => `  - Step ${t.step}: ${t.toolName}`);

    return [
        baseInstructions,
        "",
        `[Progress - Step ${currentStep}/${maxSteps}]`,
        `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
        `Continue your task. Do not repeat completed steps.`
    ].join("\n");
}

// ── Semantic Compression ─────────────────────────────────────────────────────

const compressionCache = new Map<string, string>();

function hashForCache(input: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(input.length, 500); i++) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return `${hash}_${input.length}`;
}

async function compressToolResult(
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
            `[ManagedGenerate] Compression failed for ${toolName}, falling back to truncation:`,
            error instanceof Error ? error.message : error
        );
        return result.substring(0, maxOutputChars) + "...[truncated]";
    }
}

// ── Main Function ────────────────────────────────────────────────────────────

export async function managedGenerate(
    agent: Agent,
    input: string,
    options: ManagedGenerateOptions
): Promise<ManagedGenerateResult> {
    const {
        maxSteps,
        maxContextTokens = 50_000,
        windowSize = 5,
        anchorInstructions = true,
        anchorInterval = 10,
        maxTokens,
        memory,
        onStep,
        modelProvider,
        modelName,
        compressionModel,
        compressionThreshold = 3000,
        isReasoningModel = false,
        maxCallsPerTool = 8,
        maxTotalToolCalls = maxSteps * 2,
        emptyResultThreshold = 3
    } = options;

    const allSteps: StepSummary[] = [];
    const toolCallHistory: ToolCallRecord[] = [];
    const duplicateCallTracker = new Map<string, { count: number; cachedResult: unknown }>();
    const perToolCallCount = new Map<string, number>();
    const perToolEmptyCount = new Map<string, number>();
    let totalToolCalls = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let currentStep = 0;
    let lastText = "";
    let finishReason = "unknown";
    let abortReason: string | undefined;

    // Only user and assistant messages in the array; instructions are separate
    type ManagedMessage = {
        role: "user" | "assistant";
        content: string;
        providerMetadata?: Record<string, unknown>;
    };
    const messages: ManagedMessage[] = [{ role: "user", content: input }];

    // Extract agent instructions for the separate instructions channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentInstructions: string = (agent as any).instructions || "";

    while (currentStep < maxSteps) {
        currentStep++;

        // Build the context window: original user message + last N tool exchanges
        const windowedMessages: ManagedMessage[] = [];

        // Always include the original user message (with Anthropic cache breakpoint)
        const originalMessage: ManagedMessage = { ...messages[0]! };
        if (modelProvider === "anthropic") {
            originalMessage.providerMetadata = {
                anthropic: { cacheControl: { type: "ephemeral" } }
            };
        }
        windowedMessages.push(originalMessage);

        // Add summarized older tool calls as a user context message (not system)
        if (toolCallHistory.length > windowSize) {
            const olderCalls = toolCallHistory.slice(0, -windowSize);
            const summaryText = olderCalls.map(buildToolCallSummary).join("\n");
            const summaryMessage: ManagedMessage = {
                role: "user",
                content: `[Previous tool call summaries]\n${summaryText}`
            };
            if (modelProvider === "anthropic") {
                summaryMessage.providerMetadata = {
                    anthropic: { cacheControl: { type: "ephemeral" } }
                };
            }
            windowedMessages.push(summaryMessage);
        }

        // Add recent messages (last windowSize * 2 entries for assistant+tool pairs)
        const recentStartIdx = Math.max(1, messages.length - windowSize * 2);
        for (let i = recentStartIdx; i < messages.length; i++) {
            windowedMessages.push(messages[i]!);
        }

        // Build instructions for this step (separate from messages)
        const stepInstructions = buildStepInstructions(
            agentInstructions,
            currentStep,
            maxSteps,
            toolCallHistory,
            anchorInstructions,
            anchorInterval
        );

        // Measure context size and enforce budget
        const contextSize = countTokens(
            stepInstructions + "\n" + windowedMessages.map((m) => m.content).join("\n")
        );
        if (contextSize > maxContextTokens) {
            abortReason = `Context token estimate (${contextSize}) exceeded budget (${maxContextTokens}) at step ${currentStep}`;
            console.warn(`[ManagedGenerate] ${abortReason}`);
            break;
        }

        // Build generate options with instructions separated from messages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generateOptions: any = {
            maxSteps: 1,
            ...(stepInstructions ? { instructions: stepInstructions } : {}),
            ...(maxTokens ? { modelSettings: { maxTokens } } : {}),
            ...(memory ? { memory } : {})
        };

        // Anthropic prompt caching: mark system prompt for caching
        if (modelProvider === "anthropic" && !isReasoningModel) {
            generateOptions.providerOptions = {
                anthropic: {
                    cacheControl: { type: "ephemeral" }
                }
            };
        }

        // Reasoning model adjustments
        if (isReasoningModel) {
            // For reasoning models (o-series), prepend instructions into the first user message
            // instead of using the separate instructions channel
            if (currentStep === 1 && stepInstructions && windowedMessages[0]) {
                windowedMessages[0] = {
                    ...windowedMessages[0],
                    content: `${stepInstructions}\n\n---\n\n${windowedMessages[0].content}`
                };
                delete generateOptions.instructions;
            }

            // Add reasoning-specific provider options
            if (modelProvider === "openai") {
                generateOptions.providerOptions = {
                    ...generateOptions.providerOptions,
                    openai: { reasoningEffort: "high" }
                };
            } else if (modelProvider === "anthropic") {
                const useAdaptive = modelName && supportsAdaptiveThinking(modelName);
                const thinkingConfig = useAdaptive
                    ? { type: "adaptive" as const }
                    : { type: "enabled" as const, budgetTokens: 10000 };
                generateOptions.providerOptions = {
                    ...generateOptions.providerOptions,
                    anthropic: {
                        ...(generateOptions.providerOptions?.anthropic || {}),
                        thinking: thinkingConfig,
                        ...(useAdaptive ? { effort: "high" } : {})
                    }
                };
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any;
        try {
            response = await agent.generate(windowedMessages as any, generateOptions);
        } catch (error) {
            abortReason = `Generate failed at step ${currentStep}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`[ManagedGenerate] ${abortReason}`);
            break;
        }

        // Extract usage from this step
        const usage = response.totalUsage || response.usage || {};
        const stepPromptTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
        const stepCompletionTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
        totalPromptTokens += stepPromptTokens;
        totalCompletionTokens += stepCompletionTokens;

        // Check if the agent made tool calls
        const stepToolCalls = response.toolCalls || [];
        const stepToolResults = response.toolResults || [];
        const hasToolCall = stepToolCalls.length > 0;

        // Build step summary (robust property resolution for Mastra/AI SDK compat)
        const firstToolName = resolveToolName(stepToolCalls[0]);
        const firstToolArgs = resolveToolArgs(stepToolCalls[0]);
        const firstToolResult = resolveToolResult(stepToolResults[0]);

        const stepSummary: StepSummary = {
            toolName: firstToolName,
            inputPreview: firstToolArgs ? preview(firstToolArgs, 100) : "",
            outputPreview: firstToolResult ? preview(firstToolResult, 200) : "",
            promptTokens: stepPromptTokens,
            completionTokens: stepCompletionTokens,
            hasToolCall,
            text: response.text || ""
        };
        allSteps.push(stepSummary);

        // Record tool calls for history
        for (let i = 0; i < stepToolCalls.length; i++) {
            toolCallHistory.push({
                step: currentStep,
                toolName: resolveToolName(stepToolCalls[i]) || "unknown",
                inputPreview: preview(resolveToolArgs(stepToolCalls[i]), 80),
                outputPreview: preview(resolveToolResult(stepToolResults[i]), 120)
            });
        }

        // ── Tool guardrails ─────────────────────────────────────────────────

        if (hasToolCall) {
            // Track total tool calls
            totalToolCalls += stepToolCalls.length;

            // --- Global tool budget ---
            if (totalToolCalls > maxTotalToolCalls) {
                abortReason = `Global tool budget exceeded: ${totalToolCalls} calls (limit: ${maxTotalToolCalls})`;
                console.warn(`[ManagedGenerate] ${abortReason}`);
                break;
            }

            // --- Per-tool call budget + empty-result tracking + duplicate detection ---
            let guardBreak = false;
            const emptyNudgeTools: string[] = [];

            for (let i = 0; i < stepToolCalls.length; i++) {
                const toolName = resolveToolName(stepToolCalls[i]) || "unknown";
                const args = resolveToolArgs(stepToolCalls[i]);
                const result = resolveToolResult(stepToolResults[i]);

                // Per-tool call count
                const toolCount = (perToolCallCount.get(toolName) ?? 0) + 1;
                perToolCallCount.set(toolName, toolCount);

                if (toolCount > maxCallsPerTool) {
                    abortReason = `Per-tool budget exceeded: ${toolName} called ${toolCount} times (limit: ${maxCallsPerTool})`;
                    console.warn(`[ManagedGenerate] ${abortReason}`);
                    guardBreak = true;
                    break;
                }

                // Empty/false result tracking
                const resultText =
                    typeof result === "string" ? result : JSON.stringify(result ?? "");
                const isEmpty =
                    !result ||
                    resultText === "" ||
                    resultText === "false" ||
                    resultText === "null" ||
                    resultText === "[]" ||
                    resultText === "{}" ||
                    resultText === '""';

                if (isEmpty) {
                    const emptyCount = (perToolEmptyCount.get(toolName) ?? 0) + 1;
                    perToolEmptyCount.set(toolName, emptyCount);
                    if (emptyCount >= emptyResultThreshold) {
                        emptyNudgeTools.push(toolName);
                    }
                }

                // Duplicate detection (tool+args combo)
                const key = `${toolName}::${JSON.stringify(args)}`;
                const entry = duplicateCallTracker.get(key);
                if (entry) {
                    entry.count++;
                    entry.cachedResult = result;
                    if (entry.count >= 3) {
                        abortReason = `Duplicate tool call loop: ${toolName} called ${entry.count} times with identical args`;
                        console.warn(`[ManagedGenerate] ${abortReason}`);
                        guardBreak = true;
                        break;
                    }
                } else {
                    duplicateCallTracker.set(key, { count: 1, cachedResult: result });
                }
            }

            if (guardBreak) break;

            // Inject empty-result nudge
            if (emptyNudgeTools.length > 0) {
                const toolList = emptyNudgeTools.join(", ");
                messages.push({
                    role: "user",
                    content:
                        `[System] ${toolList} has returned empty/no results ${emptyResultThreshold}+ times. ` +
                        `Stop calling it and use what's already in your context. ` +
                        `If you don't have what you need, inform the user rather than retrying.`
                });
            }
        }

        // Add the assistant response and tool results to our managed messages
        if (response.text) {
            messages.push({ role: "assistant", content: response.text });
        }
        if (hasToolCall) {
            // Compress or preview tool results before adding to context
            const toolResultParts: string[] = [];
            for (let i = 0; i < stepToolCalls.length; i++) {
                const resultObj = stepToolResults[i];
                const toolResult = resolveToolResult(resultObj);
                const rawResult =
                    typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult ?? "");
                const toolName = resolveToolName(stepToolCalls[i]) || "unknown";

                let condensed: string;
                if (compressionModel && rawResult.length > compressionThreshold) {
                    condensed = await compressToolResult(
                        toolName,
                        rawResult,
                        Math.min(compressionThreshold, 2000),
                        compressionModel
                    );
                } else {
                    condensed = preview(toolResult, 500);
                }
                toolResultParts.push(`Tool: ${toolName}\nResult: ${condensed}`);
            }
            messages.push({ role: "assistant", content: toolResultParts.join("\n---\n") });

            // Detect failed tool calls and inject a diagnostic nudge
            const failedTools = stepToolResults.filter((r: any) => {
                const result = resolveToolResult(r);
                const text = typeof result === "string" ? result : JSON.stringify(result ?? "");
                return (
                    text.includes("[TOOL BLOCKED]") ||
                    text.includes('"error"') ||
                    text.includes("Error:") ||
                    text.includes("ECONNREFUSED") ||
                    text.includes("permission denied")
                );
            });

            if (failedTools.length > 0) {
                const failedNames = stepToolCalls
                    .filter((_: any, i: number) => {
                        const result = resolveToolResult(stepToolResults[i]);
                        const text =
                            typeof result === "string" ? result : JSON.stringify(result ?? "");
                        return (
                            text.includes("[TOOL BLOCKED]") ||
                            text.includes('"error"') ||
                            text.includes("Error:") ||
                            text.includes("ECONNREFUSED") ||
                            text.includes("permission denied")
                        );
                    })
                    .map((tc: any) => resolveToolName(tc) || "unknown");

                messages.push({
                    role: "user",
                    content:
                        `[System] ${failedNames.length} tool call(s) returned errors: ${failedNames.join(", ")}. ` +
                        `Analyze the error messages above. If it's a permission or connection issue, ` +
                        `do NOT retry the same tool — choose an alternative approach or inform the user. ` +
                        `If the arguments were wrong, fix them and retry once.`
                });
            }

            // Nudge on duplicate tool calls (2nd call with same args)
            const duplicateNames: string[] = [];
            for (let i = 0; i < stepToolCalls.length; i++) {
                const toolName = resolveToolName(stepToolCalls[i]) || "unknown";
                const args = resolveToolArgs(stepToolCalls[i]);
                const key = `${toolName}::${JSON.stringify(args)}`;
                const entry = duplicateCallTracker.get(key);
                if (entry && entry.count === 2) {
                    duplicateNames.push(toolName);
                }
            }
            if (duplicateNames.length > 0) {
                messages.push({
                    role: "user",
                    content:
                        `[System] You have called ${duplicateNames.join(", ")} with identical arguments multiple times. ` +
                        `The results are the same each time. Do NOT call ${duplicateNames.length === 1 ? "it" : "them"} again with the same arguments. ` +
                        `Choose a different approach, try different arguments, or report what you found.`
                });
            }
        }

        if (onStep) {
            onStep(currentStep, stepSummary);
        }

        lastText = response.text || lastText;
        finishReason = response.finishReason || "unknown";

        if (!hasToolCall && response.text) {
            finishReason = "complete";
            break;
        }

        if (!hasToolCall && !response.text) {
            abortReason = `Agent produced neither tool calls nor text at step ${currentStep}`;
            break;
        }
    }

    if (currentStep >= maxSteps && !abortReason) {
        abortReason = `Reached maximum steps (${maxSteps})`;
    }

    return {
        text: lastText,
        steps: allSteps,
        totalSteps: currentStep,
        totalPromptTokens,
        totalCompletionTokens,
        finishReason,
        abortReason
    };
}
