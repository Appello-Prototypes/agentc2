/**
 * Webhook Dead-Letter Queue
 *
 * Failed webhook events are persisted and retried with exponential backoff.
 * After max retries, events are moved to "failed" status for manual replay.
 */

import { prisma } from "@repo/database";

interface DeadLetterEntry {
    source: string;
    eventType?: string;
    payload: unknown;
    headers?: Record<string, string>;
    errorMessage: string;
}

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000]; // 1min, 5min, 30min

export async function enqueueDeadLetter(entry: DeadLetterEntry) {
    const nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[0]!);
    return prisma.webhookDeadLetter.create({
        data: {
            source: entry.source,
            eventType: entry.eventType,
            payload: entry.payload as object,
            headers: entry.headers as object,
            errorMessage: entry.errorMessage,
            nextRetryAt
        }
    });
}

export async function getPendingRetries(limit = 20) {
    return prisma.webhookDeadLetter.findMany({
        where: {
            status: { in: ["pending", "retrying"] },
            nextRetryAt: { lte: new Date() }
        },
        orderBy: { nextRetryAt: "asc" },
        take: limit
    });
}

export async function markRetryAttempt(id: string, success: boolean, error?: string) {
    const item = await prisma.webhookDeadLetter.findUnique({ where: { id } });
    if (!item) return;

    if (success) {
        return prisma.webhookDeadLetter.update({
            where: { id },
            data: { status: "replayed", processedAt: new Date() }
        });
    }

    const nextRetry = item.retryCount + 1;
    const isFinal = nextRetry >= item.maxRetries;

    return prisma.webhookDeadLetter.update({
        where: { id },
        data: {
            retryCount: nextRetry,
            status: isFinal ? "failed" : "retrying",
            errorMessage: error || item.errorMessage,
            nextRetryAt: isFinal
                ? null
                : new Date(Date.now() + (RETRY_DELAYS_MS[nextRetry] || 1_800_000))
        }
    });
}

export async function replayDeadLetter(id: string) {
    return prisma.webhookDeadLetter.update({
        where: { id },
        data: {
            status: "pending",
            retryCount: 0,
            nextRetryAt: new Date(),
            processedAt: null
        }
    });
}

export async function getDeadLetterStats() {
    const [pending, retrying, failed] = await Promise.all([
        prisma.webhookDeadLetter.count({ where: { status: "pending" } }),
        prisma.webhookDeadLetter.count({ where: { status: "retrying" } }),
        prisma.webhookDeadLetter.count({ where: { status: "failed" } })
    ]);
    return { pending, retrying, failed, total: pending + retrying + failed };
}
