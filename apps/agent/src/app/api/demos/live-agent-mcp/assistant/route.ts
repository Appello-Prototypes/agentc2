import { NextRequest, NextResponse } from "next/server";
import {
    agentResolver,
    relevancyScorer,
    evaluateHelpfulness,
    listMcpToolDefinitions
} from "@repo/mastra";
import {
    startRun,
    extractTokenUsage,
    type ExecutionStep,
    type ToolCallData
} from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

/** Default agent slug for ElevenLabs requests */
const DEFAULT_AGENT_SLUG = process.env.ELEVENLABS_DEFAULT_AGENT_SLUG || "mcp-agent";

/**
 * Validate webhook secret for ElevenLabs requests
 */
function validateWebhookSecret(request: NextRequest): boolean {
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn("[Assistant] ELEVENLABS_WEBHOOK_SECRET not configured - allowing request");
        return true;
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
        return false;
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    return token === webhookSecret;
}

/**
 * POST /api/demos/live-agent-mcp/assistant
 *
 * Receives a question from ElevenLabs and passes it to a database-configured agent.
 * Records all runs in AgentRun for unified observability.
 *
 * Query Parameters:
 * - agent: Agent slug to use (default: env ELEVENLABS_DEFAULT_AGENT_SLUG or "mcp-agent")
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    let stepCounter = 0;

    const addStep = (type: ExecutionStep["type"], content: string, toolCall?: ToolCallData) => {
        steps.push({
            step: ++stepCounter,
            type,
            content,
            timestamp: new Date().toISOString(),
            toolCall
        });
    };

    // Validate webhook authentication
    if (!validateWebhookSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get agent slug from query parameter
    const { searchParams } = new URL(request.url);
    const agentSlug = searchParams.get("agent") || DEFAULT_AGENT_SLUG;

    // Get conversation ID from ElevenLabs if available
    const conversationId =
        request.headers.get("x-elevenlabs-conversation-id") ||
        `elevenlabs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
        const body = await request.json();
        const { question } = body;

        console.log(`\n${"═".repeat(70)}`);
        console.log(`[Trace] ▶ Voice Agent Request`);
        console.log(`[Trace] Agent: ${agentSlug}`);
        console.log(`[Trace] Input: "${question}"`);

        if (!question) {
            return NextResponse.json(
                { error: "Missing required field: question" },
                { status: 400 }
            );
        }

        addStep("thinking", `Received question: "${question}"`);

        // Get available tools (for observability)
        const toolDefs = await listMcpToolDefinitions();
        const availableTools = toolDefs.map((t) => t.name);
        addStep("thinking", `Loaded ${availableTools.length} available tools`);

        // Resolve agent from database
        const { agent, record, source } = await agentResolver.resolve({ slug: agentSlug });
        const agentId = record?.id || agentSlug;
        const maxSteps = record?.maxSteps || 5;
        addStep("thinking", `Resolved agent "${agentSlug}" from ${source} (maxSteps: ${maxSteps})`);

        // Start recording the run
        const run = await startRun({
            agentId,
            agentSlug,
            input: question,
            source: "elevenlabs",
            sessionId: conversationId,
            threadId: conversationId,
            metadata: {
                elevenlabsAgentId: process.env.ELEVENLABS_AGENT_ID,
                availableTools
            }
        });

        // Build prompt - agent's instructions are already set, just pass the question
        const prompt = `The user asked: "${question}"

Please help the user with their request. Keep responses concise (2-4 sentences) since they may be spoken aloud.`;

        addStep("thinking", "Sending prompt to LLM for processing");

        // Execute via agent with database-configured maxSteps
        const response = await agent.generate(prompt, {
            maxSteps
        });

        const durationMs = Date.now() - startTime;

        // Extract model info from record or response
        const modelInfo = {
            provider: record?.modelProvider || "unknown",
            name: record?.modelName || response.response?.modelId || "unknown",
            temperature: record?.temperature ?? 0.7
        };

        console.log(`[Trace] Model: ${modelInfo.provider}/${modelInfo.name}`);

        // Process tool calls with full details
        const rawToolCalls = response.toolCalls || [];
        const rawToolResults = response.toolResults || [];
        const toolCallsData: ToolCallData[] = [];

        console.log(`[Trace] Tool calls: ${rawToolCalls.length}`);

        for (let i = 0; i < rawToolCalls.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tc: any = rawToolCalls[i];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tr: any = rawToolResults[i];

            const toolName = tc.toolName || tc.name || "unknown";
            const toolInput = tc.args || tc.input || {};
            const toolOutput = tr?.result || tr?.output || tr;

            const toolCall: ToolCallData = {
                toolKey: toolName,
                input: toolInput,
                output: toolOutput,
                success: !tr?.error,
                error: tr?.error
            };

            toolCallsData.push(toolCall);

            // Record tool call in RunRecorder
            await run.addToolCall(toolCall);

            // Add step for tool call
            addStep("tool_call", `Calling tool: ${toolName}`, toolCall);

            // Add step for tool result
            const resultSummary =
                typeof toolOutput === "string"
                    ? toolOutput.substring(0, 200)
                    : JSON.stringify(toolOutput)?.substring(0, 200) || "No result";
            addStep("tool_result", `Result from ${toolName}: ${resultSummary}...`);

            console.log(`  ├─ Tool: ${toolName}`);
            console.log(`  │  Input: ${JSON.stringify(toolInput).substring(0, 100)}...`);
            console.log(`  │  Output: ${resultSummary.substring(0, 100)}...`);
        }

        // Add response step
        addStep("response", response.text || "No response generated");

        console.log(`[Trace] Duration: ${durationMs}ms`);
        console.log(`[Trace] Response: "${response.text?.substring(0, 100)}..."`);

        // Extract token usage
        const tokens = extractTokenUsage(response);

        if (tokens) {
            console.log(
                `[Trace] Tokens: ${tokens.promptTokens} prompt, ${tokens.completionTokens} completion`
            );
        }

        // Run evaluations
        const scores: Record<string, number> = {};
        const helpfulnessResult = evaluateHelpfulness(question, response.text || "");
        scores.helpfulness = helpfulnessResult.score;
        console.log(`[Trace] Helpfulness: ${(helpfulnessResult.score * 100).toFixed(0)}%`);

        // Calculate cost based on model and token usage
        const costUsd = calculateCost(
            modelInfo.name,
            modelInfo.provider,
            tokens?.promptTokens || 0,
            tokens?.completionTokens || 0
        );

        // Complete the run with all data
        await run.complete({
            output: response.text || "",
            modelProvider: modelInfo.provider,
            modelName: modelInfo.name,
            promptTokens: tokens?.promptTokens,
            completionTokens: tokens?.completionTokens,
            costUsd,
            steps,
            scores
        });

        console.log(`[Trace] ◀ Complete (${steps.length} steps) - Run ID: ${run.runId}`);
        console.log(`${"═".repeat(70)}\n`);

        // Run relevancy eval async (updates the run)
        runRelevancyEvalAsync(run.runId, question, response.text || "");

        // Return response for ElevenLabs
        return NextResponse.json({
            success: true,
            text: response.text || "I'm sorry, I couldn't find that information.",
            runId: run.runId,
            traceId: run.traceId,
            durationMs,
            model: modelInfo,
            toolsUsed: toolCallsData.map((tc) => tc.toolKey),
            scores
        });
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error(`[Trace] ✗ Error:`, error);

        addStep("response", `Error: ${error instanceof Error ? error.message : "Unknown error"}`);

        return NextResponse.json(
            {
                success: false,
                text: "I'm sorry, I encountered an error while looking that up. Please try again.",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs
            },
            { status: 500 }
        );
    }
}

/**
 * Run relevancy eval asynchronously and update the run
 */
async function runRelevancyEvalAsync(runId: string, input: string, output: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scorer = relevancyScorer as any;
        const result = await scorer.score({
            input,
            output
        });

        const score = result?.score ?? 0;

        // Update the evaluation record for this run
        // Note: The score was already recorded in run.complete(), this adds relevancy
        const { prisma } = await import("@repo/database");
        await prisma.agentEvaluation.upsert({
            where: { runId },
            create: {
                runId,
                agentId: "", // Will be filled from the run
                scoresJson: { relevancy: score }
            },
            update: {
                scoresJson: {
                    relevancy: score
                }
            }
        });

        console.log(`[Trace] Relevancy for ${runId}: ${(score * 100).toFixed(0)}%`);
    } catch (error) {
        console.error(`[Trace] Relevancy eval failed:`, error);
    }
}
