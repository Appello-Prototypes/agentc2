import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { agentResolver } from "@repo/mastra";
import { startRun, extractTokenUsage, type RunSource } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { inngest } from "@/lib/inngest";
import { auditLog } from "@/lib/audit-log";

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
            timeout = 30000
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
        const { agent, record, source } = await agentResolver.resolve({
            slug: id,
            requestContext: context
        });

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

        const runSource: RunSource = "api";
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
                    startedAt: new Date()
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

            const response = await agent.generate(input, {
                maxSteps: effectiveMaxSteps
            });

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawToolCalls: any[] =
                (response as any).toolCalls || (response as any).tool_calls || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawToolResults: any[] =
                (response as any).toolResults || (response as any).tool_results || [];

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
            for (const [idx, tc] of rawToolCalls.entries()) {
                const toolName = tc.toolName || tc.name || "unknown";
                const args = tc.args || tc.input || {};

                stepCounter++;
                executionSteps.push({
                    step: stepCounter,
                    type: "tool_call",
                    content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                    timestamp: new Date().toISOString()
                });

                // Get matching result
                const tr = rawToolResults[idx];
                if (tr) {
                    stepCounter++;
                    const resultPreview =
                        typeof tr.result === "string"
                            ? tr.result.slice(0, 500)
                            : JSON.stringify(tr.result, null, 2).slice(0, 500);
                    executionSteps.push({
                        step: stepCounter,
                        type: "tool_result",
                        content: tr.error
                            ? `Tool ${toolName} failed: ${tr.error}`
                            : `Tool ${toolName} result:\n${resultPreview}`,
                        timestamp: new Date().toISOString()
                    });

                    // Record tool call
                    await runHandle.addToolCall({
                        toolKey: toolName,
                        input: args,
                        output: tr.result,
                        success: !tr.error,
                        error: tr.error
                    });
                }
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
