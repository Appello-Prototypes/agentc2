#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { prisma } from "../packages/database/src";
import { agentResolver } from "../packages/agentc2/src";
import {
    extractTokenUsage,
    extractToolCalls,
    startRun,
    startConversationRun,
    finalizeConversationRun
} from "../apps/agent/src/lib/run-recorder";

type ConversationMessage = {
    role: "user";
    content: string;
};

type ParsedArgs = {
    agentSlug: string;
    simulatorSlug: string;
    count: number;
    turns: number;
    concurrency: number;
    sessionId: string;
};

const usage = `Usage:
  bun run scripts/simulate-conversations.ts --agent <slug> --simulator <slug> [options]

Options:
  --count <number>        Total conversations (default: 1000)
  --turns <number>        User messages per conversation (default: 1)
  --concurrency <number>  Parallel conversations (default: 5)
  --session <id>          Session id for grouping (default: sim-<timestamp>)
`;

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);
    const values = new Map<string, string | boolean>();

    for (let i = 0; i < args.length; i += 1) {
        const raw = args[i];
        if (!raw.startsWith("--")) continue;

        const [key, inlineValue] = raw.slice(2).split("=");
        if (inlineValue !== undefined) {
            values.set(key, inlineValue);
            continue;
        }

        const next = args[i + 1];
        if (next && !next.startsWith("--")) {
            values.set(key, next);
            i += 1;
        } else {
            values.set(key, true);
        }
    }

    const agentSlug = String(values.get("agent") || "");
    const simulatorSlug = String(values.get("simulator") || "");

    if (!agentSlug || !simulatorSlug) {
        console.error(usage);
        process.exit(1);
    }

    const count = Math.max(1, Number(values.get("count") || 1000));
    const turns = Math.max(1, Math.min(10, Number(values.get("turns") || 1)));
    const concurrency = Math.max(1, Math.min(25, Number(values.get("concurrency") || 5)));
    const sessionId =
        typeof values.get("session") === "string"
            ? String(values.get("session"))
            : `sim-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    return { agentSlug, simulatorSlug, count, turns, concurrency, sessionId };
}

function extractJsonPayload(text: string): unknown | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const direct = tryParseJson(trimmed);
    if (direct) return direct;

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        const candidate = trimmed.slice(start, end + 1);
        return tryParseJson(candidate);
    }

    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        const candidate = trimmed.slice(arrayStart, arrayEnd + 1);
        return tryParseJson(candidate);
    }

    return null;
}

function tryParseJson(value: string): unknown | null {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeMessages(payload: unknown, fallbackText: string): ConversationMessage[] {
    if (payload && typeof payload === "object") {
        if (Array.isArray(payload)) {
            const messages = payload
                .map((entry) => {
                    if (typeof entry === "string") {
                        return { role: "user", content: entry.trim() };
                    }
                    if (entry && typeof entry === "object") {
                        const record = entry as { content?: unknown; role?: unknown };
                        if (typeof record.content === "string") {
                            return { role: "user", content: record.content.trim() };
                        }
                    }
                    return null;
                })
                .filter((entry): entry is ConversationMessage => Boolean(entry?.content));

            if (messages.length > 0) return messages;
        }

        const record = payload as { messages?: unknown };
        if (Array.isArray(record.messages)) {
            const messages = record.messages
                .map((entry) => {
                    if (typeof entry === "string") {
                        return { role: "user", content: entry.trim() };
                    }
                    if (entry && typeof entry === "object") {
                        const message = entry as { content?: unknown; role?: unknown };
                        if (typeof message.content === "string") {
                            return { role: "user", content: message.content.trim() };
                        }
                    }
                    return null;
                })
                .filter((entry): entry is ConversationMessage => Boolean(entry?.content));

            if (messages.length > 0) return messages;
        }
    }

    const fallback = fallbackText.trim();
    return fallback ? [{ role: "user", content: fallback }] : [];
}

function buildSimulatorPrompt(options: {
    agentName: string;
    agentSlug: string;
    description: string | null;
    instructions: string;
    toolNames: string[];
    turns: number;
}): string {
    const toolList = options.toolNames.length > 0 ? options.toolNames.join(", ") : "none";

    return `You are simulating realistic user conversations for an AI agent.

Target agent:
- Name: ${options.agentName}
- Slug: ${options.agentSlug}
- Description: ${options.description || "none"}
- Instructions: ${options.instructions}
- Tools available: ${toolList}

Generate ${options.turns} user messages that form a coherent conversation a real user might have.

Return JSON only in this exact shape:
{"messages":[{"role":"user","content":"..."}]}
`;
}

async function runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (index < tasks.length) {
            const current = index;
            index += 1;
            results[current] = await tasks[current]();
        }
    });

    await Promise.all(workers);
    return results;
}

async function main() {
    const { agentSlug, simulatorSlug, count, turns, concurrency, sessionId } = parseArgs();

    console.log(`Starting simulation: ${count} conversations`);
    console.log(`Agent: ${agentSlug}`);
    console.log(`Simulator: ${simulatorSlug}`);
    console.log(`Turns per conversation: ${turns}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log(`Session: ${sessionId}\n`);

    const targetResolved = await agentResolver.resolve({ slug: agentSlug });
    if (!targetResolved.record) {
        throw new Error(`Agent '${agentSlug}' must exist in the database to record runs`);
    }

    const simulatorResolved = await agentResolver.resolve({ slug: simulatorSlug });

    const toolNames = targetResolved.record.tools.map((tool) => tool.toolId);
    const simulatorPrompt = buildSimulatorPrompt({
        agentName: targetResolved.record.name,
        agentSlug: targetResolved.record.slug,
        description: targetResolved.record.description ?? null,
        instructions: targetResolved.record.instructions,
        toolNames,
        turns
    });

    let successCount = 0;
    let failureCount = 0;

    const tasks = Array.from({ length: count }, (_, index) => async () => {
        const conversationId = `sim-${sessionId}-${index + 1}-${randomUUID()}`;
        let messages: ConversationMessage[] = [];

        try {
            const simulatorResponse = await simulatorResolved.agent.generate(simulatorPrompt, {
                maxSteps: simulatorResolved.record?.maxSteps ?? 5
            });
            const payload = extractJsonPayload(simulatorResponse.text);
            messages = normalizeMessages(payload, simulatorResponse.text);
        } catch (error) {
            console.error(
                `[Simulator] Failed to generate prompts for conversation ${index + 1}`,
                error
            );
        }

        if (messages.length === 0) {
            failureCount += 1;
            return { conversationId, ok: false };
        }

        const limitedMessages = messages.slice(0, turns);

        // Use conversation-level run: one run per simulated conversation
        let conversationHandle: Awaited<ReturnType<typeof startConversationRun>> | null = null;
        let isFirstMessage = true;

        for (const message of limitedMessages) {
            let turnHandle;

            if (isFirstMessage) {
                conversationHandle = await startConversationRun({
                    agentId: targetResolved.record.id,
                    agentSlug: targetResolved.record.slug,
                    input: message.content,
                    source: "simulation",
                    threadId: conversationId,
                    sessionId
                });
                turnHandle = conversationHandle;
                isFirstMessage = false;
            } else if (conversationHandle) {
                turnHandle = await conversationHandle.addTurn(message.content);
            } else {
                break;
            }

            try {
                const response = await targetResolved.agent.generate(message.content, {
                    maxSteps: targetResolved.record.maxSteps ?? 5
                });
                const usage = extractTokenUsage(response);
                const toolCalls = extractToolCalls(response);

                for (const toolCall of toolCalls) {
                    await turnHandle.addToolCall(toolCall);
                }

                await turnHandle.completeTurn({
                    output: response.text,
                    modelProvider: targetResolved.record.modelProvider,
                    modelName: targetResolved.record.modelName,
                    promptTokens: usage?.promptTokens,
                    completionTokens: usage?.completionTokens
                });

                successCount += 1;
            } catch (error) {
                await turnHandle.failTurn(error instanceof Error ? error : String(error));
                failureCount += 1;
            }
        }

        // Finalize the conversation run
        if (conversationHandle) {
            await conversationHandle.finalizeRun();
        }

        return { conversationId, ok: true };
    });

    await runWithConcurrency(tasks, concurrency);

    console.log("\nSimulation complete");
    console.log(`Successes: ${successCount}`);
    console.log(`Failures: ${failureCount}`);
}

main()
    .catch((error) => {
        console.error("Simulation failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
