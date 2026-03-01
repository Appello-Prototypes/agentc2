/**
 * Core network stream processor.
 * Extracts step, token, cost, and output data from the Agent.network() async iterable.
 * Shared across all network execution paths to eliminate duplication.
 */

import { RunStatus } from "@repo/database";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NetworkCapturedStep {
    stepNumber: number;
    stepType: string;
    primitiveType?: string;
    primitiveId?: string;
    routingDecision?: Record<string, unknown>;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
    status: RunStatus;
    agentRunId?: string;
}

export interface NetworkStreamResult {
    outputText: string;
    outputJson: Record<string, unknown> | undefined;
    steps: NetworkCapturedStep[];
    totalTokens: number;
    totalCostUsd: number;
    lastResult: Record<string, unknown> | undefined;
    lastResultText: string | undefined;
}

export interface StreamProcessorOptions {
    onChunk?: (type: string, payload: Record<string, unknown>) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function inferStepType(eventType: string): string {
    if (eventType.includes("routing")) return "routing";
    if (eventType.includes("agent")) return "agent";
    if (eventType.includes("workflow")) return "workflow";
    if (eventType.includes("tool")) return "tool";
    return "event";
}

export function inferPrimitive(
    eventType: string,
    payload: Record<string, unknown>
): { type: string | undefined; id: string | undefined } {
    if (payload.agentId) return { type: "agent", id: payload.agentId as string };
    if (payload.workflowId) return { type: "workflow", id: payload.workflowId as string };
    if (payload.toolName) return { type: "tool", id: payload.toolName as string };
    if (payload.toolId) return { type: "tool", id: payload.toolId as string };
    if (eventType.includes("agent")) return { type: "agent", id: payload.agentId as string };
    if (eventType.includes("workflow"))
        return { type: "workflow", id: payload.workflowId as string };
    if (eventType.includes("tool")) return { type: "tool", id: payload.toolName as string };
    return { type: undefined, id: undefined };
}

export function tryParseJson(value: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return null;
    }
    return null;
}

// ─── Main processor ─────────────────────────────────────────────────────────

export async function processNetworkStream(
    stream: AsyncIterable<unknown>,
    options?: StreamProcessorOptions
): Promise<NetworkStreamResult> {
    const steps: NetworkCapturedStep[] = [];
    let stepNumber = 0;
    let outputText = "";
    let outputJson: Record<string, unknown> | undefined;
    let lastResult: Record<string, unknown> | undefined;
    let lastResultText: string | undefined;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for await (const chunk of stream) {
        const chunkAny = chunk as { type: string; payload?: Record<string, unknown> };
        const payload = chunkAny.payload || {};

        options?.onChunk?.(chunkAny.type, payload);

        if (chunkAny.type === "agent-execution-event-text-delta" && payload.textDelta) {
            outputText += payload.textDelta as string;
        }

        if (chunkAny.type === "network-object-result") {
            outputJson = payload as Record<string, unknown>;
        }

        if (payload.usage && typeof payload.usage === "object") {
            const usage = payload.usage as {
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
            };
            if (usage.totalTokens) {
                totalTokens += usage.totalTokens;
            } else if (usage.promptTokens || usage.completionTokens) {
                totalTokens += (usage.promptTokens || 0) + (usage.completionTokens || 0);
            }
        }

        if (typeof payload.costUsd === "number") {
            totalCostUsd += payload.costUsd;
        }

        if (
            payload.result &&
            typeof payload.result === "object" &&
            !Array.isArray(payload.result)
        ) {
            lastResult = payload.result as Record<string, unknown>;
        }
        if (typeof payload.result === "string") {
            lastResultText = payload.result;
            const parsed = tryParseJson(payload.result);
            if (parsed) {
                lastResult = parsed;
            }
        }

        const stepType = inferStepType(chunkAny.type);
        const primitive = inferPrimitive(chunkAny.type, payload);
        if (
            chunkAny.type.includes("start") ||
            chunkAny.type.includes("end") ||
            chunkAny.type.includes("step-finish") ||
            chunkAny.type.includes("routing")
        ) {
            steps.push({
                stepNumber: stepNumber++,
                stepType,
                primitiveType: primitive.type,
                primitiveId: primitive.id,
                routingDecision: stepType === "routing" ? payload : undefined,
                inputJson: payload.input as Record<string, unknown>,
                outputJson: payload.result as Record<string, unknown>,
                status: RunStatus.COMPLETED
            });
        }
    }

    if (!outputJson && lastResult) {
        outputJson = lastResult;
    }
    if (!outputText) {
        if (lastResultText) {
            outputText = lastResultText;
        } else if (outputJson) {
            outputText = JSON.stringify(outputJson, null, 2);
        }
    }

    return { outputText, outputJson, steps, totalTokens, totalCostUsd, lastResult, lastResultText };
}
