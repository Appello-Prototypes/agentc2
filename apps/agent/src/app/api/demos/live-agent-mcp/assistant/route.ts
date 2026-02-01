import { NextRequest, NextResponse } from "next/server";
import {
    agentResolver,
    relevancyScorer,
    evaluateHelpfulness,
    listMcpToolDefinitions
} from "@repo/mastra";
import {
    storeTrace,
    updateTrace,
    type ConversationTrace,
    type ToolCall,
    type ExecutionStep
} from "@/lib/trace-store";

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
 * Captures full observability data: model, tools, reasoning, timing.
 *
 * Query Parameters:
 * - agent: Agent slug to use (default: env ELEVENLABS_DEFAULT_AGENT_SLUG or "mcp-agent")
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const steps: ExecutionStep[] = [];
    let stepCounter = 0;

    const addStep = (type: ExecutionStep["type"], content: string, toolCall?: ToolCall) => {
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
        const maxSteps = record?.maxSteps || 5;
        addStep("thinking", `Resolved agent "${agentSlug}" from ${source} (maxSteps: ${maxSteps})`);

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

        // Generate trace ID
        const traceId =
            response.traceId || `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Process tool calls with full details
        const rawToolCalls = response.toolCalls || [];
        const rawToolResults = response.toolResults || [];
        const toolCalls: ToolCall[] = [];

        console.log(`[Trace] Tool calls: ${rawToolCalls.length}`);

        for (let i = 0; i < rawToolCalls.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tc: any = rawToolCalls[i];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tr: any = rawToolResults[i];

            const toolName = tc.toolName || tc.name || "unknown";
            const toolInput = tc.args || tc.input || {};
            const toolOutput = tr?.result || tr?.output || tr;

            const toolCall: ToolCall = {
                name: toolName,
                input: toolInput,
                output: toolOutput,
                success: !tr?.error,
                error: tr?.error
            };

            toolCalls.push(toolCall);

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

        // Extract token usage if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usageAny = response.usage as any;
        const tokens = usageAny
            ? {
                  prompt: usageAny.promptTokens || usageAny.inputTokens || 0,
                  completion: usageAny.completionTokens || usageAny.outputTokens || 0,
                  total: usageAny.totalTokens || 0
              }
            : undefined;

        if (tokens) {
            console.log(`[Trace] Tokens: ${tokens.prompt} prompt, ${tokens.completion} completion`);
        }

        // Run evaluations
        const scores: ConversationTrace["scores"] = {};
        const helpfulnessResult = evaluateHelpfulness(question, response.text || "");
        scores.helpfulness = {
            score: helpfulnessResult.score,
            reasoning: helpfulnessResult.reasoning
        };
        console.log(`[Trace] Helpfulness: ${(helpfulnessResult.score * 100).toFixed(0)}%`);

        // Build full trace
        const trace: ConversationTrace = {
            traceId,
            timestamp: new Date().toISOString(),
            input: question,
            output: response.text || "",
            model: modelInfo,
            availableTools,
            toolCalls,
            steps,
            durationMs,
            tokens,
            scores,
            metadata: {
                source: "elevenlabs-voice",
                agentSlug: agentSlug,
                agentSource: source,
                elevenlabsAgentId: process.env.ELEVENLABS_AGENT_ID,
                maxSteps
            }
        };

        // Store trace (async, don't block response)
        storeTrace(trace).catch((err) => {
            console.error("[Trace] Failed to store trace:", err);
        });

        console.log(`[Trace] ◀ Complete (${steps.length} steps)`);
        console.log(`${"═".repeat(70)}\n`);

        // Run relevancy eval async
        runRelevancyEvalAsync(traceId, question, response.text || "");

        // Return response for ElevenLabs
        return NextResponse.json({
            success: true,
            text: response.text || "I'm sorry, I couldn't find that information.",
            traceId,
            durationMs,
            model: modelInfo,
            toolsUsed: toolCalls.map((tc) => tc.name),
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
 * Run relevancy eval asynchronously
 */
async function runRelevancyEvalAsync(traceId: string, input: string, output: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scorer = relevancyScorer as any;
        const result = await scorer.score({
            input,
            output
        });

        const score = result?.score ?? 0;

        const updated = await updateTrace(traceId, {
            scores: {
                relevancy: { score }
            }
        });

        if (updated) {
            console.log(`[Trace] Relevancy for ${traceId}: ${(score * 100).toFixed(0)}%`);
        }
    } catch (error) {
        console.error(`[Trace] Relevancy eval failed:`, error);
    }
}
