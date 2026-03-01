#!/usr/bin/env bun
/**
 * Seed Sample Workflows + Networks
 *
 * Creates realistic workflow and network definitions for demos and E2E validation.
 * Run with: bun run scripts/seed-workflows-networks.ts
 */

import { config } from "dotenv";
import {
    prisma,
    AgentType,
    RunEnvironment,
    RunTriggerType,
    RunStatus
} from "../packages/database/src";
import { refreshNetworkMetrics, refreshWorkflowMetrics } from "../apps/agent/src/lib/metrics";

config({ path: ".env" });

const DEFAULT_MODEL_PROVIDER = "anthropic";
const DEFAULT_MODEL_NAME = "claude-sonnet-4-20250514";

const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};

const minutesAfter = (date: Date, minutes: number) => {
    return new Date(date.getTime() + minutes * 60 * 1000);
};

const SAMPLE_WORKFLOWS = [
    {
        slug: "sample-cost-estimate",
        name: "Cost Estimate Calculator",
        description:
            "Calculates a pricing estimate from a math expression and returns a formatted summary.",
        maxSteps: 5,
        definitionJson: {
            steps: [
                {
                    id: "calculate",
                    type: "tool",
                    name: "Calculate estimate",
                    inputMapping: {
                        expression: "{{input.expression}}"
                    },
                    config: {
                        toolId: "calculator"
                    }
                },
                {
                    id: "format-output",
                    type: "transform",
                    name: "Format response",
                    inputMapping: {
                        expression: "{{steps.calculate.expression}}",
                        result: "{{steps.calculate.result}}",
                        formatted: "{{steps.calculate.formatted}}"
                    }
                }
            ]
        }
    },
    {
        slug: "sample-support-triage",
        name: "Customer Support Triage",
        description:
            "Captures inbound support requests, triages with an agent, and assigns a ticket ID.",
        maxSteps: 8,
        definitionJson: {
            steps: [
                {
                    id: "capture-request",
                    type: "transform",
                    name: "Capture request",
                    inputMapping: {
                        customerName: "{{input.customerName}}",
                        issue: "{{input.issue}}",
                        priority: "{{input.priority}}",
                        channel: "{{input.channel}}"
                    }
                },
                {
                    id: "triage-request",
                    type: "agent",
                    name: "Triage request",
                    config: {
                        agentSlug: "assistant",
                        promptTemplate:
                            "You are a support triage agent. Analyze the request: {{steps.capture-request}}. Return JSON with keys: category, priority (P1-P3), summary, recommendedOwner.",
                        outputFormat: "json",
                        maxSteps: 3
                    }
                },
                {
                    id: "ticket-id",
                    type: "tool",
                    name: "Generate ticket ID",
                    inputMapping: {
                        prefix: "support"
                    },
                    config: {
                        toolId: "generate-id"
                    }
                },
                {
                    id: "assemble-response",
                    type: "transform",
                    name: "Assemble response",
                    inputMapping: {
                        ticketId: "{{steps.ticket-id.id}}",
                        triage: "{{steps.triage-request}}",
                        receivedAt: "{{steps.ticket-id.timestamp}}",
                        request: "{{steps.capture-request}}"
                    }
                }
            ]
        }
    }
];

async function ensureAssistantAgent() {
    const existing = await prisma.agent.findUnique({
        where: { slug: "assistant" }
    });

    if (existing) {
        return existing;
    }

    console.log("⚠️  Assistant agent not found. Creating minimal fallback agent.");
    return prisma.agent.create({
        data: {
            slug: "assistant",
            name: "AI Assistant",
            description: "Fallback assistant used by sample workflows and networks.",
            instructions: "You are a helpful assistant. Provide concise, accurate answers.",
            modelProvider: DEFAULT_MODEL_PROVIDER,
            modelName: DEFAULT_MODEL_NAME,
            temperature: 0.3,
            maxSteps: 5,
            type: AgentType.USER,
            memoryEnabled: false,
            memoryConfig: null,
            visibility: "PUBLIC",
            isActive: true
        }
    });
}

async function upsertWorkflow(workflow: (typeof SAMPLE_WORKFLOWS)[number], createdBy: string) {
    const existing = await prisma.workflow.findFirst({
        where: { slug: workflow.slug }
    });

    const record = existing
        ? await prisma.workflow.update({
              where: { id: existing.id },
              data: {
                  name: workflow.name,
                  description: workflow.description,
                  definitionJson: workflow.definitionJson,
                  maxSteps: workflow.maxSteps,
                  isActive: true
              }
          })
        : await prisma.workflow.create({
              data: {
                  slug: workflow.slug,
                  name: workflow.name,
                  description: workflow.description,
                  definitionJson: workflow.definitionJson,
                  maxSteps: workflow.maxSteps,
                  isPublished: false,
                  isActive: true,
                  type: "USER",
                  createdBy
              }
          });

    await prisma.workflowVersion.upsert({
        where: {
            workflowId_version: {
                workflowId: record.id,
                version: existing?.version ?? 1
            }
        },
        update: {
            definitionJson: workflow.definitionJson,
            description: "Seeded baseline version",
            createdBy
        },
        create: {
            workflowId: record.id,
            version: existing?.version ?? 1,
            definitionJson: workflow.definitionJson,
            description: "Seeded baseline version",
            createdBy
        }
    });

    return record;
}

async function upsertNetwork(options: {
    slug: string;
    name: string;
    description: string;
    instructions: string;
    primitives: Array<{
        primitiveType: "agent" | "workflow" | "tool";
        agentId?: string;
        workflowId?: string;
        toolId?: string;
        description?: string;
        position?: { x: number; y: number };
    }>;
    topologyJson: Record<string, unknown>;
    createdBy: string;
}) {
    const existing = await prisma.network.findUnique({
        where: { slug: options.slug }
    });

    const network = await prisma.network.upsert({
        where: { slug: options.slug },
        update: {
            name: options.name,
            description: options.description,
            instructions: options.instructions,
            modelProvider: DEFAULT_MODEL_PROVIDER,
            modelName: DEFAULT_MODEL_NAME,
            temperature: 0.3,
            maxSteps: 6,
            memoryConfig: {
                lastMessages: 6,
                semanticRecall: false,
                workingMemory: { enabled: false }
            },
            topologyJson: options.topologyJson,
            isActive: true
        },
        create: {
            slug: options.slug,
            name: options.name,
            description: options.description,
            instructions: options.instructions,
            modelProvider: DEFAULT_MODEL_PROVIDER,
            modelName: DEFAULT_MODEL_NAME,
            temperature: 0.3,
            maxSteps: 6,
            memoryConfig: {
                lastMessages: 6,
                semanticRecall: false,
                workingMemory: { enabled: false }
            },
            topologyJson: options.topologyJson,
            isPublished: false,
            isActive: true,
            type: "USER",
            createdBy: options.createdBy
        }
    });

    await prisma.networkPrimitive.deleteMany({
        where: { networkId: network.id }
    });

    if (options.primitives.length > 0) {
        await prisma.networkPrimitive.createMany({
            data: options.primitives.map((primitive) => ({
                networkId: network.id,
                primitiveType: primitive.primitiveType,
                agentId: primitive.agentId,
                workflowId: primitive.workflowId,
                toolId: primitive.toolId,
                description: primitive.description,
                position: primitive.position
            }))
        });
    }

    await prisma.networkVersion.upsert({
        where: {
            networkId_version: {
                networkId: network.id,
                version: existing?.version ?? 1
            }
        },
        update: {
            topologyJson: options.topologyJson,
            primitivesJson: options.primitives,
            description: "Seeded baseline version",
            createdBy: options.createdBy
        },
        create: {
            networkId: network.id,
            version: existing?.version ?? 1,
            topologyJson: options.topologyJson,
            primitivesJson: options.primitives,
            description: "Seeded baseline version",
            createdBy: options.createdBy
        }
    });

    return network;
}

async function createWorkflowRun(options: {
    workflowId: string;
    status: RunStatus;
    inputJson: Record<string, unknown>;
    outputJson?: Record<string, unknown> | null;
    source: string;
    environment: RunEnvironment;
    triggerType: RunTriggerType;
    startedAt: Date;
    completedAt?: Date | null;
    durationMs?: number | null;
    suspendedAt?: Date | null;
    suspendedStep?: string | null;
    suspendDataJson?: Record<string, unknown> | null;
    steps: Array<{
        stepId: string;
        stepType: string;
        stepName?: string | null;
        status: RunStatus;
        inputJson?: Record<string, unknown> | null;
        outputJson?: Record<string, unknown> | null;
        errorJson?: Record<string, unknown> | null;
        startedAt?: Date | null;
        completedAt?: Date | null;
        durationMs?: number | null;
    }>;
}) {
    const run = await prisma.workflowRun.create({
        data: {
            workflowId: options.workflowId,
            status: options.status,
            inputJson: options.inputJson,
            outputJson: options.outputJson ?? null,
            source: options.source,
            environment: options.environment,
            triggerType: options.triggerType,
            startedAt: options.startedAt,
            completedAt: options.completedAt ?? null,
            durationMs: options.durationMs ?? null,
            suspendedAt: options.suspendedAt ?? null,
            suspendedStep: options.suspendedStep ?? null,
            suspendDataJson: options.suspendDataJson ?? null,
            createdAt: options.startedAt
        }
    });

    if (options.steps.length > 0) {
        await prisma.workflowRunStep.createMany({
            data: options.steps.map((step, index) => ({
                runId: run.id,
                stepId: step.stepId,
                stepType: step.stepType,
                stepName: step.stepName ?? null,
                status: step.status,
                inputJson: step.inputJson ?? null,
                outputJson: step.outputJson ?? null,
                errorJson: step.errorJson ?? null,
                iterationIndex: index,
                startedAt: step.startedAt ?? null,
                completedAt: step.completedAt ?? null,
                durationMs: step.durationMs ?? null
            }))
        });
    }

    return run;
}

async function createNetworkRun(options: {
    networkId: string;
    status: RunStatus;
    inputText: string;
    outputText?: string | null;
    outputJson?: Record<string, unknown> | null;
    source: string;
    environment: RunEnvironment;
    triggerType: RunTriggerType;
    startedAt: Date;
    completedAt?: Date | null;
    durationMs?: number | null;
    stepsExecuted?: number | null;
    totalTokens?: number | null;
    totalCostUsd?: number | null;
    steps: Array<{
        stepNumber: number;
        stepType: string;
        primitiveType?: string | null;
        primitiveId?: string | null;
        routingDecision?: Record<string, unknown> | null;
        inputJson?: Record<string, unknown> | null;
        outputJson?: Record<string, unknown> | null;
        errorJson?: Record<string, unknown> | null;
        status: RunStatus;
        startedAt?: Date | null;
        completedAt?: Date | null;
        durationMs?: number | null;
        tokens?: number | null;
        costUsd?: number | null;
    }>;
}) {
    const run = await prisma.networkRun.create({
        data: {
            networkId: options.networkId,
            status: options.status,
            inputText: options.inputText,
            outputText: options.outputText ?? null,
            outputJson: options.outputJson ?? null,
            source: options.source,
            environment: options.environment,
            triggerType: options.triggerType,
            startedAt: options.startedAt,
            completedAt: options.completedAt ?? null,
            durationMs: options.durationMs ?? null,
            stepsExecuted: options.stepsExecuted ?? null,
            totalTokens: options.totalTokens ?? null,
            totalCostUsd: options.totalCostUsd ?? null,
            threadId: `seed-thread-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: options.startedAt
        }
    });

    if (options.steps.length > 0) {
        await prisma.networkRunStep.createMany({
            data: options.steps.map((step) => ({
                runId: run.id,
                stepNumber: step.stepNumber,
                stepType: step.stepType,
                primitiveType: step.primitiveType ?? null,
                primitiveId: step.primitiveId ?? null,
                routingDecision: step.routingDecision ?? null,
                inputJson: step.inputJson ?? null,
                outputJson: step.outputJson ?? null,
                errorJson: step.errorJson ?? null,
                status: step.status,
                startedAt: step.startedAt ?? null,
                completedAt: step.completedAt ?? null,
                durationMs: step.durationMs ?? null,
                tokens: step.tokens ?? null,
                costUsd: step.costUsd ?? null
            }))
        });
    }

    return run;
}

async function seedWorkflowRuns(workflows: Record<string, { id: string }>) {
    const costWorkflow = workflows["sample-cost-estimate"];
    const triageWorkflow = workflows["sample-support-triage"];

    if (costWorkflow) {
        await prisma.workflowRun.deleteMany({ where: { workflowId: costWorkflow.id } });

        const costRunDate = daysAgo(1);
        await createWorkflowRun({
            workflowId: costWorkflow.id,
            status: RunStatus.COMPLETED,
            inputJson: { expression: "420 / 2" },
            outputJson: { result: 210, formatted: "210", expression: "420 / 2" },
            source: "api",
            environment: RunEnvironment.PRODUCTION,
            triggerType: RunTriggerType.API,
            startedAt: costRunDate,
            completedAt: minutesAfter(costRunDate, 1),
            durationMs: 1200,
            steps: [
                {
                    stepId: "calculate",
                    stepType: "tool",
                    stepName: "Calculate estimate",
                    status: RunStatus.COMPLETED,
                    inputJson: { expression: "420 / 2" },
                    outputJson: { result: 210, formatted: "210", expression: "420 / 2" },
                    startedAt: costRunDate,
                    completedAt: minutesAfter(costRunDate, 1),
                    durationMs: 800
                },
                {
                    stepId: "format-output",
                    stepType: "transform",
                    stepName: "Format response",
                    status: RunStatus.COMPLETED,
                    inputJson: { result: 210 },
                    outputJson: { formatted: "210" },
                    startedAt: minutesAfter(costRunDate, 1),
                    completedAt: minutesAfter(costRunDate, 1.3),
                    durationMs: 400
                }
            ]
        });

        const costFailDate = daysAgo(2);
        await createWorkflowRun({
            workflowId: costWorkflow.id,
            status: RunStatus.FAILED,
            inputJson: { expression: "420 / 0" },
            outputJson: null,
            source: "webhook",
            environment: RunEnvironment.STAGING,
            triggerType: RunTriggerType.WEBHOOK,
            startedAt: costFailDate,
            completedAt: minutesAfter(costFailDate, 0.4),
            durationMs: 400,
            steps: [
                {
                    stepId: "calculate",
                    stepType: "tool",
                    stepName: "Calculate estimate",
                    status: RunStatus.FAILED,
                    inputJson: { expression: "420 / 0" },
                    errorJson: { message: "Division by zero" },
                    startedAt: costFailDate,
                    completedAt: minutesAfter(costFailDate, 0.4),
                    durationMs: 400
                }
            ]
        });

        const costRunningDate = daysAgo(0);
        await createWorkflowRun({
            workflowId: costWorkflow.id,
            status: RunStatus.RUNNING,
            inputJson: { expression: "19 * 42" },
            outputJson: null,
            source: "api",
            environment: RunEnvironment.DEVELOPMENT,
            triggerType: RunTriggerType.RETRY,
            startedAt: costRunningDate,
            durationMs: 0,
            steps: [
                {
                    stepId: "calculate",
                    stepType: "tool",
                    stepName: "Calculate estimate",
                    status: RunStatus.RUNNING,
                    inputJson: { expression: "19 * 42" },
                    startedAt: costRunningDate
                }
            ]
        });
    }

    if (triageWorkflow) {
        await prisma.workflowRun.deleteMany({ where: { workflowId: triageWorkflow.id } });

        const triageDate = daysAgo(1);
        await createWorkflowRun({
            workflowId: triageWorkflow.id,
            status: RunStatus.COMPLETED,
            inputJson: {
                customerName: "Jamie",
                issue: "Unable to reset password",
                priority: "medium",
                channel: "email"
            },
            outputJson: {
                ticketId: "support-1024",
                triage: { category: "auth", priority: "P2" }
            },
            source: "api",
            environment: RunEnvironment.PRODUCTION,
            triggerType: RunTriggerType.API,
            startedAt: triageDate,
            completedAt: minutesAfter(triageDate, 2),
            durationMs: 2000,
            steps: [
                {
                    stepId: "capture-request",
                    stepType: "transform",
                    stepName: "Capture request",
                    status: RunStatus.COMPLETED,
                    inputJson: { issue: "Unable to reset password" },
                    outputJson: { issue: "Unable to reset password" },
                    startedAt: triageDate,
                    completedAt: minutesAfter(triageDate, 0.5),
                    durationMs: 500
                },
                {
                    stepId: "triage-request",
                    stepType: "agent",
                    stepName: "Triage request",
                    status: RunStatus.COMPLETED,
                    outputJson: { category: "auth", priority: "P2" },
                    startedAt: minutesAfter(triageDate, 0.5),
                    completedAt: minutesAfter(triageDate, 1.2),
                    durationMs: 700
                },
                {
                    stepId: "ticket-id",
                    stepType: "tool",
                    stepName: "Generate ticket ID",
                    status: RunStatus.COMPLETED,
                    outputJson: { id: "support-1024" },
                    startedAt: minutesAfter(triageDate, 1.2),
                    completedAt: minutesAfter(triageDate, 1.5),
                    durationMs: 300
                },
                {
                    stepId: "assemble-response",
                    stepType: "transform",
                    stepName: "Assemble response",
                    status: RunStatus.COMPLETED,
                    outputJson: { ticketId: "support-1024" },
                    startedAt: minutesAfter(triageDate, 1.5),
                    completedAt: minutesAfter(triageDate, 2),
                    durationMs: 500
                }
            ]
        });

        const triageSuspendedDate = daysAgo(0);
        await createWorkflowRun({
            workflowId: triageWorkflow.id,
            status: RunStatus.RUNNING,
            inputJson: {
                customerName: "Alex",
                issue: "Urgent billing error",
                priority: "high",
                channel: "chat"
            },
            outputJson: null,
            source: "webhook",
            environment: RunEnvironment.STAGING,
            triggerType: RunTriggerType.WEBHOOK,
            startedAt: triageSuspendedDate,
            durationMs: 0,
            suspendedAt: minutesAfter(triageSuspendedDate, 1),
            suspendedStep: "triage-request",
            suspendDataJson: { approvalRequired: true, reason: "Escalation needed" },
            steps: [
                {
                    stepId: "capture-request",
                    stepType: "transform",
                    stepName: "Capture request",
                    status: RunStatus.COMPLETED,
                    outputJson: { issue: "Urgent billing error" },
                    startedAt: triageSuspendedDate,
                    completedAt: minutesAfter(triageSuspendedDate, 0.5),
                    durationMs: 500
                },
                {
                    stepId: "triage-request",
                    stepType: "agent",
                    stepName: "Triage request",
                    status: RunStatus.RUNNING,
                    startedAt: minutesAfter(triageSuspendedDate, 0.5)
                }
            ]
        });

        const triageFailedDate = daysAgo(3);
        await createWorkflowRun({
            workflowId: triageWorkflow.id,
            status: RunStatus.FAILED,
            inputJson: {
                customerName: "Morgan",
                issue: "System outage report",
                priority: "high",
                channel: "email"
            },
            outputJson: null,
            source: "api",
            environment: RunEnvironment.DEVELOPMENT,
            triggerType: RunTriggerType.TEST,
            startedAt: triageFailedDate,
            completedAt: minutesAfter(triageFailedDate, 0.8),
            durationMs: 800,
            steps: [
                {
                    stepId: "capture-request",
                    stepType: "transform",
                    stepName: "Capture request",
                    status: RunStatus.COMPLETED,
                    outputJson: { issue: "System outage report" },
                    startedAt: triageFailedDate,
                    completedAt: minutesAfter(triageFailedDate, 0.4),
                    durationMs: 400
                },
                {
                    stepId: "triage-request",
                    stepType: "agent",
                    stepName: "Triage request",
                    status: RunStatus.FAILED,
                    errorJson: { message: "LLM timeout" },
                    startedAt: minutesAfter(triageFailedDate, 0.4),
                    completedAt: minutesAfter(triageFailedDate, 0.8),
                    durationMs: 400
                }
            ]
        });
    }
}

async function seedNetworkRuns(networkId: string) {
    await prisma.networkRun.deleteMany({ where: { networkId } });

    const networkCompletedDate = daysAgo(1);
    await createNetworkRun({
        networkId,
        status: RunStatus.COMPLETED,
        inputText: "Can you calculate 1250 / 5?",
        outputText: "The result is 250.",
        outputJson: { result: 250 },
        source: "api",
        environment: RunEnvironment.PRODUCTION,
        triggerType: RunTriggerType.API,
        startedAt: networkCompletedDate,
        completedAt: minutesAfter(networkCompletedDate, 1),
        durationMs: 1000,
        stepsExecuted: 3,
        totalTokens: 540,
        totalCostUsd: 0.012,
        steps: [
            {
                stepNumber: 1,
                stepType: "routing",
                primitiveType: "workflow",
                primitiveId: "sample-cost-estimate",
                routingDecision: { target: "sample-cost-estimate" },
                status: RunStatus.COMPLETED,
                startedAt: networkCompletedDate,
                completedAt: minutesAfter(networkCompletedDate, 0.2),
                durationMs: 200
            },
            {
                stepNumber: 2,
                stepType: "workflow",
                primitiveType: "workflow",
                primitiveId: "sample-cost-estimate",
                inputJson: { expression: "1250 / 5" },
                outputJson: { result: 250 },
                status: RunStatus.COMPLETED,
                startedAt: minutesAfter(networkCompletedDate, 0.2),
                completedAt: minutesAfter(networkCompletedDate, 0.8),
                durationMs: 600
            },
            {
                stepNumber: 3,
                stepType: "agent",
                primitiveType: "agent",
                primitiveId: "assistant",
                outputJson: { text: "The result is 250." },
                status: RunStatus.COMPLETED,
                startedAt: minutesAfter(networkCompletedDate, 0.8),
                completedAt: minutesAfter(networkCompletedDate, 1),
                durationMs: 200
            }
        ]
    });

    const networkFailedDate = daysAgo(2);
    await createNetworkRun({
        networkId,
        status: RunStatus.FAILED,
        inputText: "Handle a billing escalation for enterprise customer.",
        outputText: null,
        outputJson: null,
        source: "webhook",
        environment: RunEnvironment.STAGING,
        triggerType: RunTriggerType.WEBHOOK,
        startedAt: networkFailedDate,
        completedAt: minutesAfter(networkFailedDate, 0.7),
        durationMs: 700,
        stepsExecuted: 1,
        totalTokens: 220,
        totalCostUsd: 0.004,
        steps: [
            {
                stepNumber: 1,
                stepType: "routing",
                primitiveType: "workflow",
                primitiveId: "sample-support-triage",
                routingDecision: { target: "sample-support-triage" },
                status: RunStatus.FAILED,
                errorJson: { message: "Routing failed due to invalid config" },
                startedAt: networkFailedDate,
                completedAt: minutesAfter(networkFailedDate, 0.7),
                durationMs: 700
            }
        ]
    });

    const networkRunningDate = daysAgo(0);
    await createNetworkRun({
        networkId,
        status: RunStatus.RUNNING,
        inputText: "Need help with a password reset",
        outputText: null,
        outputJson: null,
        source: "api",
        environment: RunEnvironment.DEVELOPMENT,
        triggerType: RunTriggerType.RETRY,
        startedAt: networkRunningDate,
        durationMs: 0,
        stepsExecuted: 1,
        steps: [
            {
                stepNumber: 1,
                stepType: "routing",
                primitiveType: "workflow",
                primitiveId: "sample-support-triage",
                routingDecision: { target: "sample-support-triage" },
                status: RunStatus.RUNNING,
                startedAt: networkRunningDate,
                durationMs: 0
            }
        ]
    });
}

async function main() {
    const createdBy = "seed-workflows-networks";
    console.log("🌱 Seeding sample workflows and networks...");

    const assistant = await ensureAssistantAgent();

    const workflowRecords = await Promise.all(
        SAMPLE_WORKFLOWS.map((workflow) => upsertWorkflow(workflow, createdBy))
    );

    const workflowBySlug = Object.fromEntries(
        workflowRecords.map((workflow) => [workflow.slug, workflow])
    );

    const topologyJson = {
        nodes: [
            {
                id: "router",
                type: "workflow",
                position: { x: 0, y: 0 },
                data: {
                    label: "Operations Router",
                    description: "Routes requests to the right primitive",
                    status: "pending"
                }
            },
            {
                id: "agent-assistant",
                type: "workflow",
                position: { x: -240, y: 160 },
                data: {
                    label: "Assistant",
                    description: "General responses",
                    status: "pending"
                }
            },
            {
                id: "workflow-support-triage",
                type: "workflow",
                position: { x: 0, y: 160 },
                data: {
                    label: "Support Triage",
                    description: "Classify support issues",
                    status: "pending"
                }
            },
            {
                id: "workflow-cost-estimate",
                type: "workflow",
                position: { x: 240, y: 160 },
                data: {
                    label: "Cost Estimate",
                    description: "Pricing calculator",
                    status: "pending"
                }
            },
            {
                id: "tool-calculator",
                type: "workflow",
                position: { x: 240, y: 320 },
                data: {
                    label: "Calculator",
                    description: "Quick math tool",
                    status: "pending"
                }
            }
        ],
        edges: [
            {
                id: "router-assistant",
                source: "router",
                target: "agent-assistant",
                type: "temporary"
            },
            {
                id: "router-support",
                source: "router",
                target: "workflow-support-triage",
                type: "temporary"
            },
            {
                id: "router-cost",
                source: "router",
                target: "workflow-cost-estimate",
                type: "temporary"
            },
            {
                id: "cost-tool",
                source: "workflow-cost-estimate",
                target: "tool-calculator",
                type: "temporary"
            }
        ]
    };

    const network = await upsertNetwork({
        slug: "sample-ops-router",
        name: "Operations Support Router",
        description:
            "Routes inbound requests to support triage, cost estimation, or the assistant.",
        instructions:
            "You are an operations routing agent. Use the Support Triage workflow for support tickets, " +
            "use the Cost Estimate workflow or Calculator tool for pricing/math, and reply directly with " +
            "the Assistant for general questions. Always choose the most relevant primitive.",
        topologyJson,
        createdBy,
        primitives: [
            {
                primitiveType: "agent",
                agentId: assistant.id,
                description: "General-purpose assistant for miscellaneous requests.",
                position: { x: -240, y: 160 }
            },
            {
                primitiveType: "workflow",
                workflowId: workflowBySlug["sample-support-triage"]?.id,
                description: "Classifies support tickets and suggests owners.",
                position: { x: 0, y: 160 }
            },
            {
                primitiveType: "workflow",
                workflowId: workflowBySlug["sample-cost-estimate"]?.id,
                description: "Calculates cost estimates from expressions.",
                position: { x: 240, y: 160 }
            },
            {
                primitiveType: "tool",
                toolId: "calculator",
                description: "Quick math for small calculations.",
                position: { x: 240, y: 320 }
            }
        ].filter(
            (primitive) =>
                primitive.primitiveType === "tool" || primitive.agentId || primitive.workflowId
        )
    });

    await seedWorkflowRuns(workflowBySlug);
    await seedNetworkRuns(network.id);

    const metricDates = Array.from({ length: 7 }, (_, index) => daysAgo(index));
    for (const workflow of Object.values(workflowBySlug)) {
        for (const date of metricDates) {
            await refreshWorkflowMetrics(workflow.id, date);
        }
    }
    for (const date of metricDates) {
        await refreshNetworkMetrics(network.id, date);
    }

    console.log("✅ Seed complete:");
    console.log(`   Workflows: ${SAMPLE_WORKFLOWS.map((workflow) => workflow.slug).join(", ")}`);
    console.log("   Network: sample-ops-router");
}

main()
    .catch((error) => {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
