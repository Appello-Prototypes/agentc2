/**
 * Structured JSON Logger (pino-based)
 *
 * Production: Machine-readable JSON for log aggregators (Grafana Loki, Logtail, Datadog)
 * Development: Pretty-printed human-readable output
 *
 * Features:
 * - Automatic field redaction (passwords, tokens, API keys, secrets)
 * - Child loggers with per-request context (requestId, userId, organizationId)
 * - Async, non-blocking I/O via pino's native transport
 *
 * Usage:
 *   import { logger, createRequestLogger } from "@repo/agentc2/lib/logger";
 *   logger.info({ toolName, agentId }, "Tool executed successfully");
 *
 *   // Per-request child logger (in middleware)
 *   const reqLogger = createRequestLogger({ requestId, userId, organizationId });
 *   reqLogger.info({ path: "/api/agents" }, "Request handled");
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const REDACT_PATHS = [
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
    "authorization",
    "cookie",
    "accessToken",
    "refreshToken",
    "credentials",
    "CREDENTIAL_ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "ELEVENLABS_API_KEY",
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-api-key']"
];

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    redact: {
        paths: REDACT_PATHS,
        censor: "[REDACTED]"
    },
    ...(isDev
        ? {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "SYS:HH:MM:ss",
                      ignore: "pid,hostname"
                  }
              }
          }
        : {}),
    base: {
        service: "agentc2",
        env: process.env.NODE_ENV || "development"
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        }
    }
});

export type Logger = pino.Logger;

export interface RequestContext {
    requestId?: string;
    userId?: string;
    organizationId?: string;
    agentId?: string;
    traceId?: string;
}

export function createRequestLogger(context: RequestContext): Logger {
    return logger.child(context);
}

/**
 * Backward-compatible security logger interface.
 * Wraps pino logger for structured security event logging.
 */
export const securityLogger = {
    debug: (event: string, context?: Record<string, unknown>) =>
        logger.debug({ event, ...context }, event),
    info: (event: string, context?: Record<string, unknown>) =>
        logger.info({ event, ...context }, event),
    warn: (event: string, context?: Record<string, unknown>) =>
        logger.warn({ event, ...context }, event),
    error: (event: string, context?: Record<string, unknown>) =>
        logger.error({ event, ...context }, event),

    authLogin: (userId: string, ip?: string) =>
        logger.info({ event: "auth.login", userId, ip }, "User logged in"),
    authFailure: (email: string, ip?: string) =>
        logger.warn({ event: "auth.failure", email, ip }, "Login failed"),
    authLogout: (userId: string) =>
        logger.info({ event: "auth.logout", userId }, "User logged out"),

    toolExecute: (toolName: string, agentId: string, status: string, durationMs?: number) =>
        logger.info(
            { event: "tool.execute", toolName, agentId, status, durationMs },
            `Tool ${toolName} ${status}`
        ),

    credentialAccess: (connectionId: string, userId?: string, tenantId?: string) =>
        logger.info(
            { event: "credential.access", connectionId, userId, tenantId },
            "Credential decrypted"
        ),

    guardrailBlock: (agentId: string, guardrailKey: string, direction: "input" | "output") =>
        logger.warn(
            { event: "guardrail.blocked", agentId, guardrailKey, direction },
            `Guardrail ${guardrailKey} blocked ${direction}`
        ),

    budgetViolation: (agentId: string, level: string, currentUsd: number, limitUsd: number) =>
        logger.warn(
            { event: "budget.violation", agentId, level, currentUsd, limitUsd },
            `Budget ${level} limit exceeded`
        ),

    webhookReceived: (triggerId: string, verified: boolean) =>
        logger.info(
            { event: "webhook.received", triggerId, verified },
            `Webhook ${verified ? "verified" : "unverified"}`
        ),

    rateLimited: (key: string, ip?: string) =>
        logger.warn({ event: "rate.limited", key, ip }, `Rate limit hit: ${key}`)
};

export type LogContext = Record<string, unknown>;
