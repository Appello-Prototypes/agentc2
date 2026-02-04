const VALID_STEP_TYPES = [
    "agent",
    "tool",
    "workflow",
    "branch",
    "parallel",
    "foreach",
    "human",
    "transform",
    "delay"
];

export function validateWorkflowDefinition(definition: unknown) {
    const errors: string[] = [];

    if (!definition || typeof definition !== "object") {
        return { valid: false, errors: ["Definition must be an object"] };
    }

    const steps = (definition as { steps?: unknown }).steps;
    if (!Array.isArray(steps)) {
        return { valid: false, errors: ["Definition must include a steps array"] };
    }

    const ids = new Set<string>();
    steps.forEach((step, index) => {
        if (!step || typeof step !== "object") {
            errors.push(`Step ${index + 1} must be an object`);
            return;
        }
        const stepData = step as {
            id?: string;
            type?: string;
            config?: Record<string, unknown>;
        };

        if (!stepData.id || typeof stepData.id !== "string") {
            errors.push(`Step ${index + 1} is missing a valid id`);
        } else if (ids.has(stepData.id)) {
            errors.push(`Duplicate step id: ${stepData.id}`);
        } else {
            ids.add(stepData.id);
        }

        if (!stepData.type || !VALID_STEP_TYPES.includes(stepData.type)) {
            errors.push(`Step ${stepData.id || index + 1} has invalid type`);
        }

        const config = stepData.config || {};
        if (stepData.type === "agent" && !config.agentSlug) {
            errors.push(`Agent step '${stepData.id}' requires config.agentSlug`);
        }
        if (stepData.type === "agent" && !config.promptTemplate) {
            errors.push(`Agent step '${stepData.id}' requires config.promptTemplate`);
        }
        if (stepData.type === "tool" && !config.toolId) {
            errors.push(`Tool step '${stepData.id}' requires config.toolId`);
        }
        if (stepData.type === "workflow" && !config.workflowId) {
            errors.push(`Workflow step '${stepData.id}' requires config.workflowId`);
        }
        if (stepData.type === "branch") {
            const branches = config.branches;
            if (!Array.isArray(branches) || branches.length === 0) {
                errors.push(`Branch step '${stepData.id}' requires config.branches`);
            }
        }
        if (stepData.type === "parallel") {
            const branches = config.branches;
            if (!Array.isArray(branches) || branches.length === 0) {
                errors.push(`Parallel step '${stepData.id}' requires config.branches`);
            }
        }
        if (stepData.type === "foreach") {
            if (!config.collectionPath) {
                errors.push(`Foreach step '${stepData.id}' requires config.collectionPath`);
            }
            if (!Array.isArray(config.steps)) {
                errors.push(`Foreach step '${stepData.id}' requires config.steps`);
            }
        }
    });

    return { valid: errors.length === 0, errors };
}
