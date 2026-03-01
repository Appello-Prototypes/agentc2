export type WorkflowStepType =
    | "agent"
    | "tool"
    | "workflow"
    | "branch"
    | "parallel"
    | "foreach"
    | "dowhile"
    | "human"
    | "transform"
    | "delay";

export interface WorkflowDoWhileConfig {
    steps: WorkflowStep[];
    conditionExpression: string;
    maxIterations?: number;
}

export interface WorkflowDefinition {
    steps: WorkflowStep[];
}

export interface WorkflowStep {
    id: string;
    type: WorkflowStepType;
    name?: string;
    description?: string;
    inputMapping?: Record<string, unknown>;
    config?: Record<string, unknown>;
}

export interface WorkflowBranchConfig {
    id?: string;
    condition: string;
    steps: WorkflowStep[];
}

export interface WorkflowParallelConfig {
    id?: string;
    steps: WorkflowStep[];
}

export interface WorkflowForeachConfig {
    collectionPath: string;
    itemVar?: string;
    concurrency?: number;
    steps: WorkflowStep[];
}

export interface WorkflowHumanConfig {
    prompt?: string;
    formSchema?: Record<string, unknown>;
    timeout?: number;
}

export interface WorkflowAgentConfig {
    agentSlug: string;
    promptTemplate: string;
    outputFormat?: "text" | "json";
    outputSchema?: Record<string, unknown>;
    maxSteps?: number;
}

export interface WorkflowToolConfig {
    toolId: string;
    parameters?: Record<string, unknown>;
}

export interface WorkflowCallConfig {
    workflowId: string;
    input?: Record<string, unknown>;
}

export interface WorkflowExecutionStep {
    stepId: string;
    stepType: WorkflowStepType;
    stepName?: string;
    status: "completed" | "failed" | "suspended";
    input?: unknown;
    output?: unknown;
    error?: unknown;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    iterationIndex?: number;
    agentRunId?: string;
}

export interface AgentStepHooks {
    onAgentStart?: (info: {
        stepId: string;
        agentSlug: string;
        prompt: string;
    }) => Promise<string | undefined>;
    onAgentComplete?: (info: {
        stepId: string;
        agentRunId?: string;
        agentSlug: string;
        output: unknown;
        durationMs: number;
        modelName?: string;
        modelProvider?: string;
        totalTokens?: number;
        costUsd?: number;
    }) => Promise<void>;
    onAgentFail?: (info: {
        stepId: string;
        agentRunId?: string;
        agentSlug: string;
        error: Error;
        durationMs: number;
    }) => Promise<void>;
}

export interface WorkflowExecutionResult {
    status: "success" | "failed" | "suspended";
    output?: unknown;
    steps: WorkflowExecutionStep[];
    suspended?: {
        stepId: string;
        data: Record<string, unknown>;
    };
    error?: string;
}

export interface WorkflowExecutionContext {
    input: unknown;
    steps: Record<string, unknown>;
    variables: Record<string, unknown>;
    env?: Record<string, string>;
    helpers?: Record<string, (...args: unknown[]) => unknown>;
}

export interface WorkflowResumeInput {
    stepId: string;
    data: Record<string, unknown>;
}
