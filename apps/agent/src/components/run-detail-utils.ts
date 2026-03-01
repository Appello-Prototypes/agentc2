/**
 * Shared interfaces and utility functions for run detail rendering.
 * Used by both the Live Runs page and Triggers page for consistency.
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TraceStep {
    id: string;
    stepNumber: number;
    type: string;
    content: unknown;
    timestamp: string;
    durationMs: number | null;
}

export interface ToolCall {
    id: string;
    toolKey: string;
    mcpServerId: string | null;
    inputJson: unknown;
    outputJson: unknown;
    success: boolean;
    error: string | null;
    durationMs: number | null;
    createdAt: string;
}

export interface Trace {
    id: string;
    status: string;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    stepsJson: unknown;
    modelJson: unknown;
    tokensJson: unknown;
    scoresJson: unknown;
    steps: TraceStep[];
    toolCalls: ToolCall[];
}

export interface Evaluation {
    id: string;
    scoresJson: Record<string, number>;
    scorerVersion: string | null;
    createdAt: string;
}

export interface Feedback {
    id: string;
    thumbs: boolean | null;
    rating: number | null;
    comment: string | null;
    createdAt: string;
}

export interface CostEvent {
    id: string;
    totalCostUsd: number;
    promptTokens: number;
    completionTokens: number;
}

export interface GuardrailEvent {
    id: string;
    type: string;
    guardrailKey: string;
    reason: string;
    inputSnippet: string | null;
    outputSnippet: string | null;
    createdAt: string;
}

export interface VersionInfo {
    id: string;
    version: number;
    description: string | null;
    instructions: string;
    modelProvider: string;
    modelName: string;
    snapshot: Record<string, unknown> | null;
    createdAt: string;
}

export interface WorkflowStep {
    id: string;
    stepId: string;
    stepType: string;
    stepName?: string | null;
    status: string;
    inputJson?: unknown;
    outputJson?: unknown;
    errorJson?: unknown;
    durationMs?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;
    iterationIndex?: number | null;
    agentRunId?: string | null;
}

export interface NetworkStep {
    id: string;
    stepNumber: number;
    stepType: string;
    primitiveType?: string | null;
    primitiveId?: string | null;
    routingDecision?: unknown;
    inputJson?: unknown;
    outputJson?: unknown;
    errorJson?: unknown;
    status: string;
    durationMs?: number | null;
    tokens?: number | null;
    costUsd?: number | null;
    agentRunId?: string | null;
}

export interface WorkflowEvaluation {
    id: string;
    stepSuccessRate?: number | null;
    outputQuality?: number | null;
    durationScore?: number | null;
    overallScore?: number | null;
    stepScores?: unknown;
    narrative?: string | null;
    createdAt: string;
}

export interface NetworkEvaluation {
    id: string;
    routingScore?: number | null;
    agentScores?: Record<string, number> | null;
    narrative?: string | null;
    createdAt: string;
}

export interface RunDetail {
    id: string;
    agentId: string;
    runType: string;
    status: string;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    startedAt: string;
    completedAt: string | null;
    modelProvider: string | null;
    modelName: string | null;
    versionId: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    turnCount?: number;
    turns?: Array<{
        id: string;
        turnIndex: number;
        inputText: string;
        outputText: string | null;
        durationMs: number | null;
        promptTokens: number | null;
        completionTokens: number | null;
        costUsd: number | null;
        stepsJson?: unknown;
        toolCalls?: ToolCall[];
    }>;
    trace: Trace | null;
    evaluation: Evaluation | Evaluation[] | null;
    feedback: Feedback | Feedback[] | null;
    costEvent: CostEvent | CostEvent[] | null;
    guardrailEvents: GuardrailEvent[] | null;
    version: VersionInfo | null;
    instanceId?: string | null;
    instanceName?: string | null;
    instanceSlug?: string | null;
    workflowSteps?: WorkflowStep[];
    networkSteps?: NetworkStep[];
    workflowEvaluation?: WorkflowEvaluation | null;
    networkEvaluation?: NetworkEvaluation | null;
    workflow?: { id: string; slug: string; name: string } | null;
    network?: { id: string; slug: string; name: string } | null;
    suspendedStep?: string | null;
    environment?: string | null;
    inputJson?: unknown;
    outputJson?: unknown;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatLatency(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export function formatCost(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-";
    if (value === 0) return "$0.00";
    return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function formatTokens(value: number | null | undefined): string {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString();
}

export function formatModelLabel(modelName: string | null, modelProvider?: string | null): string {
    if (!modelName) return "-";
    const cleaned = modelName
        .replace(/-\d{8}$/, "")
        .replace(/^claude-/, "")
        .replace(/^gpt-/, "");
    return modelProvider ? `${cleaned} (${modelProvider})` : cleaned;
}

export function resolveToolLabel(toolCall: ToolCall): string {
    if (toolCall.toolKey && toolCall.toolKey !== "unknown") {
        return toolCall.toolKey;
    }

    const input = toolCall.inputJson as Record<string, unknown> | null;
    const output = toolCall.outputJson as Record<string, unknown> | null;
    const payload = (output?.payload as Record<string, unknown> | undefined) || undefined;
    const candidates = [
        input?.toolName,
        input?.tool,
        input?.name,
        (input?.function as Record<string, unknown> | undefined)?.name,
        output?.toolName,
        output?.tool,
        output?.name,
        payload?.toolName,
        payload?.tool,
        payload?.name,
        (payload?.function as Record<string, unknown> | undefined)?.name
    ];

    const resolved = candidates.find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    return resolved || "Tool Call";
}

export function getStatusBadgeVariant(
    status: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toUpperCase()) {
        case "COMPLETED":
            return "default";
        case "FAILED":
            return "destructive";
        case "RUNNING":
        case "QUEUED":
            return "secondary";
        default:
            return "outline";
    }
}

export function getSourceBadgeColor(source: string | null): string {
    switch (source?.toLowerCase()) {
        case "slack":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        case "whatsapp":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        case "voice":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        case "telegram":
            return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
        case "elevenlabs":
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        case "api":
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

export function getDateRange(timeRange: string): { from: Date | null; to: Date | null } {
    if (timeRange === "all") {
        return { from: null, to: null };
    }

    const to = new Date();
    const from = new Date();

    switch (timeRange) {
        case "24h":
            from.setHours(from.getHours() - 24);
            break;
        case "7d":
            from.setDate(from.getDate() - 7);
            break;
        case "30d":
            from.setDate(from.getDate() - 30);
            break;
        case "90d":
            from.setDate(from.getDate() - 90);
            break;
        default:
            from.setDate(from.getDate() - 7);
    }

    return { from, to };
}
