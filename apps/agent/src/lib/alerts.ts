/**
 * Centralized Alert Service
 *
 * Provides unified alerting for the continuous learning system.
 * Supports:
 * - Database persistence (AgentAlert)
 * - Slack notifications (optional)
 * - Audit logging
 */

import { prisma } from "@repo/database";

// =============================================================================
// Types
// =============================================================================

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
    | "regression"
    | "experiment_failed"
    | "experiment_timeout"
    | "auto_promotion"
    | "threshold_breach"
    | "learning_paused"
    | "learning_resumed";

export interface SendAlertParams {
    agentId: string;
    agentSlug?: string;
    severity: AlertSeverity;
    type: AlertType;
    message: string;
    source?: string;
    metadata?: Record<string, unknown>;
}

// Map our severity types to Prisma enum values
const SEVERITY_MAP = {
    info: "INFO" as const,
    warning: "WARNING" as const,
    critical: "CRITICAL" as const
};

// =============================================================================
// Slack Configuration
// =============================================================================

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_ALERTS_CHANNEL = process.env.SLACK_ALERTS_CHANNEL;

/**
 * Check if Slack alerting is configured
 */
export function isSlackConfigured(): boolean {
    return !!(SLACK_BOT_TOKEN && SLACK_ALERTS_CHANNEL);
}

// =============================================================================
// Alert Service Functions
// =============================================================================

/**
 * Send an alert through all configured channels
 */
export async function sendAlert(params: SendAlertParams): Promise<{
    alertId: string;
    slackSent: boolean;
}> {
    const { agentId, agentSlug, severity, type, message, metadata } = params;

    // 1. Create AgentAlert record in database
    // Note: AgentAlert uses SYSTEM as source since learning-specific sources aren't in the enum
    // The type is stored in the audit log metadata
    const alert = await prisma.agentAlert.create({
        data: {
            agentId,
            severity: SEVERITY_MAP[severity],
            message: `[${type.toUpperCase()}] ${message}`,
            source: "SYSTEM"
        }
    });

    // 2. Create audit log entry with full metadata
    await prisma.auditLog.create({
        data: {
            action: `ALERT_${type.toUpperCase().replace(/-/g, "_")}`,
            entityType: "Agent",
            entityId: agentId,
            actorId: "system:alerts",
            metadata: {
                alertId: alert.id,
                severity,
                type,
                message,
                ...metadata
            }
        }
    });

    // 3. Send to Slack if configured
    let slackSent = false;
    if (isSlackConfigured()) {
        try {
            await sendSlackAlert({
                agentId,
                agentSlug: agentSlug || agentId,
                severity,
                type,
                message,
                metadata
            });
            slackSent = true;
        } catch (error) {
            console.error("[Alerts] Failed to send Slack alert:", error);
        }
    }

    return {
        alertId: alert.id,
        slackSent
    };
}

/**
 * Send alert to Slack channel
 */
async function sendSlackAlert(params: {
    agentId: string;
    agentSlug: string;
    severity: AlertSeverity;
    type: AlertType;
    message: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const { agentSlug, severity, type, message, metadata } = params;

    // Severity to emoji mapping
    const severityEmoji: Record<AlertSeverity, string> = {
        info: ":information_source:",
        warning: ":warning:",
        critical: ":rotating_light:"
    };

    // Severity to color mapping
    const severityColor: Record<AlertSeverity, string> = {
        info: "#3498db",
        warning: "#f39c12",
        critical: "#e74c3c"
    };

    // Build Slack message blocks
    const blocks = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${severityEmoji[severity]} *${severity.toUpperCase()}* - ${type.replace(/_/g, " ").toUpperCase()}`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: message
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*Agent:* ${agentSlug} | *Time:* ${new Date().toISOString()}`
                }
            ]
        }
    ];

    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
        const metadataText = Object.entries(metadata)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `*${key}:* ${JSON.stringify(value)}`)
            .join(" | ");

        if (metadataText) {
            blocks.push({
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: metadataText
                    }
                ]
            });
        }
    }

    // Send to Slack
    const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            channel: SLACK_ALERTS_CHANNEL,
            text: `${severityEmoji[severity]} [${agentSlug}] ${message}`,
            attachments: [
                {
                    color: severityColor[severity],
                    blocks
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
    }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<void> {
    await prisma.agentAlert.update({
        where: { id: alertId },
        data: { resolvedAt: new Date() }
    });
}

/**
 * Resolve all SYSTEM alerts for an agent that match a type pattern
 * (Type is stored in the message prefix)
 */
export async function resolveAlertsByType(agentId: string, type: AlertType): Promise<number> {
    const result = await prisma.agentAlert.updateMany({
        where: {
            agentId,
            source: "SYSTEM",
            message: { startsWith: `[${type.toUpperCase()}]` },
            resolvedAt: null
        },
        data: { resolvedAt: new Date() }
    });

    return result.count;
}

// =============================================================================
// Convenience Functions for Common Alerts
// =============================================================================

/**
 * Send a regression detected alert
 */
export async function alertRegression(params: {
    agentId: string;
    agentSlug?: string;
    experimentId: string;
    metric: string;
    baseline: number;
    candidate: number;
}): Promise<void> {
    const regressionPct = ((params.candidate - params.baseline) / params.baseline) * 100;

    await sendAlert({
        agentId: params.agentId,
        agentSlug: params.agentSlug,
        severity: "warning",
        type: "regression",
        message: `Regression detected in experiment ${params.experimentId}: ${params.metric} decreased by ${Math.abs(regressionPct).toFixed(1)}%`,
        metadata: {
            experimentId: params.experimentId,
            metric: params.metric,
            baseline: params.baseline,
            candidate: params.candidate,
            regressionPct
        }
    });
}

/**
 * Send an auto-promotion success alert
 */
export async function alertAutoPromotion(params: {
    agentId: string;
    agentSlug?: string;
    proposalId: string;
    proposalTitle: string;
    winRate: number;
    confidenceScore: number;
}): Promise<void> {
    await sendAlert({
        agentId: params.agentId,
        agentSlug: params.agentSlug,
        severity: "info",
        type: "auto_promotion",
        message: `Auto-promoted proposal "${params.proposalTitle}" with ${(params.winRate * 100).toFixed(1)}% win rate and ${(params.confidenceScore * 100).toFixed(1)}% confidence`,
        metadata: {
            proposalId: params.proposalId,
            proposalTitle: params.proposalTitle,
            winRate: params.winRate,
            confidenceScore: params.confidenceScore
        }
    });
}

/**
 * Send an experiment timeout alert
 */
export async function alertExperimentTimeout(params: {
    agentId: string;
    agentSlug?: string;
    experimentId: string;
    durationHours: number;
    runCount: number;
}): Promise<void> {
    await sendAlert({
        agentId: params.agentId,
        agentSlug: params.agentSlug,
        severity: "warning",
        type: "experiment_timeout",
        message: `Experiment ${params.experimentId} timed out after ${params.durationHours} hours with only ${params.runCount} runs. Results may be inconclusive.`,
        metadata: {
            experimentId: params.experimentId,
            durationHours: params.durationHours,
            runCount: params.runCount
        }
    });
}
