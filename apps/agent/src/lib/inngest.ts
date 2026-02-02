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
            };
        };
        "learning/session.start": {
            data: {
                agentId: string;
                triggerReason: string;
                triggerType?: "threshold" | "scheduled" | "manual";
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
    }>()
});
