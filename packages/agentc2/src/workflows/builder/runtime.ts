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
    type WorkflowCallConfig,
    type WorkflowDoWhileConfig,
    type AgentStepHooks
} from "./types";

export interface WorkflowMeta {
    runId?: string;
    workflowSlug?: string;
}

interface ExecuteWorkflowOptions {
    definition: WorkflowDefinition;
    input: unknown;
    resume?: WorkflowResumeInput;
    existingSteps?: Record<string, unknown>;
    onStepEvent?: (event: WorkflowExecutionStep) => void | Promise<void>;
    requestContext?: RequestContext;
    depth?: number;
    workflowMeta?: WorkflowMeta;
    agentStepHooks?: AgentStepHooks;
    _parentIterationIndex?: number;
}

const MAX_NESTING_DEPTH = 5;

/* ---------- Path resolution helpers ---------- */

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

/* ---------- Template helpers & env ---------- */

/** Returns a curated set of safe environment variables for templates. */
function getEnvContext(): Record<string, string> {
    const curated: Record<string, string> = {};
    const safeKeys = [
        "SLACK_DEFAULT_CHANNEL",
        "SLACK_ALERTS_CHANNEL",
        "SLACK_DEFAULT_AGENT_SLUG",
        "NGROK_DOMAIN",
        "NEXT_PUBLIC_APP_URL"
    ];
    for (const key of safeKeys) {
        if (process.env[key]) {
            curated[key] = process.env[key]!;
        }
    }
    // Include any WORKFLOW_ prefixed variables
    for (const [key, val] of Object.entries(process.env)) {
        if (key.startsWith("WORKFLOW_") && val) {
            curated[key] = val;
        }
    }
    return curated;
}

/** Risk level ordering for Dark Factory pipeline decisions. */
const RISK_LEVELS = ["trivial", "low", "medium", "high", "critical"] as const;

/** Returns date/time helper functions available inside templates. */
function getHelpers() {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    return {
        today: () => todayStr,
        now: () => now.toISOString(),
        yesterday: () => {
            const d = new Date(now);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split("T")[0];
        },
        todayStart: () => `${todayStr}T00:00:00.000Z`,
        todayEnd: () => `${todayStr}T23:59:59.999Z`,
        json: (val: unknown) => JSON.stringify(val),
        riskBelow: (...args: unknown[]): unknown => {
            const actual = String(args[0] ?? "");
            const threshold = String(args[1] ?? "");
            const actualIdx = RISK_LEVELS.indexOf(actual as (typeof RISK_LEVELS)[number]);
            const thresholdIdx = RISK_LEVELS.indexOf(threshold as (typeof RISK_LEVELS)[number]);
            if (actualIdx === -1 || thresholdIdx === -1) return false;
            return actualIdx < thresholdIdx;
        }
    };
}

/** Detect if an expression is complex (contains operators, parens, or quotes). */
function isComplexExpression(expr: string): boolean {
    return /[|&?:()'"!+\-*/=<>~%]/.test(expr) || /\bnew\b/.test(expr);
}

/**
 * Evaluate a JS expression with the workflow context in scope.
 * Falls back to path resolution for simple dot-paths.
 */
function evaluateExpression(expr: string, context: WorkflowExecutionContext): unknown {
    const trimmed = expr.trim();

    // Fast path: simple dot-path (no operators) -> direct lookup
    if (!isComplexExpression(trimmed)) {
        return getValueAtPath(context, trimmed);
    }

    // Complex expression: use new Function() (same pattern as evaluateCondition)
    try {
        const env = getEnvContext();
        const helpers = getHelpers();
        const fn = new Function(
            "input",
            "steps",
            "variables",
            "env",
            "helpers",
            "today",
            "now",
            "yesterday",
            "todayStart",
            "todayEnd",
            "json",
            `return (${trimmed});`
        );
        return fn(
            context.input,
            context.steps,
            context.variables,
            env,
            helpers,
            helpers.today,
            helpers.now,
            helpers.yesterday,
            helpers.todayStart,
            helpers.todayEnd,
            helpers.json
        );
    } catch {
        // If expression evaluation fails, try plain path lookup as last resort
        return getValueAtPath(context, trimmed);
    }
}

/* ---------- Template resolution ---------- */

function resolveTemplate(value: string, context: WorkflowExecutionContext): unknown {
    // Exact match: entire string is a single {{ expression }}
    const exactMatch = value.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (exactMatch) {
        return evaluateExpression(exactMatch[1], context);
    }

    // No templates at all
    if (!value.includes("{{")) {
        return value;
    }

    // Inline interpolation: replace each {{ expr }} within a larger string
    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
        const resolved = evaluateExpression(expr, context);
        if (resolved === undefined || resolved === null) {
            // Bug 5 fix: return empty string for unresolved inline templates
            return "";
        }
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
}

/* ---------- MCP result unwrapping ---------- */

/**
 * Detect and unwrap MCP protocol-format results.
 * MCP tools return: { content: [{ type: "text", text: "{JSON}" }] }
 * Native tools return parsed data directly.
 */
function unwrapToolResult(result: unknown): unknown {
    if (
        result &&
        typeof result === "object" &&
        "content" in result &&
        Array.isArray((result as { content: unknown }).content)
    ) {
        const content = (result as { content: Array<{ type?: string; text?: string }> }).content;
        const textEntry = content.find(
            (entry) => entry.type === "text" && typeof entry.text === "string"
        );
        if (textEntry?.text) {
            try {
                return JSON.parse(textEntry.text);
            } catch {
                // Not valid JSON, return the text string itself
                return textEntry.text;
            }
        }
    }
    return result;
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
        const env = getEnvContext();
        const helpers = getHelpers();
        const evaluator = new Function(
            "input",
            "steps",
            "variables",
            "env",
            "helpers",
            `return (${expression});`
        );
        return Boolean(evaluator(context.input, context.steps, context.variables, env, helpers));
    } catch (error) {
        console.warn("[WorkflowRuntime] Condition evaluation failed:", error);
        return false;
    }
}

async function executeAgentStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext,
    hooks?: AgentStepHooks
): Promise<{ output: unknown; agentRunId?: string }> {
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

    let agentRunId: string | undefined;
    const stepStart = Date.now();

    try {
        if (hooks?.onAgentStart) {
            agentRunId = await hooks.onAgentStart({ stepId: step.id, agentSlug, prompt });
        }

        const response = await agent.generate(prompt, {
            maxSteps: config.maxSteps
        });

        const durationMs = Date.now() - stepStart;

        if (hooks?.onAgentComplete) {
            await hooks.onAgentComplete({
                stepId: step.id,
                agentRunId,
                agentSlug,
                output: response.text,
                durationMs,
                modelName: response.response?.modelId,
                totalTokens: response.usage
                    ? (response.usage.totalTokens ?? 0)
                    : undefined,
                costUsd: undefined
            });
        }

        let output: unknown;
        if (config.outputFormat === "json") {
            const text = response.text || "";
            
            // Try to extract JSON from markdown code fences first (```json ... ```)
            const markdownMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            const jsonText = markdownMatch ? markdownMatch[1] : text;
            
            // Now extract the JSON object from the cleaned text
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    output = JSON.parse(jsonMatch[0]);
                } catch {
                    console.warn(`[WorkflowRuntime] Failed to parse JSON from agent step "${step.id}". Raw text:`, text);
                    output = { raw: text };
                }
            } else {
                console.warn(`[WorkflowRuntime] No JSON found in agent step "${step.id}" output. Raw text:`, text);
                output = { raw: text };
            }
        } else {
            output = {
                text: response.text,
                result: response.text,
                toolCalls: response.toolCalls || [],
                _agentSlug: agentSlug
            };
        }

        return { output, agentRunId };
    } catch (error) {
        const durationMs = Date.now() - stepStart;
        if (hooks?.onAgentFail) {
            await hooks.onAgentFail({
                stepId: step.id,
                agentRunId,
                agentSlug,
                error: error instanceof Error ? error : new Error(String(error)),
                durationMs
            });
        }
        throw error;
    }
}

async function executeToolStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext,
    workflowMeta?: WorkflowMeta
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

    if (
        organizationId &&
        typeof input === "object" &&
        input !== null &&
        !("organizationId" in input)
    ) {
        (input as Record<string, unknown>).organizationId = organizationId;
    }

    if (workflowMeta && typeof input === "object" && input !== null) {
        const inp = input as Record<string, unknown>;
        if (!inp.workflowSlug && workflowMeta.workflowSlug)
            inp.workflowSlug = workflowMeta.workflowSlug;
        if (!inp.runId && workflowMeta.runId) inp.runId = workflowMeta.runId;
        if (!inp.stepId) inp.stepId = step.id;
    }

    const handler =
        (tool as { execute?: (args: Record<string, unknown>) => Promise<unknown> }).execute ||
        (tool as { invoke?: (args: Record<string, unknown>) => Promise<unknown> }).invoke ||
        (tool as { run?: (args: Record<string, unknown>) => Promise<unknown> }).run ||
        (tool as (args: Record<string, unknown>) => Promise<unknown>);

    if (typeof handler !== "function") {
        throw new Error(`Tool "${config.toolId}" does not expose an executable handler`);
    }

    const rawResult = await handler(input);
    // Bug 3 fix: unwrap MCP protocol-format results
    return unwrapToolResult(rawResult);
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

            let agentRunId: string | undefined;

            switch (step.type) {
                case "agent": {
                    const agentResult = await executeAgentStep(
                        step,
                        context,
                        options.requestContext,
                        options.agentStepHooks
                    );
                    output = agentResult.output;
                    agentRunId = agentResult.agentRunId;
                    break;
                }
                case "tool":
                    output = await executeToolStep(
                        step,
                        context,
                        options.requestContext,
                        options.workflowMeta
                    );
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
                    
                    // Evaluate branch conditions with debug logging
                    let selected: WorkflowBranchConfig | undefined;
                    for (const branch of branches) {
                        const conditionResult = evaluateCondition(branch.condition, context);
                        console.log(`[WorkflowRuntime] Branch step "${step.id}" evaluating condition "${branch.condition}": ${conditionResult}`);
                        
                        // Log relevant step data for debugging
                        const referencedSteps = branch.condition.match(/steps\['([^']+)'\]/g);
                        if (referencedSteps) {
                            for (const ref of referencedSteps) {
                                const stepId = ref.match(/steps\['([^']+)'\]/)?.[1];
                                if (stepId) {
                                    console.log(`[WorkflowRuntime]   Referenced step '${stepId}' data:`, JSON.stringify(context.steps[stepId], null, 2));
                                }
                            }
                        }
                        
                        if (conditionResult) {
                            selected = branch;
                            break;
                        }
                    }
                    
                    const branchSteps = selected?.steps || config.defaultBranch || [];
                    console.log(`[WorkflowRuntime] Branch step "${step.id}" selected: ${selected ? `"${selected.id}"` : "default branch"}`);
                    
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
                                        existingSteps: options.existingSteps,
                                        _parentIterationIndex: index
                                    }
                                );
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
                case "dowhile": {
                    const dwConfig = (step.config || {}) as unknown as WorkflowDoWhileConfig;
                    const maxIter = dwConfig.maxIterations || 10;
                    let iteration = 0;
                    let iterOutput: unknown = stepInput;

                    do {
                        const iterContext: WorkflowExecutionContext = {
                            ...context,
                            steps: { ...context.steps },
                            variables: {
                                ...context.variables,
                                _dowhileIteration: iteration
                            }
                        };

                        const iterResult = await executeSteps(dwConfig.steps || [], iterContext, {
                            ...options,
                            existingSteps: options.existingSteps,
                            _parentIterationIndex: iteration
                        });

                        executionSteps.push(...iterResult.steps);

                        if (iterResult.status === "suspended") {
                            status = "suspended";
                            suspended = iterResult.suspended;
                            break;
                        }
                        if (iterResult.status === "failed") {
                            status = "failed";
                            output = iterResult.output;
                            break;
                        }

                        iterOutput = iterResult.output;
                        iteration++;
                        context.steps[step.id] = {
                            ...(typeof iterOutput === "object" && iterOutput !== null
                                ? iterOutput
                                : { value: iterOutput }),
                            _iteration: iteration
                        };

                        Object.assign(context.steps, iterContext.steps);
                    } while (
                        iteration < maxIter &&
                        evaluateCondition(dwConfig.conditionExpression, context)
                    );

                    if (status !== "failed" && status !== "suspended") {
                        output = {
                            ...(typeof iterOutput === "object" && iterOutput !== null
                                ? iterOutput
                                : { value: iterOutput }),
                            _totalIterations: iteration
                        };
                    }
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
                durationMs,
                ...(agentRunId ? { agentRunId } : {}),
                ...(options._parentIterationIndex != null
                    ? { iterationIndex: options._parentIterationIndex }
                    : {})
            };
            executionSteps.push(stepResult);
            context.steps[step.id] = output;

            if (options.onStepEvent) {
                await options.onStepEvent(stepResult);
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
                durationMs,
                ...(options._parentIterationIndex != null
                    ? { iterationIndex: options._parentIterationIndex }
                    : {})
            };
            executionSteps.push(stepResult);
            if (options.onStepEvent) {
                await options.onStepEvent(stepResult);
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
        variables: {},
        env: getEnvContext(),
        helpers: getHelpers()
    };

    return executeSteps(options.definition.steps || [], context, options);
}
