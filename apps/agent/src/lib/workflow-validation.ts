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

interface StepData {
    id?: string;
    type?: string;
    config?: Record<string, unknown>;
    inputMapping?: unknown;
    name?: string;
    description?: string;
}

/**
 * Recursively validate a list of workflow steps.
 * Used for both top-level steps and nested steps inside branch/parallel/foreach.
 */
function validateSteps(steps: unknown[], errors: string[], ids: Set<string>, path: string) {
    steps.forEach((step, index) => {
        if (!step || typeof step !== "object") {
            errors.push(`${path} step ${index + 1} must be an object`);
            return;
        }
        const stepData = step as StepData;
        const stepRef = stepData.id || `${path}[${index}]`;

        if (!stepData.id || typeof stepData.id !== "string") {
            errors.push(`${path} step ${index + 1} is missing a valid id`);
        } else if (ids.has(stepData.id)) {
            errors.push(`Duplicate step id: ${stepData.id}`);
        } else {
            ids.add(stepData.id);
        }

        if (!stepData.type || !VALID_STEP_TYPES.includes(stepData.type)) {
            errors.push(`Step '${stepRef}' has invalid type '${stepData.type}'`);
            return; // Can't validate config without knowing the type
        }

        const config = stepData.config || {};

        switch (stepData.type) {
            case "agent": {
                if (!config.agentSlug) {
                    errors.push(`Agent step '${stepRef}' requires config.agentSlug`);
                }
                if (!config.promptTemplate) {
                    errors.push(`Agent step '${stepRef}' requires config.promptTemplate`);
                }
                if (
                    config.maxSteps !== undefined &&
                    (typeof config.maxSteps !== "number" || config.maxSteps < 1)
                ) {
                    errors.push(
                        `Agent step '${stepRef}' config.maxSteps must be a positive number`
                    );
                }
                if (
                    config.outputFormat !== undefined &&
                    config.outputFormat !== "text" &&
                    config.outputFormat !== "json"
                ) {
                    errors.push(
                        `Agent step '${stepRef}' config.outputFormat must be 'text' or 'json'`
                    );
                }
                break;
            }
            case "tool": {
                if (!config.toolId) {
                    errors.push(`Tool step '${stepRef}' requires config.toolId`);
                }
                break;
            }
            case "workflow": {
                if (!config.workflowId) {
                    errors.push(`Workflow step '${stepRef}' requires config.workflowId`);
                }
                break;
            }
            case "branch": {
                const branches = config.branches;
                if (!Array.isArray(branches) || branches.length === 0) {
                    errors.push(`Branch step '${stepRef}' requires config.branches array`);
                } else {
                    // Validate each branch has condition and steps
                    branches.forEach((branch, bIdx) => {
                        const b = branch as {
                            condition?: string;
                            steps?: unknown[];
                            id?: string;
                        };
                        const branchRef = b.id || `branch[${bIdx}]`;
                        if (!b.condition || typeof b.condition !== "string") {
                            errors.push(
                                `Branch step '${stepRef}' ${branchRef} requires a condition string`
                            );
                        }
                        if (!Array.isArray(b.steps)) {
                            errors.push(
                                `Branch step '${stepRef}' ${branchRef} requires a steps array`
                            );
                        } else {
                            validateSteps(b.steps, errors, ids, `${stepRef}.${branchRef}`);
                        }
                    });
                }
                // defaultBranch is optional but if present, must be an array of steps
                if (config.defaultBranch !== undefined && !Array.isArray(config.defaultBranch)) {
                    errors.push(
                        `Branch step '${stepRef}' config.defaultBranch must be a steps array`
                    );
                } else if (Array.isArray(config.defaultBranch)) {
                    validateSteps(
                        config.defaultBranch as unknown[],
                        errors,
                        ids,
                        `${stepRef}.defaultBranch`
                    );
                }
                break;
            }
            case "parallel": {
                const branches = config.branches;
                if (!Array.isArray(branches) || branches.length === 0) {
                    errors.push(`Parallel step '${stepRef}' requires config.branches array`);
                } else {
                    branches.forEach((branch, bIdx) => {
                        const b = branch as { steps?: unknown[]; id?: string };
                        const branchRef = b.id || `branch[${bIdx}]`;
                        if (!Array.isArray(b.steps)) {
                            errors.push(
                                `Parallel step '${stepRef}' ${branchRef} requires a steps array`
                            );
                        } else {
                            validateSteps(b.steps, errors, ids, `${stepRef}.${branchRef}`);
                        }
                    });
                }
                break;
            }
            case "foreach": {
                if (!config.collectionPath || typeof config.collectionPath !== "string") {
                    errors.push(`Foreach step '${stepRef}' requires config.collectionPath string`);
                }
                if (!Array.isArray(config.steps)) {
                    errors.push(`Foreach step '${stepRef}' requires config.steps array`);
                } else {
                    validateSteps(config.steps as unknown[], errors, ids, `${stepRef}.foreach`);
                }
                if (
                    config.concurrency !== undefined &&
                    (typeof config.concurrency !== "number" || config.concurrency < 1)
                ) {
                    errors.push(
                        `Foreach step '${stepRef}' config.concurrency must be a positive number`
                    );
                }
                break;
            }
            case "human": {
                // Human steps are valid with optional config
                break;
            }
            case "delay": {
                if (
                    config.delayMs !== undefined &&
                    (typeof config.delayMs !== "number" || config.delayMs < 0)
                ) {
                    errors.push(
                        `Delay step '${stepRef}' config.delayMs must be a non-negative number`
                    );
                }
                break;
            }
            // transform, default: no required config
        }
    });
}

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
    validateSteps(steps, errors, ids, "");

    return { valid: errors.length === 0, errors };
}
