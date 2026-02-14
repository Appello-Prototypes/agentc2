import { Inngest, EventSchemas } from "inngest";

/**
 * Inngest client for background job execution.
 *
 * Events:
 * - goal/submitted: Triggered when a user submits a new goal
 * - goal/retry: Triggered for manual retry of a failed goal
 *
 * Agent Workspace Events:
 * - run/completed: Triggered when an agent run completes
 * - run/evaluate: Triggered to run evaluations on a completed run
 * - evaluation/completed: Triggered when an evaluation job completes
 * - guardrail/event: Triggered when a guardrail blocks/modifies content
 * - budget/check: Triggered to check budget thresholds
 * - budget/alert: Triggered when budget threshold is exceeded
 *
 * Closed-Loop Learning Events:
 * - learning/signal.detected: Triggered when a learning signal is detected
 * - learning/session.start: Triggered to start a new learning session
 * - learning/signals.extract: Triggered to extract signals from a dataset
 * - learning/proposals.generate: Triggered to generate improvement proposals
 * - learning/experiment.run: Triggered to run an A/B experiment
 * - learning/approval.request: Triggered to request human approval
 */
export const inngest = new Inngest({
    id: "mastra-agent",
    schemas: new EventSchemas().fromRecord<{
        "goal/submitted": {
            data: {
                goalId: string;
                userId: string;
            };
        };
        "goal/retry": {
            data: {
                goalId: string;
                userId: string;
                attempt: number;
            };
        };
        // Agent Workspace Events
        "run/completed": {
            data: {
                runId: string;
                agentId: string;
                status: "COMPLETED" | "FAILED";
                durationMs?: number;
                totalTokens?: number;
                costUsd?: number;
            };
        };
        "run/evaluate": {
            data: {
                runId: string;
                agentId: string;
            };
        };
        "evaluation/completed": {
            data: {
                evaluationId: string;
                runId: string;
                agentId: string;
                scores: Record<string, number>;
            };
        };
        "guardrail/event": {
            data: {
                agentId: string;
                runId?: string;
                type: "BLOCKED" | "MODIFIED" | "FLAGGED";
                guardrailKey: string;
                reason: string;
            };
        };
        "budget/check": {
            data: {
                agentId: string;
            };
        };
        "budget/alert": {
            data: {
                agentId: string;
                currentUsage: number;
                limit: number;
                percentUsed: number;
            };
        };
        // Closed-Loop Learning Events
        "learning/signal.detected": {
            data: {
                agentId: string;
                runId: string;
                signalType: string;
                severity: string;
                scores?: Record<string, number>;
                pattern?: string;
                evidence?: string;
                category?: string;
            };
        };
        "learning/session.start": {
            data: {
                agentId: string;
                triggerReason: string;
                triggerType?: "threshold" | "scheduled" | "manual";
                sessionId?: string; // If provided, use existing session instead of creating new
            };
        };
        "learning/session.scheduled": {
            data: {
                timestamp?: string; // ISO date string
            };
        };
        "learning/signals.extract": {
            data: {
                sessionId: string;
                agentId: string;
                datasetId: string;
            };
        };
        "learning/proposals.generate": {
            data: {
                sessionId: string;
                agentId: string;
                signalCount: number;
            };
        };
        "learning/experiment.run": {
            data: {
                sessionId: string;
                experimentId: string;
                agentId: string;
            };
        };
        "learning/approval.request": {
            data: {
                sessionId: string;
                agentId: string;
                proposalId: string;
            };
        };
        "learning/version.promote": {
            data: {
                sessionId: string;
                approvedBy: string;
                rationale?: string;
            };
        };
        // Daily metrics rollup
        "metrics/daily.rollup": {
            data: {
                date?: string; // ISO date string, defaults to yesterday
            };
        };
        // Simulation Events
        "simulation/session.start": {
            data: {
                sessionId: string;
                agentId: string;
                theme: string;
                targetCount: number;
                concurrency: number;
            };
        };
        "simulation/batch.run": {
            data: {
                sessionId: string;
                agentId: string;
                theme: string;
                batchIndex: number;
                batchSize: number;
            };
        };
        // BIM Events
        "bim/ifc.parse": {
            data: {
                modelId: string;
                versionId: string;
                sourceKey: string;
                sourceUri?: string;
            };
        };
        // Agent Invocation Events
        "agent/invoke.async": {
            data: {
                runId: string;
                agentId: string;
                agentSlug: string;
                input: string;
                context?: Record<string, unknown>;
                maxSteps?: number;
                idempotencyKey?: string;
            };
        };
        // Agent Schedule Events
        "agent/schedule.trigger": {
            data: {
                scheduleId: string;
                agentId: string;
                input?: string;
            };
        };
        // Agent Trigger Events
        "agent/trigger.fire": {
            data: {
                triggerId: string;
                agentId: string;
                payload: Record<string, unknown>;
            };
        };
        // Feedback & Calibration Events
        "feedback/submitted": {
            data: {
                feedbackId: string;
                agentId: string;
                runId: string;
                thumbs: boolean | null;
                rating: number | null;
                comment: string | null;
                source?: string;
            };
        };
        "calibration/drift.detected": {
            data: {
                agentId: string;
                alignmentRate: number;
                avgDisagreement: number;
                bias: number;
            };
        };
        // Admin Portal Events
        "admin/tenant.suspended": {
            data: {
                orgId: string;
                reason: string;
                performedBy: string;
            };
        };
        "admin/tenant.reactivated": {
            data: {
                orgId: string;
                performedBy: string;
            };
        };
        "admin/tenant.delete-requested": {
            data: {
                orgId: string;
                performedBy: string;
            };
        };
        "admin/health-check": {
            data: {
                timestamp?: string;
            };
        };
        "admin/quota.warning": {
            data: {
                orgId: string;
                metric: string;
                currentValue: number;
                limit: number;
                percentUsed: number;
            };
        };
        // AAR Self-Improving Lifecycle Events
        "learning/skill.develop": {
            data: {
                agentId: string;
                recommendationId: string;
                category: string;
                description: string;
                evidence: unknown;
                title: string;
            };
        };
        "learning/document.create": {
            data: {
                agentId: string;
                recommendationId: string;
                category: string;
                description: string;
                evidence: unknown;
                title: string;
                docType: string;
            };
        };
        // Gmail Processing Events
        "gmail/message.process": {
            data: {
                integrationId: string;
                gmailAddress: string;
                organizationId: string;
                triggerId: string;
                agentId: string;
                workspaceId: string | null;
                slackUserId: string | null;
                previousHistoryId: string;
                newHistoryId: string;
            };
        };
    }>()
});
