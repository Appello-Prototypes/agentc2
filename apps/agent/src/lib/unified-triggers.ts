import { RunTriggerType } from "@repo/database";
import type { RunSource } from "./run-recorder";

export const UNIFIED_TRIGGER_TYPES = [
    "scheduled",
    "webhook",
    "event",
    "mcp",
    "api",
    "manual",
    "test"
] as const;

export type UnifiedTriggerType = (typeof UNIFIED_TRIGGER_TYPES)[number];
export type UnifiedTriggerSource = "schedule" | "trigger";

export type UnifiedTriggerId = `${UnifiedTriggerSource}:${string}`;

export type TriggerInputDefaults = {
    input?: string;
    context?: Record<string, unknown>;
    maxSteps?: number;
    environment?: string | null;
};

export type TriggerMappingConfig = {
    environment?: string | null;
    defaults?: TriggerInputDefaults;
    fieldMapping?: Record<string, string>;
    workflowRouting?: Record<string, string>;
};

export type TriggerInputMapping = {
    template?: string;
    field?: string;
    jsonPath?: string;
    config?: TriggerMappingConfig;
};

export type UnifiedTriggerConfig = {
    cronExpr?: string;
    timezone?: string;
    eventName?: string | null;
    webhookPath?: string | null;
    hasWebhookSecret?: boolean;
    toolName?: string;
    apiEndpoint?: string;
    environment?: string | null;
};

export type UnifiedTriggerStats = {
    lastRunAt?: Date | string | null;
    nextRunAt?: Date | string | null;
    runCount?: number;
    triggerCount?: number;
};

export type UnifiedTriggerRunSummary = {
    id: string;
    status: string;
    startedAt: Date | string;
    completedAt: Date | string | null;
    durationMs: number | null;
};

export type UnifiedTrigger = {
    id: UnifiedTriggerId;
    sourceId: string;
    sourceType: UnifiedTriggerSource;
    type: UnifiedTriggerType;
    name: string;
    description: string | null;
    isActive: boolean;
    isArchived?: boolean;
    archivedAt?: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    config: UnifiedTriggerConfig;
    inputDefaults?: TriggerInputDefaults | null;
    filter?: Record<string, unknown> | null;
    inputMapping?: TriggerInputMapping | null;
    stats?: UnifiedTriggerStats;
    lastRun?: UnifiedTriggerRunSummary | null;
};

export function buildUnifiedTriggerId(source: UnifiedTriggerSource, id: string): UnifiedTriggerId {
    return `${source}:${id}`;
}

export function parseUnifiedTriggerId(
    value: string
): { source: UnifiedTriggerSource; id: string } | null {
    const [source, ...rest] = value.split(":");
    if (source !== "schedule" && source !== "trigger") return null;
    const id = rest.join(":");
    if (!id) return null;
    return { source, id };
}

export function extractScheduleDefaults(inputJson: unknown): TriggerInputDefaults | null {
    if (!inputJson || typeof inputJson !== "object" || Array.isArray(inputJson)) {
        return null;
    }
    const payload = inputJson as Record<string, unknown>;
    const defaults: TriggerInputDefaults = {};

    if (typeof payload.input === "string") {
        defaults.input = payload.input;
    }

    if (payload.context && typeof payload.context === "object" && !Array.isArray(payload.context)) {
        defaults.context = payload.context as Record<string, unknown>;
    }

    if (typeof payload.maxSteps === "number") {
        defaults.maxSteps = payload.maxSteps;
    }

    if (typeof payload.environment === "string") {
        defaults.environment = payload.environment;
    }

    return Object.keys(defaults).length > 0 ? defaults : null;
}

export function extractTriggerInputMapping(inputMapping: unknown): TriggerInputMapping | null {
    if (!inputMapping || typeof inputMapping !== "object" || Array.isArray(inputMapping)) {
        return null;
    }
    return inputMapping as TriggerInputMapping;
}

export function extractTriggerConfig(
    inputMapping: TriggerInputMapping | null
): TriggerMappingConfig | null {
    if (!inputMapping?.config || typeof inputMapping.config !== "object") {
        return null;
    }
    return inputMapping.config;
}

export function mergeTriggerInputMapping(
    inputMapping: TriggerInputMapping | null,
    config: TriggerMappingConfig | null,
    options?: { setDefaultField?: boolean }
): TriggerInputMapping | null {
    if (!inputMapping && !config) {
        return null;
    }

    const merged: TriggerInputMapping = inputMapping ? { ...inputMapping } : {};
    if (config) {
        merged.config = {
            ...(typeof merged.config === "object" ? merged.config : {}),
            ...config
        };
    }

    const hasMappingKey = Boolean(merged.template || merged.field || merged.jsonPath);

    if (!hasMappingKey && options?.setDefaultField) {
        merged.field = "input";
    }

    return merged;
}

export function validateTriggerInputMapping(inputMapping: TriggerInputMapping | null): {
    valid: boolean;
    error?: string;
} {
    if (!inputMapping) {
        return { valid: true };
    }

    const allowedKeys = ["template", "field", "jsonPath", "config"];
    const keys = Object.keys(inputMapping);
    const hasAllowed = keys.some((key) => allowedKeys.includes(key));
    const hasDisallowed = keys.some((key) => !allowedKeys.includes(key));

    if (!hasAllowed || hasDisallowed) {
        return {
            valid: false,
            error: "inputMapping must include template, field, jsonPath, or config"
        };
    }

    return { valid: true };
}

export function resolveRunTriggerType(triggerType: string): RunTriggerType {
    switch (triggerType) {
        case "scheduled":
            return RunTriggerType.SCHEDULED;
        case "webhook":
            return RunTriggerType.WEBHOOK;
        case "mcp":
            return RunTriggerType.TOOL;
        case "manual":
            return RunTriggerType.MANUAL;
        case "test":
            return RunTriggerType.TEST;
        case "api":
        case "event":
        default:
            return RunTriggerType.API;
    }
}

export function resolveRunSource(triggerType: string): RunSource {
    switch (triggerType) {
        case "scheduled":
            return "schedule";
        case "webhook":
            return "webhook";
        case "mcp":
            return "mcp";
        case "manual":
            return "manual";
        case "test":
            return "test";
        case "event":
            return "event";
        case "api":
        default:
            return "api";
    }
}

/**
 * Resolve template variables in schedule input strings.
 *
 * Supported variables (resolved at trigger time):
 *   {{ date }}       — e.g. "February 17, 2026"
 *   {{ isoDate }}    — e.g. "2026-02-17"
 *   {{ dayOfWeek }}  — e.g. "Monday"
 *   {{ isMonday }}   — "true" or "false"
 *   {{ time }}       — e.g. "06:00"
 *   {{ timezone }}   — e.g. "America/Toronto"
 *   {{ weekNumber }} — ISO week number, e.g. "8"
 */
export function resolveScheduleTemplates(input: string, timezone: string): string {
    if (!input.includes("{{")) return input;

    const now = new Date();

    const formatter = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timezone }).format(now);

    const dayOfWeek = formatter({ weekday: "long" });
    const date = formatter({ year: "numeric", month: "long", day: "numeric" });
    const time = formatter({ hour: "2-digit", minute: "2-digit", hour12: false });

    // ISO date in the target timezone
    const yearStr = formatter({ year: "numeric" });
    const monthStr = new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        timeZone: timezone
    }).format(now);
    const dayStr = new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        timeZone: timezone
    }).format(now);
    const isoDate = `${yearStr}-${monthStr}-${dayStr}`;

    // ISO week number
    const localDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const jan1 = new Date(localDate.getFullYear(), 0, 1);
    const daysSinceJan1 = Math.floor((localDate.getTime() - jan1.getTime()) / 86400000);
    const weekNumber = Math.ceil((daysSinceJan1 + jan1.getDay() + 1) / 7);

    const isMonday = dayOfWeek === "Monday" ? "true" : "false";

    const vars: Record<string, string> = {
        date,
        isoDate,
        dayOfWeek,
        isMonday,
        time,
        timezone,
        weekNumber: String(weekNumber)
    };

    return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
        return vars[key] ?? match;
    });
}
