export type WorkflowStepType =
    | "agent"
    | "tool"
    | "workflow"
    | "branch"
    | "parallel"
    | "foreach"
    | "human"
    | "transform"
    | "delay";

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
}

export interface WorkflowResumeInput {
    stepId: string;
    data: Record<string, unknown>;
}
