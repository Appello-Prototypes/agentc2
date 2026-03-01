import type { WorkflowDefinition, WorkflowStep } from "./types";

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateWorkflowDefinition(definition: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    function validateStep(step: WorkflowStep, path: string) {
        if (step.type === "agent" && step.config?.outputFormat === "json") {
            if (!step.config?.outputSchema) {
                warnings.push(
                    `${path}: Agent step "${step.id}" has outputFormat: "json" but no outputSchema. Consider adding schema validation.`
                );
            }
        }

        if (step.type === "branch" && step.config?.branches && Array.isArray(step.config.branches)) {
            for (const branch of step.config.branches as Array<{
                id?: string;
                condition: string;
                steps?: WorkflowStep[];
            }>) {
                const condition = branch.condition;
                const fieldRefs = condition.match(/steps\['([^']+)'\]\?\.(\w+)/g);
                if (fieldRefs) {
                    for (const ref of fieldRefs) {
                        const match = ref.match(/steps\['([^']+)'\]\?\.(\w+)/);
                        if (match) {
                            const [, stepId, field] = match;
                            warnings.push(
                                `${path}: Branch condition references ${stepId}.${field} but no schema validation ensures this field exists.`
                            );
                        }
                    }
                }
            }
        }

        if (step.config?.steps && Array.isArray(step.config.steps)) {
            for (const nested of step.config.steps) {
                validateStep(nested as WorkflowStep, `${path}.${step.id}`);
            }
        }

        if (step.config?.branches && Array.isArray(step.config.branches)) {
            for (const branch of step.config.branches as Array<{
                id?: string;
                condition?: string;
                steps?: unknown[];
            }>) {
                if (branch.steps && Array.isArray(branch.steps)) {
                    for (const nested of branch.steps) {
                        validateStep(nested as WorkflowStep, `${path}.${step.id}.${branch.id}`);
                    }
                }
            }
        }

        if (step.config?.defaultBranch && Array.isArray(step.config.defaultBranch)) {
            for (const nested of step.config.defaultBranch) {
                validateStep(nested as WorkflowStep, `${path}.${step.id}.default`);
            }
        }
    }

    for (const step of definition.steps || []) {
        validateStep(step, "root");
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
