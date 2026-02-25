import { createHash } from "crypto";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateId,
    type UIMessageStreamWriter
} from "ai";
import { agentResolver } from "@repo/agentc2/agents";
import { getScorersByNames } from "@repo/agentc2/scorers/registry";
import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import {
    startConversationRun,
    type RunSource,
    type RunRecorderHandle,
    type TurnHandle,
    type ToolCallData
} from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

// ── Rate Limiter ────────────────────────────────────────────────────────
// Simple in-memory IP-based rate limiter.
// Resets per window. Not shared across instances (fine for single-server).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return { allowed: true, remaining: maxPerMinute - 1 };
    }

    if (entry.count >= maxPerMinute) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: maxPerMinute - entry.count };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatToolResultPreview(result: unknown, maxLength = 500): string {
    if (typeof result === "string") {
        return result.slice(0, maxLength);
    }
    try {
        const json = JSON.stringify(result, null, 2);
        if (json === undefined) return String(result).slice(0, maxLength);
        return json.slice(0, maxLength);
    } catch {
        return String(result).slice(0, maxLength);
    }
}

type ScorerRunner = {
    run?: (options: {
        input: { inputMessages: Array<{ role: string; content: string }> };
        output: Array<{ role: string; content: string }>;
    }) => Promise<{ score?: number; reason?: string }>;
};

type StreamChunk = {
    type?: string;
    payload?: Record<string, unknown>;
    toolName?: string;
    name?: string;
    toolCallId?: string;
    id?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    textDelta?: string;
    text?: string;
    delta?: string;
    content?: string;
    value?: unknown;
};

type UsageLike = {
    promptTokens?: number;
    inputTokens?: number;
    completionTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

type StreamResult = {
    fullStream?: AsyncIterable<unknown>;
    textStream: AsyncIterable<string>;
    usage?: Promise<Record<string, unknown>>;
};

const normalizeChunk = (chunk: unknown): StreamChunk => {
    if (chunk && typeof chunk === "object") return chunk as StreamChunk;
    return {};
};

// ── Evaluations (fire-and-forget) ───────────────────────────────────────

async function runEvaluationsAsync(
    runId: string,
    agentId: string,
    scorerNames: string[],
    inputText: string,
    outputText: string
): Promise<void> {
    try {
        if (scorerNames.length === 0) return;

        const scorers = getScorersByNames(scorerNames);
        const scores: Record<string, number> = {};

        // Format for Mastra's getTextContentFromMastraDBMessage() (see chat/route.ts)
        const input = {
            inputMessages: [
                {
                    role: "user" as const,
                    content: {
                        content: inputText,
                        parts: [{ type: "text" as const, text: inputText }]
                    }
                }
            ]
        } as unknown as { inputMessages: { role: string; content: string }[] };
        const output = [
            {
                role: "assistant" as const,
                content: {
                    content: outputText,
                    parts: [{ type: "text" as const, text: outputText }]
                }
            }
        ] as unknown as { role: string; content: string }[];

        for (const [name, config] of Object.entries(scorers)) {
            try {
                const scorer = config.scorer as unknown as ScorerRunner;
                if (scorer && typeof scorer.run === "function") {
                    const result = await scorer.run({ input, output });
                    scores[name] = result.score ?? 0;
                }
            } catch (scorerError) {
                console.error(`[Public Chat] Scorer ${name} failed:`, scorerError);
            }
        }

        if (Object.keys(scores).length > 0) {
            await prisma.agentEvaluation.upsert({
                where: { runId },
                create: { runId, agentId, scoresJson: scores },
                update: { scoresJson: scores }
            });
        }
    } catch (error) {
        console.error(`[Public Chat] Evaluation failed for run ${runId}:`, error);
    }
}

// ── POST /api/agents/[id]/chat/public ───────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // ── Token validation ────────────────────────────────────────────
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing authorization token" },
                { status: 401 }
            );
        }

        // Look up agent by slug and validate publicToken
        const agentRecord = await prisma.agent.findFirst({
            where: {
                slug: id,
                visibility: "PUBLIC",
                publicToken: token,
                isActive: true
            },
            include: { tools: true }
        });

        if (!agentRecord) {
            return NextResponse.json(
                { success: false, error: "Invalid token or agent not public" },
                { status: 403 }
            );
        }

        // ── Rate limiting ───────────────────────────────────────────────
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown";
        const embedConfig = (agentRecord.metadata as Record<string, unknown>)?.publicEmbed as
            | Record<string, unknown>
            | undefined;
        const maxPerMinute =
            typeof embedConfig?.rateLimit === "number" ? embedConfig.rateLimit : 20;

        const { allowed, remaining } = checkRateLimit(ip, maxPerMinute);
        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                {
                    status: 429,
                    headers: {
                        "Retry-After": "60",
                        "X-RateLimit-Remaining": "0"
                    }
                }
            );
        }

        // ── Parse request body ──────────────────────────────────────────
        const body = await request.json();
        const { threadId, messages } = body;

        // Resolve org for tenant-scoped memory isolation
        let publicOrgId = "";
        if (agentRecord.workspaceId) {
            const ws = await prisma.workspace.findUnique({
                where: { id: agentRecord.workspaceId },
                select: { organizationId: true }
            });
            publicOrgId = ws?.organizationId || "";
        }

        const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 12);
        const userThreadId = threadId
            ? publicOrgId
                ? `${publicOrgId}:${threadId}`
                : threadId
            : publicOrgId
              ? `${publicOrgId}:embed-${id}-${Date.now()}`
              : `embed-${id}-${Date.now()}`;
        const resourceId = publicOrgId ? `${publicOrgId}:public-${ipHash}` : `public-${ipHash}`;

        // Extract last user message (text only -- no file uploads for public)
        const lastUserMsg = messages?.filter((m: { role: string }) => m.role === "user").pop() as
            | {
                  content?: string;
                  parts?: Array<{ type: string; text?: string }>;
              }
            | undefined;

        let lastUserMessage = "";
        if (lastUserMsg?.parts && Array.isArray(lastUserMsg.parts)) {
            for (const part of lastUserMsg.parts) {
                if (part.type === "text" && part.text) {
                    lastUserMessage = part.text;
                }
            }
        } else if (lastUserMsg?.content) {
            lastUserMessage = lastUserMsg.content;
        }

        if (!lastUserMessage) {
            return NextResponse.json(
                { success: false, error: "No user message provided" },
                { status: 400 }
            );
        }

        // ── Resolve agent ───────────────────────────────────────────────
        const runSource: RunSource = "embed";
        const { agent, record, activeSkills, toolOriginMap } = await agentResolver.resolve({
            slug: id,
            requestContext: {},
            threadId: userThreadId
        });

        const agentId = record?.id || null;

        // Compute instructions hash for tracing
        const mergedInstructions =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (agent as any).__config?.instructions || "";
        const instructionsHash = mergedInstructions
            ? createHash("sha256").update(mergedInstructions).digest("hex")
            : undefined;

        // ── Start run recording ─────────────────────────────────────────
        let run: RunRecorderHandle | null = null;
        let turnHandle: TurnHandle | null = null;
        let runReady: Promise<void> | null = null;

        if (agentId) {
            runReady = startConversationRun({
                agentId,
                agentSlug: id,
                input: lastUserMessage,
                source: runSource,
                userId: resourceId,
                threadId: userThreadId,
                skillsJson: activeSkills.length > 0 ? activeSkills : undefined,
                toolOriginMap: Object.keys(toolOriginMap).length > 0 ? toolOriginMap : undefined,
                instructionsHash,
                instructionsSnapshot: mergedInstructions || undefined,
                tenantId: record?.tenantId || undefined
            })
                .then((handle) => {
                    turnHandle = handle;
                    run = {
                        runId: handle.runId,
                        traceId: handle.traceId,
                        complete: handle.completeTurn,
                        fail: handle.failTurn,
                        addToolCall: handle.addToolCall
                    };
                    console.log(`[Public Chat] Started run ${handle.runId} for embed agent ${id}`);
                })
                .catch((e) => {
                    console.warn("[Public Chat] Failed to start run:", e);
                });
        }

        // Use maxSteps from database record (capped for public safety)
        const maxSteps = Math.min(record?.maxSteps ?? 5, 15);

        // ── Stream response ─────────────────────────────────────────────
        let fullOutput = "";
        const toolCalls: ToolCallData[] = [];

        type ExecutionStep = {
            step: number;
            type: "tool_call" | "tool_result" | "response";
            content: string;
            timestamp: string;
            durationMs?: number;
        };
        const executionSteps: ExecutionStep[] = [];
        let stepCounter = 0;

        const toolCallMap = new Map<
            string,
            {
                toolName: string;
                args: Record<string, unknown>;
                startTime: number;
            }
        >();

        const responseStream = await agent.stream(lastUserMessage, {
            maxSteps,
            memory: {
                thread: userThreadId,
                resource: resourceId
            }
        });

        const stream = createUIMessageStream({
            execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                if (runReady) await runReady;

                const messageId = generateId();

                try {
                    writer.write({ type: "text-start", id: messageId });

                    if (run) {
                        writer.write({
                            type: "data-run-metadata",
                            data: {
                                runId: run.runId,
                                turnId: turnHandle?.turnId,
                                turnIndex: turnHandle?.turnIndex,
                                messageId
                            }
                        });
                    }

                    const streamResult = responseStream as unknown as StreamResult;
                    const fullStream = streamResult.fullStream;
                    const textStream = streamResult.textStream;

                    const handleToolChunk = (c: StreamChunk) => {
                        if (c.type === "tool-call") {
                            const payload =
                                c.payload &&
                                typeof c.payload === "object" &&
                                !Array.isArray(c.payload)
                                    ? (c.payload as Record<string, unknown>)
                                    : {};
                            const toolName =
                                (typeof payload.toolName === "string" && payload.toolName) ||
                                (typeof payload.name === "string" && payload.name) ||
                                (typeof c.toolName === "string" && c.toolName) ||
                                (typeof c.name === "string" && c.name) ||
                                "unknown";
                            const toolCallId =
                                (typeof payload.toolCallId === "string" && payload.toolCallId) ||
                                (typeof payload.id === "string" && payload.id) ||
                                (typeof c.toolCallId === "string" && c.toolCallId) ||
                                (typeof c.id === "string" && c.id) ||
                                `tool-${Date.now()}`;
                            const args =
                                (payload.args as Record<string, unknown> | undefined) ||
                                (c.args as Record<string, unknown> | undefined) ||
                                {};

                            toolCallMap.set(toolCallId, {
                                toolName,
                                args,
                                startTime: Date.now()
                            });

                            writer.write({
                                type: "tool-input-available",
                                toolCallId,
                                toolName,
                                input: args
                            });

                            stepCounter++;
                            executionSteps.push({
                                step: stepCounter,
                                type: "tool_call",
                                content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                                timestamp: new Date().toISOString()
                            });
                            return;
                        }

                        if (c.type === "tool-result") {
                            const payload =
                                c.payload &&
                                typeof c.payload === "object" &&
                                !Array.isArray(c.payload)
                                    ? (c.payload as Record<string, unknown>)
                                    : {};
                            const toolCallId =
                                (typeof payload.toolCallId === "string" && payload.toolCallId) ||
                                (typeof payload.id === "string" && payload.id) ||
                                (typeof c.toolCallId === "string" && c.toolCallId) ||
                                c.id ||
                                "";
                            const toolName =
                                (typeof payload.toolName === "string" && payload.toolName) ||
                                (typeof c.toolName === "string" && c.toolName) ||
                                "unknown";
                            const result = payload.result ?? c.result;
                            const error = (payload.error as string | undefined) ?? c.error;
                            const call = toolCallMap.get(toolCallId);
                            let durationMs: number | undefined;

                            if (call) {
                                durationMs = Date.now() - call.startTime;
                                toolCalls.push({
                                    toolKey: call.toolName,
                                    input: call.args,
                                    output: result,
                                    success: !error,
                                    error: error,
                                    durationMs
                                });
                            } else {
                                toolCalls.push({
                                    toolKey: toolName,
                                    input: {},
                                    output: result,
                                    success: !error,
                                    error: error
                                });
                            }

                            if (error) {
                                writer.write({
                                    type: "tool-output-error",
                                    toolCallId,
                                    errorText: error
                                });
                            } else {
                                writer.write({
                                    type: "tool-output-available",
                                    toolCallId,
                                    output: result
                                });
                            }

                            stepCounter++;
                            const resultPreview = formatToolResultPreview(result, 500);
                            executionSteps.push({
                                step: stepCounter,
                                type: "tool_result",
                                content: error
                                    ? `Tool ${call?.toolName || toolName} failed: ${error}`
                                    : `Tool ${call?.toolName || toolName} result:\n${resultPreview}${resultPreview.length >= 500 ? "..." : ""}`,
                                timestamp: new Date().toISOString(),
                                durationMs
                            });
                        }
                    };

                    const IDLE_TIMEOUT_MS = 10_000;
                    let generationDone = false;

                    async function drainTextWithIdleTimeout(
                        stream: AsyncIterable<string>
                    ): Promise<void> {
                        const iterator = (
                            stream as AsyncIterable<string> & {
                                [Symbol.asyncIterator](): AsyncIterator<string>;
                            }
                        )[Symbol.asyncIterator]();

                        while (true) {
                            const raceTargets: Promise<
                                IteratorResult<string, unknown> | { done: true; value: undefined }
                            >[] = [iterator.next()];

                            if (generationDone) {
                                raceTargets.push(
                                    new Promise((resolve) =>
                                        setTimeout(
                                            () => resolve({ done: true, value: undefined }),
                                            IDLE_TIMEOUT_MS
                                        )
                                    )
                                );
                            }

                            const result = await Promise.race(raceTargets);
                            if (result.done) break;

                            const chunk = result.value as string;
                            fullOutput += chunk;
                            writer.write({
                                type: "text-delta",
                                id: messageId,
                                delta: chunk
                            });
                        }
                    }

                    if (fullStream && textStream) {
                        void (async () => {
                            try {
                                for await (const chunk of fullStream) {
                                    handleToolChunk(normalizeChunk(chunk));
                                }
                            } catch (e) {
                                console.error(
                                    "[Public Chat] fullStream background drain error:",
                                    e
                                );
                            } finally {
                                generationDone = true;
                            }
                        })();

                        await drainTextWithIdleTimeout(textStream);
                    } else if (fullStream) {
                        for await (const chunk of fullStream) {
                            const c = normalizeChunk(chunk);
                            if (c.type === "text-delta") {
                                const text =
                                    (typeof c.payload?.text === "string" && c.payload.text) ||
                                    (typeof c.textDelta === "string" && c.textDelta) ||
                                    (typeof c.text === "string" && c.text) ||
                                    (typeof c.delta === "string" && c.delta) ||
                                    (typeof c.content === "string" && c.content) ||
                                    (typeof c.value === "string" ? c.value : "") ||
                                    "";
                                if (text) {
                                    fullOutput += text;
                                    writer.write({
                                        type: "text-delta",
                                        id: messageId,
                                        delta: text
                                    });
                                }
                            } else {
                                handleToolChunk(c);
                            }
                        }
                    } else {
                        await drainTextWithIdleTimeout(textStream);
                    }

                    writer.write({ type: "text-end", id: messageId });

                    // ── Usage & cost tracking ───────────────────────────
                    let usage: UsageLike | null = null;
                    try {
                        if (streamResult?.usage) {
                            const resolvedUsage = await streamResult.usage;
                            usage =
                                resolvedUsage && typeof resolvedUsage === "object"
                                    ? (resolvedUsage as UsageLike)
                                    : null;
                        }
                    } catch {
                        // Non-critical
                    }

                    if (run) {
                        for (const tc of toolCalls) {
                            await run.addToolCall(tc);
                        }
                    }

                    let promptTokens = usage?.promptTokens || usage?.inputTokens || 0;
                    let completionTokens = usage?.completionTokens || usage?.outputTokens || 0;
                    const totalTokens = usage?.totalTokens || 0;

                    if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
                        promptTokens = Math.round(totalTokens * 0.7);
                        completionTokens = totalTokens - promptTokens;
                    }

                    const costUsd = calculateCost(
                        record?.modelName || "unknown",
                        record?.modelProvider || "unknown",
                        promptTokens,
                        completionTokens
                    );

                    stepCounter++;
                    executionSteps.push({
                        step: stepCounter,
                        type: "response",
                        content:
                            fullOutput.slice(0, 2000) + (fullOutput.length > 2000 ? "..." : ""),
                        timestamp: new Date().toISOString()
                    });

                    if (run) {
                        await run.complete({
                            output: fullOutput,
                            modelProvider: record?.modelProvider || "unknown",
                            modelName: record?.modelName || "unknown",
                            promptTokens,
                            completionTokens,
                            costUsd,
                            steps: executionSteps
                        });
                    }

                    // Fire-and-forget evaluations
                    if (run && agentId) {
                        const scorerNames = record?.scorers || [];
                        if (scorerNames.length > 0) {
                            runEvaluationsAsync(
                                run.runId,
                                agentId,
                                scorerNames,
                                lastUserMessage,
                                fullOutput
                            ).catch(console.error);
                        }
                    }
                } catch (streamError) {
                    console.error("[Public Chat] Stream error:", streamError);
                    if (run) {
                        await run.fail(
                            streamError instanceof Error ? streamError : String(streamError)
                        );
                    }
                    writer.write({
                        type: "error",
                        errorText:
                            streamError instanceof Error ? streamError.message : "Stream failed"
                    });
                }
            },
            onError: (error: unknown) => {
                console.error(
                    "[Public Chat] UIMessageStream error:",
                    error instanceof Error ? error.message : "[non-Error]"
                );
                if (run) {
                    run.fail(error instanceof Error ? error : String(error)).catch(console.error);
                }
                return error instanceof Error ? error.message : "Stream failed";
            }
        });

        return createUIMessageStreamResponse({
            stream,
            headers: {
                "X-RateLimit-Remaining": String(remaining)
            }
        });
    } catch (error) {
        console.error(
            "[Public Chat] Error:",
            error instanceof Error ? error.message : "[non-Error]"
        );
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to process chat request"
            },
            { status: 500 }
        );
    }
}
