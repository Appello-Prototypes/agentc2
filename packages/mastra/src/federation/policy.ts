/**
 * Federation policy engine.
 *
 * Evaluates rate limits, data classification, content policies (PII),
 * and circuit breakers before allowing cross-org agent communication.
 */

import { prisma } from "@repo/database";
import { writeAuditLogAsync } from "../audit";

export interface PolicyEvaluation {
    allowed: boolean;
    result: "approved" | "filtered" | "blocked";
    reason?: string;
    details?: Record<string, unknown>;
    filteredContent?: string;
}

// ---------------------------------------------------------------------------
// PII Detection / Redaction
// ---------------------------------------------------------------------------

const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
    {
        name: "email",
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: "[EMAIL_REDACTED]"
    },
    {
        name: "phone",
        pattern: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
        replacement: "[PHONE_REDACTED]"
    },
    {
        name: "ssn",
        pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
        replacement: "[SSN_REDACTED]"
    },
    {
        name: "credit_card",
        pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
        replacement: "[CC_REDACTED]"
    },
    {
        name: "ip_address",
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: "[IP_REDACTED]"
    }
];

export interface PiiScanResult {
    hasPii: boolean;
    detectedTypes: string[];
    redactedContent: string;
}

export function scanForPii(content: string): PiiScanResult {
    const detectedTypes: string[] = [];
    let redacted = content;

    for (const { name, pattern, replacement } of PII_PATTERNS) {
        const cloned = new RegExp(pattern.source, pattern.flags);
        if (cloned.test(content)) {
            detectedTypes.push(name);
            redacted = redacted.replace(pattern, replacement);
        }
    }

    return {
        hasPii: detectedTypes.length > 0,
        detectedTypes,
        redactedContent: redacted
    };
}

/**
 * Apply content filtering based on data classification.
 *
 * - "restricted": block messages containing PII entirely
 * - "confidential": redact PII before delivery
 * - "internal" / "public": no filtering
 */
export function applyContentFilter(
    content: string,
    dataClassification: string
): PolicyEvaluation | null {
    if (dataClassification === "public" || dataClassification === "internal") {
        return null;
    }

    const scan = scanForPii(content);
    if (!scan.hasPii) return null;

    if (dataClassification === "restricted") {
        return {
            allowed: false,
            result: "blocked",
            reason: "Message contains PII and data classification is restricted",
            details: { detectedTypes: scan.detectedTypes }
        };
    }

    if (dataClassification === "confidential") {
        return {
            allowed: true,
            result: "filtered",
            reason: "PII redacted from message",
            details: { detectedTypes: scan.detectedTypes },
            filteredContent: scan.redactedContent
        };
    }

    return null;
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

/**
 * In-memory rate limit tracking.
 * Key: `${agreementId}:${period}:${bucket}`
 */
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(agreementId: string, period: "hour" | "day"): string {
    const now = new Date();
    const bucket =
        period === "hour"
            ? `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`
            : `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
    return `${agreementId}:${period}:${bucket}`;
}

function checkAndIncrementRateLimit(
    agreementId: string,
    maxPerHour: number,
    maxPerDay: number
): PolicyEvaluation | null {
    const now = Date.now();

    // Check hourly limit
    const hourKey = getRateLimitKey(agreementId, "hour");
    const hourCounter = rateLimitCounters.get(hourKey);
    const hourResetAt = now + 3600_000;
    if (hourCounter) {
        if (now > hourCounter.resetAt) {
            rateLimitCounters.set(hourKey, { count: 1, resetAt: hourResetAt });
        } else if (hourCounter.count >= maxPerHour) {
            return {
                allowed: false,
                result: "blocked",
                reason: `Rate limit exceeded: ${maxPerHour} requests/hour`,
                details: { limit: maxPerHour, period: "hour", current: hourCounter.count }
            };
        } else {
            hourCounter.count++;
        }
    } else {
        rateLimitCounters.set(hourKey, { count: 1, resetAt: hourResetAt });
    }

    // Check daily limit
    const dayKey = getRateLimitKey(agreementId, "day");
    const dayCounter = rateLimitCounters.get(dayKey);
    const dayResetAt = now + 86400_000;
    if (dayCounter) {
        if (now > dayCounter.resetAt) {
            rateLimitCounters.set(dayKey, { count: 1, resetAt: dayResetAt });
        } else if (dayCounter.count >= maxPerDay) {
            return {
                allowed: false,
                result: "blocked",
                reason: `Rate limit exceeded: ${maxPerDay} requests/day`,
                details: { limit: maxPerDay, period: "day", current: dayCounter.count }
            };
        } else {
            dayCounter.count++;
        }
    } else {
        rateLimitCounters.set(dayKey, { count: 1, resetAt: dayResetAt });
    }

    return null;
}

// ---------------------------------------------------------------------------
// Circuit Breakers
// ---------------------------------------------------------------------------

interface CircuitState {
    successes: number;
    errors: number;
    windowStart: number;
    rateLimitExceededCount: number;
    rateLimitWindowStart: number;
}

const circuitStates = new Map<string, CircuitState>();

const CIRCUIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_MIN_REQUESTS = 10;
const CIRCUIT_ERROR_THRESHOLD = 0.5; // 50%
const RATE_LIMIT_EXCEED_THRESHOLD = 3;
const RATE_LIMIT_EXCEED_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getCircuitState(agreementId: string): CircuitState {
    const now = Date.now();
    let state = circuitStates.get(agreementId);
    if (!state || now - state.windowStart > CIRCUIT_WINDOW_MS) {
        state = {
            successes: 0,
            errors: 0,
            windowStart: now,
            rateLimitExceededCount: state?.rateLimitExceededCount ?? 0,
            rateLimitWindowStart: state?.rateLimitWindowStart ?? now
        };
        circuitStates.set(agreementId, state);
    }
    if (now - state.rateLimitWindowStart > RATE_LIMIT_EXCEED_WINDOW_MS) {
        state.rateLimitExceededCount = 0;
        state.rateLimitWindowStart = now;
    }
    return state;
}

export function recordCircuitOutcome(agreementId: string, success: boolean): void {
    const state = getCircuitState(agreementId);
    if (success) {
        state.successes++;
    } else {
        state.errors++;
    }
}

export function recordRateLimitExceeded(agreementId: string): void {
    const state = getCircuitState(agreementId);
    state.rateLimitExceededCount++;
}

async function checkCircuitBreaker(agreementId: string): Promise<PolicyEvaluation | null> {
    const state = getCircuitState(agreementId);
    const total = state.successes + state.errors;

    if (total >= CIRCUIT_MIN_REQUESTS) {
        const errorRate = state.errors / total;
        if (errorRate >= CIRCUIT_ERROR_THRESHOLD) {
            // Auto-suspend: look up both org IDs for audit
            const agreement = await prisma.federationAgreement.findUnique({
                where: { id: agreementId },
                select: { initiatorOrgId: true, responderOrgId: true, status: true }
            });
            if (agreement && agreement.status === "active") {
                await prisma.federationAgreement.update({
                    where: { id: agreementId },
                    data: {
                        status: "suspended",
                        suspendedAt: new Date(),
                        suspendedReason: `Circuit breaker tripped: ${(errorRate * 100).toFixed(0)}% error rate over ${total} requests`
                    }
                });
                writeAuditLogAsync({
                    organizationId: agreement.initiatorOrgId,
                    actorType: "system",
                    actorId: "circuit-breaker",
                    action: "federation.circuit_breaker",
                    resource: `federation_agreement:${agreementId}`,
                    outcome: "success",
                    metadata: { errorRate, total, window: "5min" }
                });
                writeAuditLogAsync({
                    organizationId: agreement.responderOrgId,
                    actorType: "system",
                    actorId: "circuit-breaker",
                    action: "federation.circuit_breaker",
                    resource: `federation_agreement:${agreementId}`,
                    outcome: "success",
                    metadata: { errorRate, total, window: "5min" }
                });
            }
            return {
                allowed: false,
                result: "blocked",
                reason: `Circuit breaker open: ${(errorRate * 100).toFixed(0)}% error rate — connection auto-suspended`,
                details: { errorRate, total }
            };
        }
    }

    if (state.rateLimitExceededCount >= RATE_LIMIT_EXCEED_THRESHOLD) {
        return {
            allowed: false,
            result: "blocked",
            reason: `Throttled: rate limit exceeded ${state.rateLimitExceededCount} times in the last hour`,
            details: { rateLimitExceededCount: state.rateLimitExceededCount }
        };
    }

    return null;
}

// ---------------------------------------------------------------------------
// Main Policy Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a federation request should be allowed.
 */
export async function evaluatePolicy(
    agreementId: string,
    sourceOrgId: string,
    targetAgentSlug: string,
    messageContent?: string
): Promise<PolicyEvaluation> {
    // Circuit breaker check first (cheapest)
    const circuitResult = await checkCircuitBreaker(agreementId);
    if (circuitResult) return circuitResult;

    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId },
        select: {
            status: true,
            initiatorOrgId: true,
            responderOrgId: true,
            maxRequestsPerHour: true,
            maxRequestsPerDay: true,
            dataClassification: true,
            requireHumanApproval: true,
            exposures: {
                where: {
                    enabled: true,
                    agent: { slug: targetAgentSlug },
                    ownerOrgId: { not: sourceOrgId }
                },
                select: {
                    id: true,
                    maxRequestsPerHour: true,
                    agent: { select: { slug: true } }
                }
            }
        }
    });

    if (!agreement) {
        return { allowed: false, result: "blocked", reason: "Agreement not found" };
    }

    if (agreement.status !== "active") {
        return {
            allowed: false,
            result: "blocked",
            reason: `Agreement is ${agreement.status}`
        };
    }

    if (agreement.initiatorOrgId !== sourceOrgId && agreement.responderOrgId !== sourceOrgId) {
        return { allowed: false, result: "blocked", reason: "Not authorized for this agreement" };
    }

    if (agreement.exposures.length === 0) {
        return {
            allowed: false,
            result: "blocked",
            reason: `Agent ${targetAgentSlug} is not exposed in this connection`
        };
    }

    if (agreement.requireHumanApproval) {
        return {
            allowed: false,
            result: "blocked",
            reason: "This connection requires human approval for each request"
        };
    }

    // Rate limiting
    const effectiveHourLimit =
        agreement.exposures[0]?.maxRequestsPerHour ?? agreement.maxRequestsPerHour;
    const rateLimitResult = checkAndIncrementRateLimit(
        agreementId,
        effectiveHourLimit,
        agreement.maxRequestsPerDay
    );
    if (rateLimitResult) {
        recordRateLimitExceeded(agreementId);
        return rateLimitResult;
    }

    // PII content filtering
    if (messageContent && agreement.dataClassification) {
        const contentResult = applyContentFilter(messageContent, agreement.dataClassification);
        if (contentResult) return contentResult;
    }

    return { allowed: true, result: "approved" };
}

/** Clear rate limit counters and circuit states (for testing). */
export function resetRateLimits(): void {
    rateLimitCounters.clear();
    circuitStates.clear();
}
