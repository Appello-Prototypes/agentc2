/**
 * Voice Agent Trace Store
 *
 * Database-persisted store for voice conversation traces.
 * Captures full observability data: model, tools, reasoning, timing.
 *
 * @see https://mastra.ai/docs/observability/ai-tracing/overview
 */

import { prisma, Prisma } from "@repo/database";

/**
 * Tool call with full input/output
 */
export interface ToolCall {
    /** Tool name */
    name: string;
    /** Input parameters sent to tool */
    input: Record<string, unknown>;
    /** Output/response from tool */
    output?: unknown;
    /** Execution time in ms */
    durationMs?: number;
    /** Whether the call succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

/**
 * Execution step in the agent's reasoning
 */
export interface ExecutionStep {
    /** Step number */
    step: number;
    /** Type of step */
    type: "thinking" | "tool_call" | "tool_result" | "response";
    /** Content/description */
    content: string;
    /** Timestamp */
    timestamp: string;
    /** Tool call details (if type is tool_call) */
    toolCall?: ToolCall;
}

/**
 * Full conversation trace with detailed observability
 */
export interface ConversationTrace {
    /** Unique trace ID */
    traceId: string;
    /** ISO timestamp */
    timestamp: string;
    /** User's question */
    input: string;
    /** Agent's final response */
    output: string;

    /** Model information */
    model: {
        provider: string;
        name: string;
        temperature?: number;
    };

    /** Available tools (all tools the agent could use) */
    availableTools: string[];

    /** Tools actually called during execution */
    toolCalls: ToolCall[];

    /** Step-by-step execution trace */
    steps: ExecutionStep[];

    /** Total execution time in ms */
    durationMs: number;

    /** Token usage */
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };

    /** Evaluation scores */
    scores: {
        helpfulness?: { score: number; reasoning: string };
        relevancy?: { score: number };
    };

    /** Metadata */
    metadata: {
        source: "elevenlabs-voice";
        agentId?: string;
        agentSlug?: string;
        agentSource?: string;
        elevenlabsAgentId?: string;
        maxSteps?: number;
    };
}

/**
 * Store a new trace in the database
 */
export async function storeTrace(trace: ConversationTrace): Promise<void> {
    try {
        await prisma.voiceAgentTrace.create({
            data: {
                traceId: trace.traceId,
                timestamp: new Date(trace.timestamp),
                input: trace.input,
                output: trace.output,
                model: trace.model as Prisma.InputJsonValue,
                availableTools: trace.availableTools,
                toolCalls: trace.toolCalls as unknown as Prisma.InputJsonValue,
                steps: trace.steps as unknown as Prisma.InputJsonValue,
                durationMs: trace.durationMs,
                tokens: trace.tokens ? (trace.tokens as Prisma.InputJsonValue) : Prisma.JsonNull,
                scores: trace.scores as Prisma.InputJsonValue,
                metadata: trace.metadata as Prisma.InputJsonValue
            }
        });
        console.log(`[TraceStore] Stored trace ${trace.traceId}`);
    } catch (error) {
        console.error(`[TraceStore] Failed to store trace ${trace.traceId}:`, error);
        throw error;
    }
}

/**
 * Get all traces, ordered by most recent first
 */
export async function getTraces(limit: number = 100): Promise<ConversationTrace[]> {
    try {
        const traces = await prisma.voiceAgentTrace.findMany({
            orderBy: { timestamp: "desc" },
            take: limit
        });

        return traces.map(dbTraceToConversationTrace);
    } catch (error) {
        console.error("[TraceStore] Failed to get traces:", error);
        return [];
    }
}

/**
 * Get a specific trace by ID
 */
export async function getTraceById(traceId: string): Promise<ConversationTrace | undefined> {
    try {
        const trace = await prisma.voiceAgentTrace.findUnique({
            where: { traceId }
        });

        return trace ? dbTraceToConversationTrace(trace) : undefined;
    } catch (error) {
        console.error(`[TraceStore] Failed to get trace ${traceId}:`, error);
        return undefined;
    }
}

/**
 * Update an existing trace (e.g., to add relevancy score)
 */
export async function updateTrace(
    traceId: string,
    updates: Partial<ConversationTrace>
): Promise<boolean> {
    try {
        // First get the existing trace to merge scores
        const existing = await prisma.voiceAgentTrace.findUnique({
            where: { traceId }
        });

        if (!existing) {
            console.warn(`[TraceStore] Trace ${traceId} not found for update`);
            return false;
        }

        // Merge scores if updating scores
        let mergedScores = existing.scores;
        if (updates.scores) {
            mergedScores = {
                ...(existing.scores as object),
                ...updates.scores
            };
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (updates.output !== undefined) updateData.output = updates.output;
        if (updates.durationMs !== undefined) updateData.durationMs = updates.durationMs;
        if (updates.tokens !== undefined) updateData.tokens = updates.tokens;
        if (updates.scores !== undefined) updateData.scores = mergedScores;

        await prisma.voiceAgentTrace.update({
            where: { traceId },
            data: updateData
        });

        console.log(`[TraceStore] Updated trace ${traceId}`);
        return true;
    } catch (error) {
        console.error(`[TraceStore] Failed to update trace ${traceId}:`, error);
        return false;
    }
}

/**
 * Clear all traces (for testing/reset)
 */
export async function clearTraces(): Promise<number> {
    try {
        const result = await prisma.voiceAgentTrace.deleteMany({});
        console.log(`[TraceStore] Cleared ${result.count} traces`);
        return result.count;
    } catch (error) {
        console.error("[TraceStore] Failed to clear traces:", error);
        return 0;
    }
}

/**
 * Format a trace as markdown for copying to clipboard
 * Useful for debugging in Cursor or other tools
 */
export function formatTraceForCopy(trace: ConversationTrace): string {
    const lines: string[] = [
        `# Voice Agent Trace`,
        ``,
        `**ID:** ${trace.traceId}`,
        `**Timestamp:** ${trace.timestamp}`,
        `**Duration:** ${(trace.durationMs / 1000).toFixed(2)}s`,
        ``,
        `## Model Configuration`,
        `- **Provider:** ${trace.model.provider}`,
        `- **Model:** ${trace.model.name}`,
        trace.model.temperature !== undefined
            ? `- **Temperature:** ${trace.model.temperature}`
            : "",
        trace.tokens
            ? `- **Tokens:** ${trace.tokens.prompt} prompt, ${trace.tokens.completion} completion (${trace.tokens.total} total)`
            : "",
        ``,
        `## User Input`,
        `\`\`\``,
        trace.input,
        `\`\`\``,
        ``,
        `## Execution Timeline`,
        ``
    ];

    // Add execution steps
    for (const step of trace.steps) {
        const typeLabel = {
            thinking: "THINKING",
            tool_call: "TOOL CALL",
            tool_result: "TOOL RESULT",
            response: "RESPONSE"
        }[step.type];

        lines.push(`### Step ${step.step}: ${typeLabel}`);
        lines.push(`*${new Date(step.timestamp).toLocaleTimeString()}*`);
        lines.push(``);
        lines.push(step.content);
        lines.push(``);
    }

    // Add tool calls with full details
    if (trace.toolCalls.length > 0) {
        lines.push(`## Tool Calls (${trace.toolCalls.length})`);
        lines.push(``);

        for (const tc of trace.toolCalls) {
            lines.push(`### ${tc.name}`);
            lines.push(`**Status:** ${tc.success ? "Success" : "Failed"}`);
            if (tc.error) {
                lines.push(`**Error:** ${tc.error}`);
            }
            lines.push(``);
            lines.push(`**Input:**`);
            lines.push(`\`\`\`json`);
            lines.push(JSON.stringify(tc.input, null, 2));
            lines.push(`\`\`\``);
            lines.push(``);
            lines.push(`**Output:**`);
            lines.push(`\`\`\`json`);
            lines.push(
                typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output, null, 2)
            );
            lines.push(`\`\`\``);
            lines.push(``);
        }
    }

    // Add agent response
    lines.push(`## Agent Response`);
    lines.push(`\`\`\``);
    lines.push(trace.output);
    lines.push(`\`\`\``);
    lines.push(``);

    // Add scores
    lines.push(`## Evaluation Scores`);
    lines.push(
        `- **Helpfulness:** ${trace.scores.helpfulness ? `${(trace.scores.helpfulness.score * 100).toFixed(0)}% (${trace.scores.helpfulness.reasoning})` : "N/A"}`
    );
    lines.push(
        `- **Relevancy:** ${trace.scores.relevancy ? `${(trace.scores.relevancy.score * 100).toFixed(0)}%` : "Pending"}`
    );
    lines.push(``);

    // Add available tools
    lines.push(`## Available Tools (${trace.availableTools.length})`);
    lines.push(trace.availableTools.join(", "));
    lines.push(``);

    // Add metadata
    lines.push(`## Metadata`);
    lines.push(`- **Source:** ${trace.metadata.source}`);
    if (trace.metadata.agentId) {
        lines.push(`- **Agent ID:** ${trace.metadata.agentId}`);
    }
    if (trace.metadata.maxSteps) {
        lines.push(`- **Max Steps:** ${trace.metadata.maxSteps}`);
    }

    return lines.filter((l) => l !== "").join("\n");
}

/**
 * Get aggregate statistics for traces
 */
export async function getTraceStats() {
    try {
        const traces = await prisma.voiceAgentTrace.findMany({
            orderBy: { timestamp: "desc" },
            take: 100
        });

        const conversationTraces = traces.map(dbTraceToConversationTrace);

        const avgDurationMs =
            conversationTraces.length > 0
                ? Math.round(
                      conversationTraces.reduce((sum, t) => sum + t.durationMs, 0) /
                          conversationTraces.length
                  )
                : 0;

        const helpfulnessScores = conversationTraces
            .map((t) => t.scores.helpfulness?.score)
            .filter((s): s is number => s !== undefined);

        const relevancyScores = conversationTraces
            .map((t) => t.scores.relevancy?.score)
            .filter((s): s is number => s !== undefined);

        const toolUsage: Record<string, number> = {};
        for (const trace of conversationTraces) {
            for (const tc of trace.toolCalls) {
                toolUsage[tc.name] = (toolUsage[tc.name] || 0) + 1;
            }
        }

        // Get unique models used
        const modelsUsed = [
            ...new Set(conversationTraces.map((t) => `${t.model.provider}/${t.model.name}`))
        ];

        return {
            totalTraces: conversationTraces.length,
            avgDurationMs,
            avgHelpfulness:
                helpfulnessScores.length > 0
                    ? Math.round(
                          (helpfulnessScores.reduce((a, b) => a + b, 0) /
                              helpfulnessScores.length) *
                              100
                      ) / 100
                    : null,
            avgRelevancy:
                relevancyScores.length > 0
                    ? Math.round(
                          (relevancyScores.reduce((a, b) => a + b, 0) / relevancyScores.length) *
                              100
                      ) / 100
                    : null,
            toolUsage,
            modelsUsed
        };
    } catch (error) {
        console.error("[TraceStore] Failed to get stats:", error);
        return {
            totalTraces: 0,
            avgDurationMs: 0,
            avgHelpfulness: null,
            avgRelevancy: null,
            toolUsage: {},
            modelsUsed: []
        };
    }
}

/**
 * Convert database record to ConversationTrace
 */
function dbTraceToConversationTrace(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dbTrace: any
): ConversationTrace {
    return {
        traceId: dbTrace.traceId,
        timestamp: dbTrace.timestamp.toISOString(),
        input: dbTrace.input,
        output: dbTrace.output,
        model: dbTrace.model as ConversationTrace["model"],
        availableTools: dbTrace.availableTools,
        toolCalls: dbTrace.toolCalls as ToolCall[],
        steps: dbTrace.steps as ExecutionStep[],
        durationMs: dbTrace.durationMs,
        tokens: dbTrace.tokens as ConversationTrace["tokens"],
        scores: dbTrace.scores as ConversationTrace["scores"],
        metadata: dbTrace.metadata as ConversationTrace["metadata"]
    };
}
