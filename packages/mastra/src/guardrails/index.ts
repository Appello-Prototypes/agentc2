/**
 * Guardrail Enforcement Module
 *
 * Provides pre-execution (input) and post-execution (output) guardrail checks
 * for agents. Since workflows and networks invoke agents, guardrail enforcement
 * at the agent layer cascades automatically to all modalities.
 *
 * Usage:
 *   const check = await enforceInputGuardrails(agentId, input);
 *   if (check.blocked) { return error; }
 *   // ... run agent ...
 *   const outputCheck = await enforceOutputGuardrails(agentId, output);
 */

import { prisma } from "@repo/database";

export interface GuardrailConfig {
    input?: {
        maxLength?: number;
        blockPII?: boolean;
        blockPromptInjection?: boolean;
        blockedPatterns?: string[];
    };
    output?: {
        maxLength?: number;
        blockPII?: boolean;
        blockToxicity?: boolean;
        blockedPatterns?: string[];
    };
    execution?: {
        maxDurationMs?: number;
        maxToolCalls?: number;
        maxCostUsd?: number;
    };
}

export interface GuardrailResult {
    blocked: boolean;
    violations: Array<{
        guardrailKey: string;
        message: string;
        severity: "block" | "warn" | "flag";
    }>;
}

// Common PII patterns
const PII_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{16}\b/, // Credit card (basic)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card with separators
    /\b[A-Z]{2}\d{6,9}\b/i // Passport-like
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?prior\s+instructions/i,
    /you\s+are\s+now\s+a\s+/i,
    /system\s*:\s*you/i,
    /\[\s*INST\s*\]/i,
    /<<\s*SYS\s*>>/i
];

function containsPII(text: string): boolean {
    return PII_PATTERNS.some((pattern) => pattern.test(text));
}

function containsPromptInjection(text: string): boolean {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesBlockedPatterns(text: string, patterns: string[]): string | null {
    for (const pattern of patterns) {
        try {
            const regex = new RegExp(pattern, "i");
            if (regex.test(text)) return pattern;
        } catch {
            // Invalid regex pattern, skip
        }
    }
    return null;
}

/**
 * Load guardrail config for an agent from the database.
 */
async function loadGuardrailConfig(agentId: string): Promise<GuardrailConfig | null> {
    const policy = await prisma.guardrailPolicy.findUnique({
        where: { agentId }
    });
    if (!policy?.configJson) return null;
    return policy.configJson as unknown as GuardrailConfig;
}

/**
 * Record a guardrail event for audit/alerting purposes.
 */
async function recordGuardrailEvent(
    agentId: string,
    guardrailKey: string,
    eventType: "BLOCKED" | "FLAGGED" | "MODIFIED",
    details: Record<string, unknown>,
    runId?: string,
    tenantId?: string
) {
    try {
        await prisma.guardrailEvent.create({
            data: {
                agentId,
                runId,
                tenantId,
                type: eventType,
                guardrailKey,
                reason: details.message ? String(details.message) : `${eventType}: ${guardrailKey}`,
                inputSnippet: details.inputPreview ? String(details.inputPreview) : undefined,
                outputSnippet: details.outputPreview ? String(details.outputPreview) : undefined
            }
        });
    } catch (error) {
        console.warn("[Guardrails] Failed to record event:", error);
    }
}

/**
 * Enforce input guardrails before agent execution.
 */
export async function enforceInputGuardrails(
    agentId: string,
    input: string,
    options?: { runId?: string; tenantId?: string }
): Promise<GuardrailResult> {
    const config = await loadGuardrailConfig(agentId);
    if (!config?.input) {
        return { blocked: false, violations: [] };
    }

    const violations: GuardrailResult["violations"] = [];
    const inputConfig = config.input;

    // Check max length
    if (inputConfig.maxLength && input.length > inputConfig.maxLength) {
        violations.push({
            guardrailKey: "input.maxLength",
            message: `Input exceeds maximum length of ${inputConfig.maxLength} characters`,
            severity: "block"
        });
    }

    // Check for PII
    if (inputConfig.blockPII && containsPII(input)) {
        violations.push({
            guardrailKey: "input.blockPII",
            message: "Input contains potential PII (personal identifiable information)",
            severity: "block"
        });
    }

    // Check for prompt injection
    if (inputConfig.blockPromptInjection && containsPromptInjection(input)) {
        violations.push({
            guardrailKey: "input.blockPromptInjection",
            message: "Input contains potential prompt injection attempt",
            severity: "block"
        });
    }

    // Check blocked patterns
    if (inputConfig.blockedPatterns && inputConfig.blockedPatterns.length > 0) {
        const matchedPattern = matchesBlockedPatterns(input, inputConfig.blockedPatterns);
        if (matchedPattern) {
            violations.push({
                guardrailKey: "input.blockedPatterns",
                message: `Input matches blocked pattern: ${matchedPattern}`,
                severity: "block"
            });
        }
    }

    const blocked = violations.some((v) => v.severity === "block");

    // Record events for violations
    if (violations.length > 0) {
        for (const v of violations) {
            await recordGuardrailEvent(
                agentId,
                v.guardrailKey,
                v.severity === "block" ? "BLOCKED" : "FLAGGED",
                { message: v.message, inputPreview: input.slice(0, 200) },
                options?.runId,
                options?.tenantId
            );
        }
    }

    return { blocked, violations };
}

/**
 * Enforce output guardrails after agent execution.
 */
export async function enforceOutputGuardrails(
    agentId: string,
    output: string,
    options?: { runId?: string; tenantId?: string }
): Promise<GuardrailResult> {
    const config = await loadGuardrailConfig(agentId);
    if (!config?.output) {
        return { blocked: false, violations: [] };
    }

    const violations: GuardrailResult["violations"] = [];
    const outputConfig = config.output;

    // Check max length
    if (outputConfig.maxLength && output.length > outputConfig.maxLength) {
        violations.push({
            guardrailKey: "output.maxLength",
            message: `Output exceeds maximum length of ${outputConfig.maxLength} characters`,
            severity: "warn"
        });
    }

    // Check for PII leakage
    if (outputConfig.blockPII && containsPII(output)) {
        violations.push({
            guardrailKey: "output.blockPII",
            message: "Output contains potential PII leakage",
            severity: "block"
        });
    }

    // Check blocked patterns
    if (outputConfig.blockedPatterns && outputConfig.blockedPatterns.length > 0) {
        const matchedPattern = matchesBlockedPatterns(output, outputConfig.blockedPatterns);
        if (matchedPattern) {
            violations.push({
                guardrailKey: "output.blockedPatterns",
                message: `Output matches blocked pattern: ${matchedPattern}`,
                severity: "block"
            });
        }
    }

    const blocked = violations.some((v) => v.severity === "block");

    // Record events for violations
    if (violations.length > 0) {
        for (const v of violations) {
            await recordGuardrailEvent(
                agentId,
                v.guardrailKey,
                v.severity === "block" ? "BLOCKED" : "FLAGGED",
                { message: v.message, outputPreview: output.slice(0, 200) },
                options?.runId,
                options?.tenantId
            );
        }
    }

    return { blocked, violations };
}

/**
 * Get execution guardrail limits for an agent.
 * Returns the execution limits that should be applied during runtime.
 */
export async function getExecutionLimits(
    agentId: string
): Promise<GuardrailConfig["execution"] | null> {
    const config = await loadGuardrailConfig(agentId);
    return config?.execution || null;
}
