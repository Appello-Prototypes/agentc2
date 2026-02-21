/**
 * Structured JSON Logger
 *
 * Provides machine-readable JSON logs for security-relevant events.
 * Outputs to stdout in JSON format for consumption by log aggregators
 * (e.g., Datadog, Grafana Loki, CloudWatch).
 *
 * Usage:
 *   import { securityLogger } from "@repo/agentc2/lib/logger";
 *   securityLogger.info("tool.execute", { toolName, agentId, status: "success" });
 *   securityLogger.warn("guardrail.blocked", { agentId, guardrailKey, input: input.slice(0, 100) });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    event: string;
    message: string;
    timestamp: string;
    service: string;
    traceId?: string;
    tenantId?: string;
    userId?: string;
    agentId?: string;
    [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const MIN_LEVEL = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function emit(entry: LogEntry): void {
    if (!shouldLog(entry.level)) return;
    const output = JSON.stringify(entry);
    if (entry.level === "error") {
        process.stderr.write(output + "\n");
    } else {
        process.stdout.write(output + "\n");
    }
}

export interface LogContext {
    traceId?: string;
    tenantId?: string;
    userId?: string;
    agentId?: string;
    [key: string]: unknown;
}

function log(level: LogLevel, event: string, message: string, context?: LogContext): void {
    const { traceId, tenantId, userId, agentId, ...rest } = context || {};
    emit({
        level,
        event,
        message,
        timestamp: new Date().toISOString(),
        service: "agentc2",
        traceId,
        tenantId,
        userId,
        agentId,
        ...rest
    });
}

export const securityLogger = {
    debug: (event: string, context?: LogContext) => log("debug", event, event, context),
    info: (event: string, context?: LogContext) => log("info", event, event, context),
    warn: (event: string, context?: LogContext) => log("warn", event, event, context),
    error: (event: string, context?: LogContext) => log("error", event, event, context),

    authLogin: (userId: string, ip?: string) =>
        log("info", "auth.login", "User logged in", { userId, ip }),
    authFailure: (email: string, ip?: string) =>
        log("warn", "auth.failure", "Login failed", { email, ip } as LogContext),
    authLogout: (userId: string) => log("info", "auth.logout", "User logged out", { userId }),

    toolExecute: (toolName: string, agentId: string, status: string, durationMs?: number) =>
        log("info", "tool.execute", `Tool ${toolName} ${status}`, {
            agentId,
            toolName,
            status,
            durationMs
        } as LogContext),

    credentialAccess: (connectionId: string, userId?: string, tenantId?: string) =>
        log("info", "credential.access", "Credential decrypted", {
            connectionId,
            userId,
            tenantId
        }),

    guardrailBlock: (agentId: string, guardrailKey: string, direction: "input" | "output") =>
        log("warn", "guardrail.blocked", `Guardrail ${guardrailKey} blocked ${direction}`, {
            agentId,
            guardrailKey,
            direction
        } as LogContext),

    budgetViolation: (agentId: string, level: string, currentUsd: number, limitUsd: number) =>
        log("warn", "budget.violation", `Budget ${level} limit exceeded`, {
            agentId,
            level,
            currentUsd,
            limitUsd
        } as LogContext),

    webhookReceived: (triggerId: string, verified: boolean) =>
        log("info", "webhook.received", `Webhook ${verified ? "verified" : "unverified"}`, {
            triggerId,
            verified
        } as LogContext),

    rateLimited: (key: string, ip?: string) =>
        log("warn", "rate.limited", `Rate limit hit: ${key}`, { key, ip } as LogContext)
};
