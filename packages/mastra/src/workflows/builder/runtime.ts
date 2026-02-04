import { agentResolver, type RequestContext } from "../../agents/resolver";
import { getToolsByNamesAsync } from "../../tools/registry";
import { mastra } from "../../mastra";
import { prisma } from "@repo/database";
import {
    type WorkflowDefinition,
    type WorkflowExecutionContext,
    type WorkflowExecutionResult,
    type WorkflowExecutionStep,
    type WorkflowStep,
    type WorkflowResumeInput,
    type WorkflowAgentConfig,
    type WorkflowToolConfig,
    type WorkflowBranchConfig,
    type WorkflowParallelConfig,
    type WorkflowForeachConfig,
    type WorkflowHumanConfig,
    type WorkflowCallConfig
} from "./types";

interface ExecuteWorkflowOptions {
    definition: WorkflowDefinition;
    input: unknown;
    resume?: WorkflowResumeInput;
    existingSteps?: Record<string, unknown>;
    onStepEvent?: (event: WorkflowExecutionStep) => void;
    requestContext?: RequestContext;
    depth?: number;
}

const MAX_NESTING_DEPTH = 5;

function normalizePath(path: string): string[] {
    return path
        .replace(/\[(["']?)([^\]"']+)\1\]/g, ".$2")
        .split(".")
        .filter(Boolean);
}

function getValueAtPath(source: unknown, path: string): unknown {
    if (!path) return source;
    const parts = normalizePath(path);
    let current: unknown = source;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function resolveTemplate(value: string, context: WorkflowExecutionContext): unknown {
    const exactMatch = value.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (exactMatch) {
        return getValueAtPath(context, exactMatch[1]);
    }

    if (!value.includes("{{")) {
        return value;
    }

    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        const resolved = getValueAtPath(context, path);
        if (resolved === undefined || resolved === null) {
            return match;
        }
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
}

function resolveValue(value: unknown, context: WorkflowExecutionContext): unknown {
    if (typeof value === "string") {
        return resolveTemplate(value, context);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => resolveValue(entry, context));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, context)])
        );
    }
    return value;
}

function resolveInputMapping(
    mapping: Record<string, unknown> | undefined,
    context: WorkflowExecutionContext
): Record<string, unknown> {
    if (!mapping || Object.keys(mapping).length === 0) {
        return (context.input as Record<string, unknown>) || {};
    }
    return resolveValue(mapping, context) as Record<string, unknown>;
}

function evaluateCondition(expression: string, context: WorkflowExecutionContext): boolean {
    try {
        const evaluator = new Function("input", "steps", "variables", `return (${expression});`);
        return Boolean(evaluator(context.input, context.steps, context.variables));
    } catch (error) {
        console.warn("[WorkflowRuntime] Condition evaluation failed:", error);
        return false;
    }
}

async function executeAgentStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext
) {
    const config = (step.config || {}) as unknown as WorkflowAgentConfig;
    const agentSlug = config.agentSlug;
    if (!agentSlug) {
        throw new Error(`Agent step "${step.id}" missing agentSlug`);
    }

    const prompt = resolveTemplate(config.promptTemplate || "", context) as string;
    const { agent } = await agentResolver.resolve({
        slug: agentSlug,
        requestContext
    });

    const response = await agent.generate(prompt, {
        maxSteps: config.maxSteps
    });

    if (config.outputFormat === "json") {
        const text = response.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                return { raw: text };
            }
        }
        return { raw: text };
    }

    return {
        text: response.text,
        toolCalls: response.toolCalls || []
    };
}

async function executeToolStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext
) {
    const config = (step.config || {}) as unknown as WorkflowToolConfig;
    if (!config.toolId) {
        throw new Error(`Tool step "${step.id}" missing toolId`);
    }

    const organizationId = requestContext?.resource?.tenantId || requestContext?.tenantId;
    const tools = await getToolsByNamesAsync([config.toolId], organizationId);
    const tool = tools[config.toolId];
    if (!tool) {
        throw new Error(`Tool "${config.toolId}" not found`);
    }

    const input = resolveInputMapping(step.inputMapping || config.parameters, context);

    const handler =
        (tool as { execute?: (args: Record<string, unknown>) => Promise<unknown> }).execute ||
        (tool as { invoke?: (args: Record<string, unknown>) => Promise<unknown> }).invoke ||
        (tool as { run?: (args: Record<string, unknown>) => Promise<unknown> }).run ||
        (tool as (args: Record<string, unknown>) => Promise<unknown>);

    if (typeof handler !== "function") {
        throw new Error(`Tool "${config.toolId}" does not expose an executable handler`);
    }

    return handler(input);
}

async function executeWorkflowStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    resume: WorkflowResumeInput | undefined,
    requestContext?: RequestContext,
    depth = 0
): Promise<WorkflowExecutionResult> {
    const config = (step.config || {}) as unknown as WorkflowCallConfig;
    if (!config.workflowId) {
        throw new Error(`Workflow step "${step.id}" missing workflowId`);
    }

    const input = resolveInputMapping(step.inputMapping || config.input, context);
    const dbWorkflow = await prisma.workflow.findFirst({
        where: {
            OR: [{ id: config.workflowId }, { slug: config.workflowId }]
        }
    });

    if (dbWorkflow?.definitionJson) {
        return executeWorkflowDefinition({
            definition: dbWorkflow.definitionJson as unknown as WorkflowDefinition,
            input,
            resume,
            requestContext,
            depth: depth + 1
        });
    }

    const workflow = mastra.getWorkflow(config.workflowId);
    if (!workflow) {
        throw new Error(`Workflow "${config.workflowId}" not found`);
    }

    const run = await workflow.createRun();
    const result = (await run.start({ inputData: input })) as {
        status: "success" | "failed";
        result?: unknown;
        error?: Error;
    };
    if (result.status === "success") {
        return {
            status: "success",
            output: result.result,
            steps: []
        };
    }

    return {
        status: "failed",
        output: result.error,
        steps: [],
        error: result.error?.message || "Workflow execution failed"
    };
}

async function executeSteps(
    steps: WorkflowStep[],
    context: WorkflowExecutionContext,
    options: ExecuteWorkflowOptions
): Promise<WorkflowExecutionResult> {
    const executionSteps: WorkflowExecutionStep[] = [];
    const skipSteps = new Set(Object.keys(options.existingSteps || {}));

    for (const step of steps) {
        if (skipSteps.has(step.id)) {
            continue;
        }

        const startedAt = new Date();
        const stepInput = resolveInputMapping(step.inputMapping, context);

        try {
            let output: unknown;
            let status: WorkflowExecutionResult["status"] = "success";
            let suspended: WorkflowExecutionResult["suspended"] | undefined;

            switch (step.type) {
                case "agent":
                    output = await executeAgentStep(step, context, options.requestContext);
                    break;
                case "tool":
                    output = await executeToolStep(step, context, options.requestContext);
                    break;
                case "workflow": {
                    const result = await executeWorkflowStep(
                        step,
                        context,
                        options.resume,
                        options.requestContext,
                        options.depth
                    );
                    status = result.status;
                    output = result.output;
                    executionSteps.push(...result.steps);
                    suspended = result.suspended;
                    break;
                }
                case "branch": {
                    const config = (step.config || {}) as {
                        branches?: WorkflowBranchConfig[];
                        defaultBranch?: WorkflowStep[];
                    };
                    const branches = config.branches || [];
                    const selected = branches.find((branch) =>
                        evaluateCondition(branch.condition, context)
                    );
                    const branchSteps = selected?.steps || config.defaultBranch || [];
                    const branchResult = await executeSteps(branchSteps, context, {
                        ...options,
                        existingSteps: options.existingSteps
                    });
                    status = branchResult.status;
                    output = {
                        branchId: selected?.id,
                        result: branchResult.output
                    };
                    executionSteps.push(...branchResult.steps);
                    suspended = branchResult.suspended;
                    break;
                }
                case "parallel": {
                    const config = (step.config || {}) as { branches?: WorkflowParallelConfig[] };
                    const branches = config.branches || [];
                    const branchResults = await Promise.all(
                        branches.map((branch) =>
                            executeSteps(
                                branch.steps || [],
                                {
                                    ...context,
                                    steps: { ...context.steps },
                                    variables: { ...context.variables }
                                },
                                {
                                    ...options,
                                    existingSteps: options.existingSteps
                                }
                            )
                        )
                    );
                    const failedBranch = branchResults.find((result) => result.status === "failed");
                    const suspendedBranch = branchResults.find(
                        (result) => result.status === "suspended"
                    );
                    if (failedBranch) {
                        status = "failed";
                        output = failedBranch.output;
                    } else if (suspendedBranch) {
                        status = "suspended";
                        output = suspendedBranch.output;
                        suspended = suspendedBranch.suspended;
                    } else {
                        output = branchResults.map((result) => result.output);
                    }
                    branchResults.forEach((result) => {
                        executionSteps.push(...result.steps);
                    });
                    break;
                }
                case "foreach": {
                    const config = (step.config || {}) as unknown as WorkflowForeachConfig;
                    const collection = getValueAtPath(context, config.collectionPath);
                    if (!Array.isArray(collection)) {
                        throw new Error(`Foreach step "${step.id}" collection is not an array`);
                    }
                    const itemVar = config.itemVar || "item";
                    const concurrency = config.concurrency || 1;
                    const results: WorkflowExecutionResult[] = [];

                    const runWithConcurrency = async () => {
                        const queue = [...collection.entries()];
                        const workers = Array.from({ length: concurrency }).map(async () => {
                            while (queue.length > 0) {
                                const [index, item] = queue.shift()!;
                                const iterationContext: WorkflowExecutionContext = {
                                    ...context,
                                    variables: {
                                        ...context.variables,
                                        [itemVar]: item,
                                        index
                                    },
                                    steps: { ...context.steps }
                                };
                                const result = await executeSteps(
                                    config.steps || [],
                                    iterationContext,
                                    {
                                        ...options,
                                        existingSteps: options.existingSteps
                                    }
                                );
                                result.steps.forEach((stepResult) => {
                                    stepResult.iterationIndex = index;
                                });
                                results.push(result);
                            }
                        });
                        await Promise.all(workers);
                    };

                    await runWithConcurrency();

                    const failed = results.find((result) => result.status === "failed");
                    const suspendedResult = results.find((result) => result.status === "suspended");
                    if (failed) {
                        status = "failed";
                        output = failed.output;
                    } else if (suspendedResult) {
                        status = "suspended";
                        output = suspendedResult.output;
                        suspended = suspendedResult.suspended;
                    } else {
                        output = results.map((result) => result.output);
                    }

                    results.forEach((result) => executionSteps.push(...result.steps));
                    break;
                }
                case "human": {
                    const config = (step.config || {}) as WorkflowHumanConfig;
                    if (options.resume?.stepId === step.id) {
                        output = options.resume.data;
                    } else {
                        status = "suspended";
                        suspended = {
                            stepId: step.id,
                            data: {
                                prompt: config.prompt || step.name || "Human approval required",
                                formSchema: config.formSchema || {},
                                timeout: config.timeout
                            }
                        };
                    }
                    break;
                }
                case "delay": {
                    const delayMs =
                        typeof step.config?.delayMs === "number" ? step.config.delayMs : 0;
                    if (delayMs > 0) {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                    }
                    output = { delayedMs: delayMs };
                    break;
                }
                case "transform":
                default:
                    output = stepInput;
            }

            const completedAt = new Date();
            const durationMs = completedAt.getTime() - startedAt.getTime();
            const stepResult: WorkflowExecutionStep = {
                stepId: step.id,
                stepType: step.type,
                stepName: step.name,
                status: status === "suspended" ? "suspended" : "completed",
                input: stepInput,
                output,
                startedAt,
                completedAt,
                durationMs
            };
            executionSteps.push(stepResult);
            context.steps[step.id] = output;

            if (options.onStepEvent) {
                options.onStepEvent(stepResult);
            }

            if (status === "suspended") {
                return {
                    status: "suspended",
                    output,
                    steps: executionSteps,
                    suspended
                };
            }
        } catch (error) {
            const completedAt = new Date();
            const durationMs = completedAt.getTime() - startedAt.getTime();
            const stepResult: WorkflowExecutionStep = {
                stepId: step.id,
                stepType: step.type,
                stepName: step.name,
                status: "failed",
                input: stepInput,
                error: error instanceof Error ? error.message : error,
                startedAt,
                completedAt,
                durationMs
            };
            executionSteps.push(stepResult);
            if (options.onStepEvent) {
                options.onStepEvent(stepResult);
            }
            return {
                status: "failed",
                output: stepResult.error,
                steps: executionSteps,
                error: stepResult.error as string
            };
        }
    }

    const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
    return {
        status: "success",
        output,
        steps: executionSteps
    };
}

export async function executeWorkflowDefinition(
    options: ExecuteWorkflowOptions
): Promise<WorkflowExecutionResult> {
    const depth = options.depth ?? 0;
    if (depth > MAX_NESTING_DEPTH) {
        return {
            status: "failed",
            output: null,
            steps: [],
            error: "Maximum workflow nesting depth exceeded"
        };
    }

    const context: WorkflowExecutionContext = {
        input: options.input,
        steps: options.existingSteps ? { ...options.existingSteps } : {},
        variables: {}
    };

    return executeSteps(options.definition.steps || [], context, options);
}
