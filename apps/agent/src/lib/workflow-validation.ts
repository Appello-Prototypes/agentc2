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

function validateLayout(layout: unknown, stepIds: Set<string>, errors: string[]) {
    if (!layout || typeof layout !== "object") return;
    const l = layout as {
        nodes?: unknown[];
        edges?: unknown[];
        viewport?: unknown;
    };

    if (l.nodes !== undefined && !Array.isArray(l.nodes)) {
        errors.push("layout.nodes must be an array");
    } else if (Array.isArray(l.nodes)) {
        l.nodes.forEach((node, index) => {
            if (!node || typeof node !== "object") {
                errors.push(`layout.nodes[${index}] must be an object`);
                return;
            }
            const n = node as { id?: string; position?: unknown };
            if (!n.id || typeof n.id !== "string") {
                errors.push(`layout.nodes[${index}] requires a string id`);
            }
            if (n.position && typeof n.position === "object") {
                const pos = n.position as { x?: unknown; y?: unknown };
                if (typeof pos.x !== "number" || typeof pos.y !== "number") {
                    errors.push(`layout.nodes[${index}].position requires numeric x and y`);
                }
            }
        });
    }

    if (l.edges !== undefined && !Array.isArray(l.edges)) {
        errors.push("layout.edges must be an array");
    } else if (Array.isArray(l.edges)) {
        l.edges.forEach((edge, index) => {
            if (!edge || typeof edge !== "object") {
                errors.push(`layout.edges[${index}] must be an object`);
                return;
            }
            const e = edge as { id?: string; source?: string; target?: string };
            if (!e.id || typeof e.id !== "string") {
                errors.push(`layout.edges[${index}] requires a string id`);
            }
            if (!e.source || typeof e.source !== "string") {
                errors.push(`layout.edges[${index}] requires a string source`);
            }
            if (!e.target || typeof e.target !== "string") {
                errors.push(`layout.edges[${index}] requires a string target`);
            }
        });
    }

    if (l.viewport !== undefined && l.viewport !== null) {
        if (typeof l.viewport !== "object") {
            errors.push("layout.viewport must be an object");
        } else {
            const v = l.viewport as { x?: unknown; y?: unknown; zoom?: unknown };
            if (typeof v.x !== "number" || typeof v.y !== "number") {
                errors.push("layout.viewport requires numeric x and y");
            }
            if (v.zoom !== undefined && typeof v.zoom !== "number") {
                errors.push("layout.viewport.zoom must be a number");
            }
        }
    }
}

export function validateWorkflowDefinition(definition: unknown) {
    const errors: string[] = [];

    if (!definition || typeof definition !== "object") {
        return { valid: false, errors: ["Definition must be an object"] };
    }

    const def = definition as { steps?: unknown; layout?: unknown };

    const steps = def.steps;
    if (!Array.isArray(steps)) {
        return { valid: false, errors: ["Definition must include a steps array"] };
    }

    const ids = new Set<string>();
    validateSteps(steps, errors, ids, "");

    if (def.layout !== undefined) {
        validateLayout(def.layout, ids, errors);
    }

    return { valid: errors.length === 0, errors };
}
