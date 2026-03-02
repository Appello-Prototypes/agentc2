export interface ActivityEvent {
    id: string;
    type: string;
    timestamp: string;
    agentId: string | null;
    agentSlug: string | null;
    agentName: string | null;
    userId: string | null;
    summary: string;
    detail: string | null;
    status: string | null;
    source: string | null;
    runId: string | null;
    taskId: string | null;
    networkRunId: string | null;
    campaignId: string | null;
    costUsd: number | null;
    durationMs: number | null;
    tokenCount: number | null;
    metadata: Record<string, unknown> | null;
    tags: string[];
}

export interface FeedMetrics {
    totalEvents: number;
    byType: Record<string, number>;
    byAgent: Array<{ agentSlug: string; agentName: string; count: number }>;
    totalCost: number;
    avgDuration: number;
}

export type GodModeView = "feed" | "wiretap";

export interface WiretapRun {
    runId: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    status: string;
    inputText: string;
    source: string | null;
    startedAt: string;
    elapsedMs?: number;
    steps: WiretapStep[];
    toolCalls: WiretapToolCall[];
}

export interface WiretapStep {
    stepNumber: number;
    type: string;
    content: unknown;
    durationMs: number | null;
    timestamp: string;
}

export interface WiretapToolCall {
    id: string;
    toolKey: string;
    mcpServerId: string | null;
    status: string;
    durationMs: number | null;
    createdAt: string;
}

export interface CausalNode {
    id: string;
    type: string;
    label: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown>;
    children: CausalNode[];
}

export interface EventGroupStats {
    total: number;
    completed: number;
    failed: number;
    running: number;
    totalCost: number;
    totalDuration: number;
}

export interface EventGroup {
    key: string;
    type: "campaign" | "network" | "workflow";
    rootEvent: ActivityEvent;
    events: ActivityEvent[];
    stats: EventGroupStats;
}

export interface GroupedEventsResponse {
    groups: EventGroup[];
    ungrouped: ActivityEvent[];
}
