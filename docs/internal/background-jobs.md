# Background Jobs (Internal)

> **Internal Documentation** — This document covers Inngest background job implementation for the AgentC2 engineering team. Not published to the public documentation site.

---

## Overview

AgentC2 uses [Inngest](https://www.inngest.com/) for event-driven background job processing. Inngest provides durable function execution, automatic retries, step functions, scheduling (cron), and a development dashboard.

### Key Files

| File                                       | Purpose                                                  |
| ------------------------------------------ | -------------------------------------------------------- |
| `apps/agent/src/lib/inngest.ts`            | Inngest client instance with event schemas               |
| `apps/agent/src/lib/inngest-functions.ts`  | All function implementations (~8160 lines, 46 functions) |
| `apps/agent/src/app/api/inngest/route.ts`  | Next.js API route serving Inngest                        |
| `apps/agent/src/lib/learning-config.ts`    | Learning system configuration                            |
| `apps/agent/src/lib/campaign-functions.ts` | Campaign/mission orchestration functions                 |

---

## Inngest Client Setup

The Inngest client is configured in `apps/agent/src/lib/inngest.ts`:

```typescript
import { Inngest, EventSchemas } from "inngest";

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
        // ... all event types defined with TypeScript types
    }>()
});
```

The client ID is `"mastra-agent"` and all events are strongly typed using `EventSchemas.fromRecord<>()`.

---

## Event Publishing

Publish events from anywhere in the agent app:

```typescript
import { inngest } from "@/lib/inngest";

// Simple event
await inngest.send({
    name: "goal/submitted",
    data: {
        goalId: "goal-123",
        userId: "user-456"
    }
});

// Event with metadata
await inngest.send({
    name: "run/completed",
    data: {
        runId: "run-789",
        agentId: "agent-101",
        status: "COMPLETED",
        durationMs: 3500,
        totalTokens: 1200,
        costUsd: 0.05
    }
});
```

---

## Function Registration

All functions are registered at `/api/inngest` via Next.js API routes:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { inngestFunctions } from "@/lib/inngest-functions";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: inngestFunctions
});
```

The `inngestFunctions` array exports all registered functions:

```typescript
export const inngestFunctions = [
    executeGoalFunction,
    retryGoalFunction,
    // Agent Workspace functions
    runCompletedFunction,
    evaluationCompletedFunction,
    guardrailEventFunction,
    budgetCheckFunction,
    // Agent Invocation
    asyncInvokeFunction,
    // Scheduler
    scheduleTriggerFunction,
    agentScheduleTriggerFunction,
    gmailMessageProcessFunction,
    gmailFollowUpFunction,
    agentTriggerFireFunction,
    // AI Insights generation
    generateInsightsFunction,
    // Closed-Loop Learning functions
    runEvaluationFunction,
    feedbackReEvaluationFunction,
    calibrationCheckFunction,
    learningSignalDetectorFunction,
    scheduledLearningTriggerFunction,
    learningSessionStartFunction,
    learningSignalExtractionFunction,
    learningProposalGenerationFunction,
    learningExperimentRunFunction,
    experimentEvaluationCheckerFunction,
    learningApprovalHandlerFunction,
    learningVersionPromotionFunction,
    dailyMetricsRollupFunction,
    dailyHealthScoreFunction,
    // BIM functions
    bimIfcParseFunction,
    // Simulation functions
    simulationSessionStartFunction,
    simulationBatchRunFunction,
    // Conversation run finalization
    idleConversationFinalizerFunction,
    // Webhook subscription lifecycle
    webhookSubscriptionRenewalFunction,
    // Admin Portal functions
    adminTenantSuspendedFunction,
    adminTenantReactivatedFunction,
    adminTenantDeleteRequestedFunction,
    adminHealthCheckFunction,
    adminQuotaWarningFunction,
    // AAR Self-Improving Lifecycle
    recommendationGraduationFunction,
    learningSkillDevelopmentFunction,
    learningDocumentCreateFunction,
    // Campaign / Mission orchestration
    ...campaignFunctions,
    // Integration lifecycle
    integrationHealthCheckFunction,
    integrationToolRediscoveryFunction,
    integrationTokenRefreshFunction,
    // Remote Compute cleanup
    remoteComputeCleanupFunction,
    // Async workflow execution (coding pipeline)
    asyncWorkflowExecuteFunction,
    // Dark Factory pipeline stats
    pipelineStatsRollupFunction
];
```

---

## Key Events Reference

### Goal Events

| Event            | Description                   |
| ---------------- | ----------------------------- |
| `goal/submitted` | User submits a new goal       |
| `goal/retry`     | Manual retry of a failed goal |

### Agent Workspace Events

| Event                   | Description                                  |
| ----------------------- | -------------------------------------------- |
| `run/completed`         | Agent run completes (COMPLETED or FAILED)    |
| `run/evaluate`          | Trigger evaluations on a completed run       |
| `evaluation/completed`  | Evaluation job finishes with scores          |
| `evaluation/reevaluate` | Feedback-triggered re-evaluation             |
| `guardrail/event`       | Guardrail blocks, modifies, or flags content |
| `budget/check`          | Check budget thresholds for an agent         |
| `budget/alert`          | Budget threshold exceeded                    |

### Agent Invocation & Scheduling Events

| Event                    | Description                                |
| ------------------------ | ------------------------------------------ |
| `agent/invoke.async`     | Async agent invocation (durable execution) |
| `agent/schedule.trigger` | Schedule fires for an agent                |
| `agent/trigger.fire`     | Event-based trigger fires                  |

### Closed-Loop Learning Events

| Event                         | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `learning/signal.detected`    | Learning signal detected from run data               |
| `learning/session.start`      | Start a new learning session                         |
| `learning/session.scheduled`  | Scheduled learning trigger (cron)                    |
| `learning/signals.extract`    | Extract signals from a dataset                       |
| `learning/proposals.generate` | Generate improvement proposals                       |
| `learning/experiment.run`     | Run an A/B experiment                                |
| `learning/approval.request`   | Request human approval for a proposal                |
| `learning/version.promote`    | Promote an approved version                          |
| `learning/skill.develop`      | AAR: Develop a new skill from recommendation         |
| `learning/document.create`    | AAR: Create a knowledge document from recommendation |

### Feedback & Calibration Events

| Event                        | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `feedback/submitted`         | User feedback on a run (thumbs, rating, comment)        |
| `calibration/drift.detected` | Calibration drift detected between human and AI scoring |

### Simulation Events

| Event                      | Description                             |
| -------------------------- | --------------------------------------- |
| `simulation/session.start` | Start a simulation session              |
| `simulation/batch.run`     | Run a batch of simulation conversations |

### Campaign / Mission Events

| Event                         | Description                           |
| ----------------------------- | ------------------------------------- |
| `campaign/analyze`            | Analyze phase of a campaign           |
| `campaign/plan`               | Planning phase                        |
| `campaign/build-capabilities` | Build capabilities phase              |
| `campaign/execute`            | Execute the campaign                  |
| `campaign/aar`                | Campaign after-action review          |
| `mission/execute`             | Execute a single mission              |
| `mission/aar`                 | Mission after-action review           |
| `mission/complete`            | Mission completed                     |
| `mission/reviewed`            | Mission reviewed (complete or rework) |
| `mission/approved`            | Mission approved to proceed           |
| `campaign/sub-complete`       | Sub-campaign completed                |

### Workflow Events

| Event                    | Description              |
| ------------------------ | ------------------------ |
| `workflow/execute.async` | Async workflow execution |

### Metrics Events

| Event                   | Description                 |
| ----------------------- | --------------------------- |
| `metrics/daily.rollup`  | Daily metrics aggregation   |
| `pipeline/stats.rollup` | Dark Factory pipeline stats |

### Admin Portal Events

| Event                           | Description                 |
| ------------------------------- | --------------------------- |
| `admin/tenant.suspended`        | Tenant suspended by admin   |
| `admin/tenant.reactivated`      | Tenant reactivated by admin |
| `admin/tenant.delete-requested` | Tenant deletion requested   |
| `admin/health-check`            | Periodic health check       |
| `admin/quota.warning`           | Quota threshold warning     |

### Gmail Events

| Event                   | Description                             |
| ----------------------- | --------------------------------------- |
| `gmail/message.process` | Process new Gmail messages from webhook |

### BIM Events

| Event           | Description                    |
| --------------- | ------------------------------ |
| `bim/ifc.parse` | Parse an IFC file for BIM data |

---

## Retry Behavior Configuration

Each function configures its own retry policy:

```typescript
export const executeGoalFunction = inngest.createFunction(
    {
        id: "execute-goal",
        retries: 3,
        onFailure: async ({ error, event }) => {
            const goalId = event.data?.goalId;
            console.error(`[Inngest] Goal ${goalId} failed after retries:`, error.message);
            // Mark goal as failed in database
        }
    },
    { event: "goal/submitted" },
    async ({ event, step, runId }) => {
        // Function body with step functions
    }
);
```

### Common Retry Patterns

| Function                 | Retries | Notes                                          |
| ------------------------ | ------- | ---------------------------------------------- |
| `execute-goal`           | 3       | Has `onFailure` handler to mark goal as failed |
| `retry-goal`             | 2       | Manual retry with attempt tracking             |
| `run-completed`          | 2       | Post-run processing                            |
| `evaluation-completed`   | 2       | Evaluation result processing                   |
| `calibration-check`      | 2       | Feedback calibration                           |
| `learning-session-start` | 3       | Learning pipeline orchestration                |

---

## Idempotency Patterns

### Event-Based Idempotency

For agent invocations, use the `idempotencyKey` field:

```typescript
// Event schema
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
}
```

### Step-Based Idempotency

Inngest step functions are inherently idempotent — each step runs exactly once:

```typescript
async ({ event, step }) => {
    const data = await step.run("load-data", async () => {
        return await prisma.agent.findUnique({ where: { id: event.data.agentId } });
    });

    const result = await step.run("process-data", async () => {
        return await processAgent(data);
    });

    return result;
};
```

If a function is retried, previously completed steps are skipped and their cached results are reused.

---

## Function Examples

### Goal Execution Function

```typescript
export const executeGoalFunction = inngest.createFunction(
    {
        id: "execute-goal",
        retries: 3,
        onFailure: async ({ error, event }: { error: Error; event: any }) => {
            const goalId = event.data?.goalId;
            console.error(`[Inngest] Goal ${goalId} failed after retries:`, error.message);
            try {
                if (goalId) {
                    // Mark goal as failed in database
                }
            } catch {}
        }
    },
    { event: "goal/submitted" },
    async ({ event, step, runId }) => {
        const { goalId, userId } = event.data;
        console.log(`[Inngest] Executing goal: ${goalId}`);

        // Step 1: Load goal from database
        const goal = await step.run("load-goal", async () => {
            return await goalStore.getGoal(goalId);
        });

        // Step 2: Execute the goal
        const result = await step.run("execute", async () => {
            return await goalExecutor.execute(goal, { userId });
        });

        return result;
    }
);
```

### Run Completed Function

```typescript
export const runCompletedFunction = inngest.createFunction(
    {
        id: "run-completed",
        retries: 2
    },
    { event: "run/completed" },
    async ({ event, step }) => {
        const { runId, agentId, costUsd } = event.data;
        console.log(`[Inngest] Processing run completion: ${runId}`);

        // Step 1: Record activity
        await step.run("record-activity", async () => {
            await recordActivity({ ... });
        });

        // Step 2: Update metrics
        await step.run("update-metrics", async () => {
            await refreshNetworkMetrics();
            await refreshWorkflowMetrics();
        });

        // Step 3: Check if evaluation should run
        await step.run("trigger-evaluation", async () => {
            // Check agent's scorer configuration
            // Send run/evaluate event if applicable
        });
    }
);
```

### Scheduled Learning Trigger (Cron)

```typescript
export const scheduledLearningTriggerFunction = inngest.createFunction(
    {
        id: "scheduled-learning-trigger"
    },
    { cron: "0 3 * * *" }, // Every day at 3:00 AM UTC
    async ({ step }) => {
        // Find agents that need learning sessions
        // Send learning/session.start events
    }
);
```

### Budget Check Function

```typescript
export const budgetCheckFunction = inngest.createFunction(
    {
        id: "budget-check",
        retries: 2
    },
    { event: "budget/check" },
    async ({ event, step }) => {
        const { agentId } = event.data;

        const budget = await step.run("load-budget", async () => {
            // Load agent budget configuration
        });

        const usage = await step.run("calculate-usage", async () => {
            // Calculate current period usage
        });

        if (usage.percentUsed > budget.alertThreshold) {
            await step.run("send-alert", async () => {
                await inngest.send({
                    name: "budget/alert",
                    data: {
                        agentId,
                        currentUsage: usage.amount,
                        limit: budget.limit,
                        percentUsed: usage.percentUsed
                    }
                });
            });
        }
    }
);
```

---

## Local Development Server

### Starting the Dev Server

The Inngest dev server starts automatically with `bun run dev`. It runs via `apps/inngest/` which executes `scripts/start-inngest.sh`.

| Detail             | Value                             |
| ------------------ | --------------------------------- |
| **Dashboard URL**  | http://localhost:8288             |
| **Event endpoint** | http://localhost:3001/api/inngest |
| **Port**           | 8288                              |

> **Note:** The Inngest endpoint is at `http://localhost:3001/api/inngest` (not `/agent/api/inngest`) because basePath is only used when running behind Caddy.

### Dashboard Features

The dev dashboard at http://localhost:8288 provides:

- **Event stream**: View all events as they're published
- **Function runs**: Monitor function execution, steps, and retries
- **Error debugging**: Stack traces and error details for failed functions
- **Replay**: Re-run failed events for debugging

### Manual Dev Server Start

```bash
npx inngest-cli@latest dev -u http://localhost:3001/api/inngest --port 8288
```

---

## Production Configuration

### Inngest Cloud Setup

1. Log into [Inngest Cloud Dashboard](https://app.inngest.com)
2. Go to your app settings
3. Set the webhook URL to: `https://agentc2.ai/api/inngest`
4. Verify connection shows "Connected"

### Environment Variables

```bash
INNGEST_EVENT_KEY="..."       # Event publishing key
INNGEST_SIGNING_KEY="..."     # Webhook verification key
```

### Caddy Routing

The production Caddyfile routes `/api/inngest*` through the agent app:

```caddyfile
handle {
    reverse_proxy localhost:3001 {
        transport http {
            read_timeout 300s
            write_timeout 300s
        }
        flush_interval -1
    }
}
```

---

## Cron-Based Functions

Several functions run on schedules:

| Function                              | Schedule                         | Description                                |
| ------------------------------------- | -------------------------------- | ------------------------------------------ |
| `scheduledLearningTriggerFunction`    | `0 3 * * *`                      | Daily learning session backstop (3 AM UTC) |
| `dailyMetricsRollupFunction`          | On `metrics/daily.rollup` event  | Aggregate daily metrics                    |
| `dailyHealthScoreFunction`            | On `admin/health-check` event    | Calculate health scores                    |
| `experimentEvaluationCheckerFunction` | Periodic                         | Check experiment completion                |
| `webhookSubscriptionRenewalFunction`  | Periodic                         | Renew expiring webhook subscriptions       |
| `integrationHealthCheckFunction`      | Periodic                         | Check integration health                   |
| `integrationTokenRefreshFunction`     | Periodic                         | Refresh expiring OAuth tokens              |
| `remoteComputeCleanupFunction`        | Periodic                         | Clean up orphaned compute resources        |
| `pipelineStatsRollupFunction`         | On `pipeline/stats.rollup` event | Dark Factory stats aggregation             |

---

## Troubleshooting

### Functions Not Processing

1. Verify the Inngest dev server is running: http://localhost:8288
2. Check the function is registered in `inngestFunctions` array
3. Verify the event name matches between publisher and function trigger
4. Check PM2 logs for the agent app: `pm2 logs agent`

### Event Not Reaching Functions

1. Check the endpoint is accessible: `curl http://localhost:3001/api/inngest`
2. Verify `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are set
3. Check Inngest dashboard for event delivery status

### Learning Sessions Not Processing

The learning page (`/workspace/{agent}/learning`) requires Inngest to process learning sessions. Without the Inngest dev server running, clicking "Start Learning Session" will send events that never get processed.

### Debugging Failed Functions

1. Open the Inngest dashboard (http://localhost:8288 local, app.inngest.com production)
2. Navigate to the failed function run
3. Inspect step execution and error details
4. Use the "Replay" feature to re-run with the same event data
