/**
 * Activity Service -- Denormalized event store for the unified Activity Feed.
 *
 * Every significant platform event writes a row to the `activity_event` table
 * via `recordActivity()`. The Activity Feed page reads from this single table
 * with fast, index-backed queries.
 *
 * Design principles:
 * - Fire-and-forget: recordActivity() never throws. Failures are logged, not propagated.
 * - Denormalized: summary, agentSlug, agentName, cost, duration stored directly.
 *   No joins needed to render the feed.
 * - Human-readable summaries generated at write time, not at read time.
 */

import { prisma, type ActivityEventType, type Prisma } from "@repo/database";

export interface RecordActivityInput {
    type: ActivityEventType;
    agentId?: string;
    agentSlug?: string;
    agentName?: string;
    userId?: string;
    summary: string;
    detail?: string;
    status?: "success" | "failure" | "info" | "warning";
    source?: string;
    runId?: string;
    taskId?: string;
    networkRunId?: string;
    campaignId?: string;
    costUsd?: number;
    durationMs?: number;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
    tags?: string[];
    tenantId?: string;
    workspaceId?: string;
}

/**
 * Record an activity event. Fire-and-forget -- never throws.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
    try {
        await prisma.activityEvent.create({
            data: {
                type: input.type,
                agentId: input.agentId,
                agentSlug: input.agentSlug,
                agentName: input.agentName,
                userId: input.userId,
                summary: input.summary,
                detail: input.detail,
                status: input.status,
                source: input.source,
                runId: input.runId,
                taskId: input.taskId,
                networkRunId: input.networkRunId,
                campaignId: input.campaignId,
                costUsd: input.costUsd,
                durationMs: input.durationMs,
                tokenCount: input.tokenCount,
                metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
                tags: input.tags ?? [],
                tenantId: input.tenantId,
                workspaceId: input.workspaceId
            }
        });
    } catch (err) {
        console.error("[Activity] Failed to record activity event:", err);
    }
}

/**
 * Truncate a string for use as an input preview in summaries.
 */
export function inputPreview(text: string | null | undefined, maxLen = 80): string {
    if (!text) return "";
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen) + "...";
}
