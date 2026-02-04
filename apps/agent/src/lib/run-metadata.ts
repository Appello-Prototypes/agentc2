import { RunEnvironment, RunTriggerType } from "@repo/database";

const normalizeValue = (value?: string | null) => value?.trim().toLowerCase() || "";

export function resolveRunEnvironment(
    requested?: string | null,
    workspaceEnvironment?: string | null
): RunEnvironment {
    const normalized = normalizeValue(requested) || normalizeValue(workspaceEnvironment);
    if (["prod", "production", "live"].includes(normalized)) {
        return RunEnvironment.PRODUCTION;
    }
    if (["staging", "stage", "preprod"].includes(normalized)) {
        return RunEnvironment.STAGING;
    }
    return RunEnvironment.DEVELOPMENT;
}

export function parseRunEnvironmentFilter(value?: string | null): RunEnvironment | undefined {
    const normalized = normalizeValue(value);
    if (!normalized) return undefined;
    if (["prod", "production", "live"].includes(normalized)) {
        return RunEnvironment.PRODUCTION;
    }
    if (["staging", "stage", "preprod"].includes(normalized)) {
        return RunEnvironment.STAGING;
    }
    if (["dev", "development"].includes(normalized)) {
        return RunEnvironment.DEVELOPMENT;
    }
    return undefined;
}

export function resolveRunTriggerType(
    requested?: string | null,
    source?: string | null
): RunTriggerType {
    const normalized = normalizeValue(requested) || normalizeValue(source);
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
}

export function parseRunTriggerTypeFilter(value?: string | null): RunTriggerType | undefined {
    const normalized = normalizeValue(value);
    if (!normalized) return undefined;
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
    if (["api"].includes(normalized)) {
        return RunTriggerType.API;
    }
    return undefined;
}
