import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, Prisma, RunEnvironment, RunStatus, RunTriggerType } from "@repo/database";

const resolveEnvironment = (requested?: string | null, fallback?: string | null) => {
    const normalized = (requested || fallback || "").trim().toLowerCase();
    if (["prod", "production", "live"].includes(normalized)) {
        return RunEnvironment.PRODUCTION;
    }
    if (["staging", "stage", "preprod"].includes(normalized)) {
        return RunEnvironment.STAGING;
    }
    return RunEnvironment.DEVELOPMENT;
};

const resolveTriggerType = (requested?: string | null, source?: string | null) => {
    const normalized = (requested || source || "").trim().toLowerCase();
    if (["manual", "ui"].includes(normalized)) {
        return RunTriggerType.MANUAL;
    }
    if (["schedule", "scheduled", "cron"].includes(normalized)) {
        return RunTriggerType.SCHEDULED;
    }
    if (["webhook"].includes(normalized)) {
        return RunTriggerType.WEBHOOK;
    }
    if (["tool", "mcp"].includes(normalized)) {
        return RunTriggerType.TOOL;
    }
    if (["test"].includes(normalized)) {
        return RunTriggerType.TEST;
    }
    if (["retry"].includes(normalized)) {
        return RunTriggerType.RETRY;
    }
    return RunTriggerType.API;
};

const inferStepType = (eventType: string) => {
    if (eventType.includes("routing")) return "routing";
    if (eventType.includes("agent")) return "agent";
    if (eventType.includes("workflow")) return "workflow";
    if (eventType.includes("tool")) return "tool";
    return "event";
};

const inferPrimitive = (eventType: string, payload: Record<string, unknown>) => {
    if (payload.agentId) return { type: "agent", id: payload.agentId as string };
    if (payload.workflowId) return { type: "workflow", id: payload.workflowId as string };
    if (payload.toolName) return { type: "tool", id: payload.toolName as string };
    if (payload.toolId) return { type: "tool", id: payload.toolId as string };
    if (eventType.includes("agent")) return { type: "agent", id: payload.agentId as string };
    if (eventType.includes("workflow"))
        return { type: "workflow", id: payload.workflowId as string };
    if (eventType.includes("tool")) return { type: "tool", id: payload.toolName as string };
    return { type: undefined, id: undefined };
};

const tryParseJson = (value: string) => {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return null;
    }
    return null;
};

const baseOutputSchema = z.object({ success: z.boolean() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

export const networkExecuteTool = createTool({
    id: "network-execute",
    description: "Execute a network by slug or ID and return output plus run metadata.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID"),
        message: z.string().describe("Message to route"),
        source: z.string().optional().describe("Source channel (api, webhook, test, etc.)"),
        environment: z
            .string()
            .optional()
            .describe("Environment (development, staging, production)"),
        triggerType: z
            .string()
            .optional()
            .describe("Trigger type (manual, api, scheduled, webhook, tool, test, retry)"),
        threadId: z.string().optional().describe("Optional thread ID"),
        resourceId: z.string().optional().describe("Optional resource ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        runId: z.string().optional(),
        outputText: z.string().optional(),
        outputJson: z.any().optional(),
        steps: z.number().optional(),
        run: z.any().optional()
    }),
    execute: async ({
        networkSlug,
        message,
        source,
        environment,
        triggerType,
        threadId,
        resourceId
    }) => {
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: networkSlug }, { id: networkSlug }] },
            include: { workspace: { select: { environment: true } } }
        });

        if (!network) {
            throw new Error(`Network '${networkSlug}' not found`);
        }

        const { buildNetworkAgent } = await import("../networks/runtime");
        const { agent } = await buildNetworkAgent(network.id);
        const run = await prisma.networkRun.create({
            data: {
                networkId: network.id,
                status: RunStatus.RUNNING,
                inputText: message,
                threadId: threadId || `thread-${Date.now()}`,
                resourceId: resourceId || null,
                source: source || "api",
                environment: resolveEnvironment(environment, network.workspace?.environment),
                triggerType: resolveTriggerType(triggerType, source)
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (agent as any).network(message, {
            maxSteps: network.maxSteps,
            memory: {
                thread: threadId || run.threadId,
                resource: resourceId || run.resourceId || "default"
            }
        });

        const steps: Array<{
            stepNumber: number;
            stepType: string;
            primitiveType?: string;
            primitiveId?: string;
            routingDecision?: Record<string, unknown>;
            inputJson?: Record<string, unknown>;
            outputJson?: Record<string, unknown>;
            status: RunStatus;
        }> = [];

        let stepNumber = 0;
        let outputText = "";
        let outputJson: Record<string, unknown> | undefined;
        let lastResult: Record<string, unknown> | undefined;
        let lastResultText: string | undefined;

        for await (const chunk of result) {
            const chunkAny = chunk as { type: string; payload?: Record<string, unknown> };
            const payload = chunkAny.payload || {};

            if (chunkAny.type === "agent-execution-event-text-delta" && payload.textDelta) {
                outputText += payload.textDelta as string;
            }

            if (chunkAny.type === "network-object-result") {
                outputJson = payload as Record<string, unknown>;
            }

            if (
                payload.result &&
                typeof payload.result === "object" &&
                !Array.isArray(payload.result)
            ) {
                lastResult = payload.result as Record<string, unknown>;
            }
            if (typeof payload.result === "string") {
                lastResultText = payload.result;
                const parsed = tryParseJson(payload.result);
                if (parsed) {
                    lastResult = parsed;
                }
            }

            const stepType = inferStepType(chunkAny.type);
            const primitive = inferPrimitive(chunkAny.type, payload);
            if (
                chunkAny.type.includes("start") ||
                chunkAny.type.includes("end") ||
                chunkAny.type.includes("step-finish") ||
                chunkAny.type.includes("routing")
            ) {
                steps.push({
                    stepNumber: stepNumber++,
                    stepType,
                    primitiveType: primitive.type,
                    primitiveId: primitive.id,
                    routingDecision: stepType === "routing" ? payload : undefined,
                    inputJson: payload.input as Record<string, unknown>,
                    outputJson: payload.result as Record<string, unknown>,
                    status: RunStatus.COMPLETED
                });
            }
        }

        if (!outputJson && lastResult) {
            outputJson = lastResult;
        }
        if (!outputText) {
            if (lastResultText) {
                outputText = lastResultText;
            } else if (outputJson) {
                outputText = JSON.stringify(outputJson, null, 2);
            }
        }

        if (steps.length > 0) {
            await prisma.networkRunStep.createMany({
                data: steps.map((step) => ({
                    runId: run.id,
                    stepNumber: step.stepNumber,
                    stepType: step.stepType,
                    primitiveType: step.primitiveType,
                    primitiveId: step.primitiveId,
                    routingDecision: step.routingDecision
                        ? (step.routingDecision as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    inputJson: step.inputJson
                        ? (step.inputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    outputJson: step.outputJson
                        ? (step.outputJson as Prisma.InputJsonValue)
                        : Prisma.DbNull,
                    status: step.status
                }))
            });
        }

        await prisma.networkRun.update({
            where: { id: run.id },
            data: {
                status: RunStatus.COMPLETED,
                outputText,
                outputJson: outputJson ? (outputJson as Prisma.InputJsonValue) : Prisma.DbNull,
                completedAt: new Date(),
                stepsExecuted: steps.length
            }
        });

        const completedRun = await prisma.networkRun.findUnique({
            where: { id: run.id },
            include: { steps: true }
        });

        return {
            success: true,
            runId: run.id,
            outputText,
            outputJson,
            steps: steps.length,
            run: completedRun
        };
    }
});

export const networkListRunsTool = createTool({
    id: "network-list-runs",
    description: "List network runs with filters and time range.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID"),
        limit: z.number().optional().describe("Max runs to return"),
        status: z.string().optional().describe("Run status filter"),
        environment: z.string().optional().describe("Environment filter"),
        triggerType: z.string().optional().describe("Trigger type filter"),
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp"),
        search: z.string().optional().describe("Search run ID or text")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        runs: z.array(z.any())
    }),
    execute: async ({ networkSlug, limit, status, environment, triggerType, from, to, search }) => {
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: networkSlug }, { id: networkSlug }] }
        });

        if (!network) {
            throw new Error(`Network '${networkSlug}' not found`);
        }

        const where: Record<string, unknown> = {
            networkId: network.id
        };

        const validStatuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];
        if (status && validStatuses.includes(status.toUpperCase())) {
            where.status = status.toUpperCase();
        }
        if (environment) {
            where.environment = resolveEnvironment(environment, environment);
        }
        if (triggerType) {
            where.triggerType = resolveTriggerType(triggerType, triggerType);
        }
        if (from || to) {
            const startedAt: Record<string, Date> = {};
            if (from) {
                const fromDate = new Date(from);
                if (!Number.isNaN(fromDate.getTime())) {
                    startedAt.gte = fromDate;
                }
            }
            if (to) {
                const toDate = new Date(to);
                if (!Number.isNaN(toDate.getTime())) {
                    startedAt.lte = toDate;
                }
            }
            if (Object.keys(startedAt).length > 0) {
                where.startedAt = startedAt;
            }
        }
        if (search) {
            where.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
            ];
        }

        const runs = await prisma.networkRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit ?? 50,
            include: { _count: { select: { steps: true } } }
        });

        return {
            success: true,
            runs: runs.map((run) => ({
                id: run.id,
                status: run.status,
                inputText: run.inputText,
                outputText: run.outputText,
                outputJson: run.outputJson,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                durationMs: run.durationMs,
                environment: run.environment,
                triggerType: run.triggerType,
                stepsCount: run._count?.steps ?? 0
            }))
        };
    }
});

export const networkGetRunTool = createTool({
    id: "network-get-run",
    description: "Fetch network run details including steps.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID"),
        runId: z.string().describe("Run ID")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        run: z.any()
    }),
    execute: async ({ networkSlug, runId }) => {
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug: networkSlug }, { id: networkSlug }] }
        });

        if (!network) {
            throw new Error(`Network '${networkSlug}' not found`);
        }

        const run = await prisma.networkRun.findUnique({
            where: { id: runId },
            include: { steps: true }
        });

        if (!run || run.networkId !== network.id) {
            throw new Error(`Run '${runId}' not found`);
        }

        return { success: true, run };
    }
});

export const networkMetricsTool = createTool({
    id: "network-metrics",
    description: "Get network metrics for a recent period.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID"),
        days: z.number().optional().describe("Number of days to include")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ networkSlug, days }) => {
        return callInternalApi(`/api/networks/${networkSlug}/metrics`, {
            query: { days }
        });
    }
});

export const networkVersionsTool = createTool({
    id: "network-versions",
    description: "List network versions.",
    inputSchema: z.object({
        networkSlug: z.string().describe("Network slug or ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ networkSlug }) => {
        return callInternalApi(`/api/networks/${networkSlug}/versions`);
    }
});

export const networkStatsTool = createTool({
    id: "network-stats",
    description: "Get network statistics across the workspace.",
    inputSchema: z.object({
        from: z.string().optional().describe("Start ISO timestamp"),
        to: z.string().optional().describe("End ISO timestamp")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ from, to }) => {
        return callInternalApi("/api/networks/stats", {
            query: { from, to }
        });
    }
});
