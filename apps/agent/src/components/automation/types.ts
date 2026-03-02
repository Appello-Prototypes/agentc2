export type PrimitiveType = "agent" | "workflow" | "network" | "campaign" | "pulse";

export type Frequency = "interval" | "daily" | "weekdays" | "weekly" | "monthly";
export type IntervalUnit = "minutes" | "hours";

export interface ScheduleConfig {
    frequency: Frequency;
    hour: number;
    minute: number;
    ampm: "AM" | "PM";
    daysOfWeek: number[];
    dayOfMonth: number;
    intervalValue?: number;
    intervalUnit?: IntervalUnit;
}

export interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

export interface Automation {
    id: string;
    sourceType: "schedule" | "trigger" | "campaign-schedule" | "campaign-trigger" | "pulse";
    primitiveType?: PrimitiveType;
    type: string;
    name: string;
    description: string | null;
    isActive: boolean;
    isArchived: boolean;
    archivedAt: string | null;
    agent: { id: string; slug: string; name: string } | null;
    entity?: { id: string; slug: string; name: string } | null;
    config: {
        cronExpr?: string;
        timezone?: string;
        eventName?: string | null;
        webhookPath?: string | null;
        color?: string | null;
        task?: string | null;
    };
    stats: {
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
        successRate: number;
        avgDurationMs: number | null;
        totalCostUsd?: number | null;
        avgCostPerRun?: number | null;
        estMonthlyCost?: number | null;
        lastRunAt: string | null;
        nextRunAt: string | null;
    };
    createdAt: string;
}

export interface AutomationSummary {
    total: number;
    active: number;
    archived: number;
    schedules: number;
    triggers: number;
    overallSuccessRate: number;
    needsAttention?: number;
    estimatedMonthlyCost?: number;
}

export interface AutomationFilterState {
    search: string;
    primitiveType: PrimitiveType | "all";
    status: "all" | "active" | "inactive" | "archived";
}

export interface FormState {
    automationType: "schedule" | "trigger";
    agentId: string;
    name: string;
    description: string;
    task: string;
    cronExpr: string;
    timezone: string;
    triggerType: string;
    eventName: string;
    isActive: boolean;
    frequency: Frequency;
    hour: number;
    minute: number;
    ampm: "AM" | "PM";
    daysOfWeek: number[];
    dayOfMonth: number;
    intervalValue: number;
    intervalUnit: IntervalUnit;
    color: string;
    healthPolicyEnabled?: boolean;
    healthThreshold?: number;
    healthWindow?: number;
    healthAction?: string;
}

export interface CalendarEvent {
    date: Date;
    automation: Automation;
}

export type CalendarColorMode = "agent" | "primitive" | "health";
