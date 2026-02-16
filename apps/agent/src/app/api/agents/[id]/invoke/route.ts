import { NextRequest, NextResponse } from "next/server";
import { prisma, TriggerEventStatus } from "@repo/database";
import { agentResolver } from "@repo/mastra/agents";
import { startRun, extractTokenUsage, extractToolCalls, type RunSource } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { inngest } from "@/lib/inngest";
import { auditLog } from "@/lib/audit-log";
import { resolveRunSource, resolveRunTriggerType } from "@/lib/unified-triggers";
import { createTriggerEventRecord } from "@/lib/trigger-events";

function formatToolResultPreview(result: unknown, maxLength = 500): string {
    if (typeof result === "string") {
        return result.slice(0, maxLength);
    }

    try {
        const json = JSON.stringify(result, null, 2);
        if (json === undefined) {
            return String(result).slice(0, maxLength);
        }
        return json.slice(0, maxLength);
    } catch {
        return String(result).slice(0, maxLength);
    }
}

/**
 * POST /api/agents/[id]/invoke
 *
 * Unified agent invocation endpoint.
 * Supports both sync and async execution modes.
 *
 * Request body:
 * {
 *   "input": "User's question or task",
 *   "context": { ... },       // Optional context variables
 *   "mode": "sync" | "async", // Default: "sync"
 *   "idempotencyKey": "...",  // Optional for async deduplication
 *   "maxSteps": 5,            // Optional override
 *   "timeout": 30000          // Optional timeout in ms (default: 30000)
 * }
 *
 * Response (sync):
 * {
 *   "success": true,
 *   "run_id": "run_123",
 *   "status": "success" | "failed",
 *   "output": "Agent response",
 *   "usage": { promptTokens, completionTokens, totalTokens },
 *   "cost_usd": 0.05,
 *   "duration_ms": 1234
 * }
 *
 * Response (async):
 * {
 *   "success": true,
 *   "run_id": "run_123",
 *   "status": "queued",
 *   "poll_url": "/api/agents/{id}/runs/{run_id}"
 * }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const {
            input,
            context,
            mode = "sync",
            idempotencyKey,
            maxSteps: maxStepsOverride,
            timeout = 30000,
            triggerId
        } = body;

        // Validate input
        if (!input || typeof input !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required field: input (string)"
                },
                { status: 400 }
            );
        }

        // Validate mode
        if (mode !== "sync" && mode !== "async") {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid mode. Must be "sync" or "async"'
                },
                { status: 400 }
            );
        }

        // Resolve agent from database
        let agent, record, source;
        try {
            ({ agent, record, source } = await agentResolver.resolve({
                slug: id,
                requestContext: context,
                threadId: context?.threadId || context?.thread?.id
            }));
        } catch (resolveError) {
            const msg = resolveError instanceof Error ? resolveError.message : String(resolveError);
            if (msg.includes("not found")) {
                return NextResponse.json(
                    { success: false, error: `Agent '${id}' not found` },
                    { status: 404 }
                );
            }
            throw resolveError;
        }

        if (!record) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Check if agent is active
        if (!record.isActive) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' is not active` },
                { status: 403 }
            );
        }

        // Check policies
        if (record.requiresApproval) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Agent requires approval for invocation"
                },
                { status: 403 }
            );
        }

        let triggerRecord: {
            id: string;
            triggerType: string;
            isActive: boolean;
            webhookPath: string | null;
        } | null = null;
        if (triggerId && typeof triggerId === "string") {
            triggerRecord = await prisma.agentTrigger.findFirst({
                where: { id: triggerId, agentId: record.id },
                select: { id: true, triggerType: true, isActive: true, webhookPath: true }
            });
            if (!triggerRecord) {
                return NextResponse.json(
                    { success: false, error: `Trigger '${triggerId}' not found` },
                    { status: 404 }
                );
            }
            if (!triggerRecord.isActive) {
                return NextResponse.json(
                    { success: false, error: "Trigger is disabled" },
                    { status: 403 }
                );
            }
        }

        const runSource: RunSource = triggerRecord
            ? (resolveRunSource(triggerRecord.triggerType) as RunSource)
            : "api";
        const effectiveMaxSteps = maxStepsOverride ?? record.maxSteps ?? 5;

        // Handle async mode - queue the job and return immediately
        if (mode === "async") {
            // Create a pending run record
            const run = await prisma.agentRun.create({
                data: {
                    agentId: record.id,
                    runType: "PROD",
                    status: "QUEUED",
                    inputText: input,
                    source: runSource,
                    startedAt: new Date(),
                    triggerType: triggerRecord
                        ? resolveRunTriggerType(triggerRecord.triggerType)
                        : undefined,
                    triggerId: triggerRecord?.id
                }
            });

            // Create trace record
            await prisma.agentTrace.create({
                data: {
                    runId: run.id,
                    agentId: record.id,
                    status: "QUEUED",
                    inputText: input
                }
            });

            // Record trigger event for unified triggers dashboard (async mode)
            try {
                await createTriggerEventRecord({
                    agentId: record.id,
                    workspaceId: record.workspaceId,
                    runId: run.id,
                    sourceType: triggerRecord ? triggerRecord.triggerType : "api",
                    triggerType: triggerRecord?.triggerType || null,
                    triggerId: triggerRecord?.id || null,
                    entityType: "agent",
                    payload: { input },
                    metadata: { mode: "async", source: runSource }
                });
            } catch (e) {
                console.warn("[Agent Invoke] Failed to record trigger event:", e);
            }

            // Queue the job via Inngest
            await inngest.send({
                name: "agent/invoke.async",
                data: {
                    runId: run.id,
                    agentId: record.id,
                    agentSlug: record.slug,
                    input,
                    context,
                    maxSteps: effectiveMaxSteps,
                    idempotencyKey
                }
            });

            return NextResponse.json({
                success: true,
                run_id: run.id,
                status: "queued",
                poll_url: `/api/agents/${id}/runs/${run.id}`
            });
        }

        // Sync mode - execute immediately with full observability
        const runHandle = await startRun({
            agentId: record.id,
            agentSlug: record.slug,
            input,
            source: runSource,
            triggerType: triggerRecord
                ? resolveRunTriggerType(triggerRecord.triggerType)
                : undefined,
            triggerId: triggerRecord?.id,
            userId: context?.userId,
            threadId: context?.threadId,
            sessionId: context?.sessionId,
            tenantId: record.tenantId || undefined
        });

        // Audit log the invocation
        auditLog.agentInvoke(
            runHandle.runId,
            record.id,
            runSource,
            context?.userId,
            record.tenantId || undefined
        );

        try {
            // Execute agent with timeout
            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Extract threadId and resourceId for memory persistence
            const threadId = context?.threadId || context?.thread?.id;
            const resourceId = context?.userId || context?.resource?.userId || "default";

            const generateOptions = {
                maxSteps: effectiveMaxSteps,
                ...(record.maxTokens ? { maxTokens: record.maxTokens } : {}),
                // Add memory configuration if threadId is provided and agent has memory enabled
                ...(threadId && record.memoryEnabled
                    ? {
                          memory: {
                              thread: threadId,
                              resource: resourceId
                          }
                      }
                    : {})
            } as unknown as Parameters<typeof agent.generate>[1];

            const response = await agent.generate(input, generateOptions);

            clearTimeout(timeoutId);
            const durationMs = Date.now() - startTime;

            // Extract usage
            const usage = extractTokenUsage(response);
            const costUsd = usage
                ? calculateCost(
                      record.modelName,
                      record.modelProvider,
                      usage.promptTokens,
                      usage.completionTokens
                  )
                : undefined;

            // Extract tool calls from response
            const toolCalls = extractToolCalls(response);

            // Build execution steps and record tool calls
            interface ExecutionStep {
                step: number;
                type: "thinking" | "tool_call" | "tool_result" | "response";
                content: string;
                timestamp: string;
            }
            const executionSteps: ExecutionStep[] = [];
            let stepCounter = 0;

            // Process tool calls
            for (const tc of toolCalls) {
                const toolName = tc.toolKey || "unknown";
                const args = tc.input || {};

                stepCounter++;
                executionSteps.push({
                    step: stepCounter,
                    type: "tool_call",
                    content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                    timestamp: new Date().toISOString()
                });

                if (tc.output !== undefined || tc.error) {
                    stepCounter++;
                    const resultPreview = formatToolResultPreview(tc.output, 500);
                    executionSteps.push({
                        step: stepCounter,
                        type: "tool_result",
                        content: tc.error
                            ? `Tool ${toolName} failed: ${tc.error}`
                            : `Tool ${toolName} result:\n${resultPreview}`,
                        timestamp: new Date().toISOString()
                    });
                }

                // Record tool call
                await runHandle.addToolCall({
                    toolKey: toolName,
                    input: args,
                    output: tc.output,
                    success: tc.success,
                    error: tc.error,
                    durationMs: tc.durationMs
                });
            }

            // Add final response step
            stepCounter++;
            executionSteps.push({
                step: stepCounter,
                type: "response",
                content:
                    response.text?.slice(0, 2000) +
                    (response.text && response.text.length > 2000 ? "..." : ""),
                timestamp: new Date().toISOString()
            });

            // Complete the run with full metrics and steps
            await runHandle.complete({
                output: response.text,
                modelProvider: record.modelProvider,
                modelName: record.modelName,
                promptTokens: usage?.promptTokens,
                completionTokens: usage?.completionTokens,
                costUsd,
                steps: executionSteps
            });

            // Record trigger event and update trigger stats
            if (triggerRecord) {
                await Promise.all([
                    prisma.agentTrigger.update({
                        where: { id: triggerRecord.id },
                        data: {
                            lastTriggeredAt: new Date(),
                            triggerCount: { increment: 1 }
                        }
                    }),
                    createTriggerEventRecord({
                        triggerId: triggerRecord.id,
                        agentId: record.id,
                        workspaceId: record.workspaceId,
                        runId: runHandle.runId,
                        status: TriggerEventStatus.RECEIVED,
                        sourceType: triggerRecord.triggerType,
                        triggerType: triggerRecord.triggerType,
                        entityType: "agent",
                        webhookPath: triggerRecord.webhookPath || undefined,
                        payload: { input },
                        metadata: { mode: "sync", source: "invoke" }
                    })
                ]);
            } else {
                // Record trigger event for non-trigger API invocations
                try {
                    await createTriggerEventRecord({
                        agentId: record.id,
                        workspaceId: record.workspaceId,
                        runId: runHandle.runId,
                        sourceType: "api",
                        entityType: "agent",
                        payload: { input },
                        metadata: { mode: "sync", source: runSource }
                    });
                } catch (e) {
                    console.warn("[Agent Invoke] Failed to record trigger event:", e);
                }
            }

            return NextResponse.json({
                success: true,
                run_id: runHandle.runId,
                status: "success",
                output: response.text,
                usage: usage
                    ? {
                          prompt_tokens: usage.promptTokens,
                          completion_tokens: usage.completionTokens,
                          total_tokens: usage.totalTokens
                      }
                    : null,
                cost_usd: costUsd,
                duration_ms: durationMs,
                model: `${record.modelProvider}/${record.modelName}`,
                source
            });
        } catch (error) {
            // Mark run as failed
            await runHandle.fail(error instanceof Error ? error : String(error));

            return NextResponse.json(
                {
                    success: false,
                    run_id: runHandle.runId,
                    status: "failed",
                    error: error instanceof Error ? error.message : "Agent execution failed"
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("[Agent Invoke] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to invoke agent"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/agents/[id]/invoke
 *
 * Returns invoke endpoint documentation
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Find agent to include in docs
    const agent = await prisma.agent.findFirst({
        where: {
            OR: [{ slug: id }, { id: id }]
        },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            modelProvider: true,
            modelName: true,
            isActive: true,
            requiresApproval: true,
            maxSpendUsd: true,
            maxSteps: true
        }
    });

    if (!agent) {
        return NextResponse.json(
            { success: false, error: `Agent '${id}' not found` },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        agent: {
            id: agent.id,
            slug: agent.slug,
            name: agent.name,
            description: agent.description,
            model: `${agent.modelProvider}/${agent.modelName}`,
            is_active: agent.isActive,
            requires_approval: agent.requiresApproval,
            max_spend_usd: agent.maxSpendUsd,
            max_steps: agent.maxSteps
        },
        endpoint: {
            method: "POST",
            path: `/api/agents/${agent.slug}/invoke`,
            description: "Invoke the agent with an input and receive a response",
            request_body: {
                input: {
                    type: "string",
                    required: true,
                    description: "The user's question or task"
                },
                context: {
                    type: "object",
                    required: false,
                    description: "Optional context variables"
                },
                mode: {
                    type: "string",
                    required: false,
                    enum: ["sync", "async"],
                    default: "sync",
                    description: "Execution mode"
                },
                idempotencyKey: {
                    type: "string",
                    required: false,
                    description: "For async deduplication"
                },
                maxSteps: {
                    type: "number",
                    required: false,
                    default: agent.maxSteps || 5,
                    description: "Maximum tool-use steps"
                },
                triggerId: {
                    type: "string",
                    required: false,
                    description:
                        "Optional trigger ID to link this invocation to a configured trigger"
                },
                timeout: {
                    type: "number",
                    required: false,
                    default: 30000,
                    description: "Timeout in milliseconds (sync mode only)"
                }
            },
            response: {
                sync: {
                    success: true,
                    run_id: "string",
                    status: "success | failed",
                    output: "string",
                    usage: {
                        prompt_tokens: "number",
                        completion_tokens: "number",
                        total_tokens: "number"
                    },
                    cost_usd: "number",
                    duration_ms: "number"
                },
                async: {
                    success: true,
                    run_id: "string",
                    status: "queued",
                    poll_url: "string"
                }
            }
        }
    });
}
