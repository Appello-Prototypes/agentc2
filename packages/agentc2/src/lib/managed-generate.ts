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
    compressionModel?: LanguageModel;
    compressionThreshold?: number;
    isReasoningModel?: boolean;
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

const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function preview(value: unknown, maxLen: number = 200): string {
    if (value === null || value === undefined) return "(empty)";
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + "...";
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
        compressionModel,
        compressionThreshold = 3000,
        isReasoningModel = false
    } = options;

    const allSteps: StepSummary[] = [];
    const toolCallHistory: ToolCallRecord[] = [];
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

        // Estimate context size and enforce budget
        const contextSize = estimateTokens(
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
                generateOptions.providerOptions = {
                    ...generateOptions.providerOptions,
                    anthropic: {
                        ...(generateOptions.providerOptions?.anthropic || {}),
                        thinking: { type: "enabled", budgetTokens: 10000 }
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

        // Build step summary
        const stepSummary: StepSummary = {
            toolName: stepToolCalls[0]?.toolName,
            inputPreview: stepToolCalls[0]?.args ? preview(stepToolCalls[0].args, 100) : "",
            outputPreview: stepToolResults[0]?.result
                ? preview(stepToolResults[0].result, 200)
                : "",
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
                toolName: stepToolCalls[i]?.toolName || "unknown",
                inputPreview: preview(stepToolCalls[i]?.args, 80),
                outputPreview: preview(stepToolResults[i]?.result, 120)
            });
        }

        // Add the assistant response and tool results to our managed messages
        if (response.text) {
            messages.push({ role: "assistant", content: response.text });
        }
        if (hasToolCall) {
            // Compress or preview tool results before adding to context
            const toolResultParts: string[] = [];
            for (let i = 0; i < stepToolCalls.length; i++) {
                const tc = stepToolCalls[i] as { toolName?: string };
                const result = stepToolResults[i];
                const rawResult =
                    typeof result?.result === "string"
                        ? result.result
                        : JSON.stringify(result?.result ?? "");
                const toolName = tc.toolName || "unknown";

                let condensed: string;
                if (compressionModel && rawResult.length > compressionThreshold) {
                    condensed = await compressToolResult(
                        toolName,
                        rawResult,
                        Math.min(compressionThreshold, 2000),
                        compressionModel
                    );
                } else {
                    condensed = preview(result?.result, 500);
                }
                toolResultParts.push(`Tool: ${toolName}\nResult: ${condensed}`);
            }
            messages.push({ role: "assistant", content: toolResultParts.join("\n---\n") });
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
