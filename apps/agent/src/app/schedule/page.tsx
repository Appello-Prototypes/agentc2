"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    HugeiconsIcon,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    icons
} from "@repo/ui";
import {
    Archive01Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    Delete02Icon,
    Add01Icon,
    ArrowReloadHorizontalIcon
} from "@hugeicons/core-free-icons";
import { getApiBase } from "@/lib/utils";
import { useTimezone } from "@/components/TimezoneProvider";
import { SidekickSidebar } from "@/components/SidekickSidebar";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

interface Automation {
    id: string;
    sourceType: "schedule" | "trigger";
    type: string;
    name: string;
    description: string | null;
    isActive: boolean;
    isArchived: boolean;
    archivedAt: string | null;
    agent: { id: string; slug: string; name: string } | null;
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
        lastRunAt: string | null;
        nextRunAt: string | null;
    };
    lastRun: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
    createdAt: string;
}

interface AutomationSummary {
    total: number;
    active: number;
    archived: number;
    schedules: number;
    triggers: number;
    overallSuccessRate: number;
}

interface FormState {
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
    // Wizard fields
    frequency: Frequency;
    hour: number;
    minute: number;
    ampm: "AM" | "PM";
    daysOfWeek: number[];
    dayOfMonth: number;
    intervalValue: number;
    intervalUnit: IntervalUnit;
    color: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function formatRelativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 0) {
        const absDiffMins = Math.abs(Math.floor(diffMs / 60000));
        const absDiffHours = Math.floor(absDiffMins / 60);
        if (absDiffMins < 60) return `in ${absDiffMins}m`;
        if (absDiffHours < 24) return `in ${absDiffHours}h`;
        return `in ${Math.floor(absDiffHours / 24)}d`;
    }
    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getTypeBadgeColor(type: string): string {
    switch (type) {
        case "scheduled":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        case "event":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        case "webhook":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        case "slack_listener":
            return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
        case "mcp":
            return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
}

function getTypeLabel(type: string): string {
    switch (type) {
        case "scheduled":
            return "Schedule";
        case "event":
            return "Event";
        case "webhook":
            return "Webhook";
        case "slack_listener":
            return "Slack";
        case "mcp":
            return "MCP";
        default:
            return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
}

function getSuccessRateColor(rate: number): string {
    if (rate >= 95) return "text-green-600 dark:text-green-400";
    if (rate >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

const AGENT_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-orange-500"
];

function getAgentColor(agentId: string, allIds: string[]): string {
    const index = allIds.indexOf(agentId);
    return AGENT_COLORS[index % AGENT_COLORS.length]!;
}

function getEventColor(automation: Automation, allAgentIds: string[]): string {
    const customColor = getColorClass(automation.config.color);
    if (customColor) return customColor;
    if (automation.agent) return getAgentColor(automation.agent.id, allAgentIds);
    return "bg-gray-400";
}

function parseAutomationId(
    compositeId: string
): { sourceType: "schedule" | "trigger"; rawId: string } | null {
    if (compositeId.startsWith("schedule:")) {
        return { sourceType: "schedule", rawId: compositeId.slice("schedule:".length) };
    }
    if (compositeId.startsWith("trigger:")) {
        return { sourceType: "trigger", rawId: compositeId.slice("trigger:".length) };
    }
    return null;
}

const COMMON_TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "America/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Rome",
    "Europe/Madrid",
    "Europe/Amsterdam",
    "Europe/Stockholm",
    "Europe/Moscow",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Pacific/Auckland"
];

// ═══════════════════════════════════════════════════════════════════════════════
// Schedule Helpers — human-friendly cron conversion
// ═══════════════════════════════════════════════════════════════════════════════

type Frequency = "interval" | "daily" | "weekdays" | "weekly" | "monthly";
type IntervalUnit = "minutes" | "hours";

interface ScheduleConfig {
    frequency: Frequency;
    hour: number;
    minute: number;
    ampm: "AM" | "PM";
    daysOfWeek: number[];
    dayOfMonth: number;
    intervalValue?: number;
    intervalUnit?: IntervalUnit;
}

const AUTOMATION_COLORS: { name: string; class: string }[] = [
    { name: "blue", class: "bg-blue-500" },
    { name: "emerald", class: "bg-emerald-500" },
    { name: "purple", class: "bg-purple-500" },
    { name: "amber", class: "bg-amber-500" },
    { name: "rose", class: "bg-rose-500" },
    { name: "cyan", class: "bg-cyan-500" },
    { name: "indigo", class: "bg-indigo-500" },
    { name: "orange", class: "bg-orange-500" }
];

function getColorClass(name: string | null | undefined): string | null {
    if (!name) return null;
    const found = AUTOMATION_COLORS.find((c) => c.name === name);
    return found?.class ?? null;
}

function to24Hour(hour: number, ampm: "AM" | "PM"): number {
    if (ampm === "AM") return hour === 12 ? 0 : hour;
    return hour === 12 ? 12 : hour + 12;
}

function buildCronFromSchedule(config: ScheduleConfig): string {
    if (config.frequency === "interval") {
        const val = config.intervalValue || 15;
        const unit = config.intervalUnit || "minutes";
        const startH = to24Hour(config.hour, config.ampm);
        const startM = config.minute;
        if (unit === "hours") return `${startM} ${startH}/${val} * * *`;
        return `*/${val} * * * *`;
    }

    const h = to24Hour(config.hour, config.ampm);
    const m = config.minute;

    switch (config.frequency) {
        case "daily":
            return `${m} ${h} * * *`;
        case "weekdays":
            return `${m} ${h} * * 1-5`;
        case "weekly": {
            const days = config.daysOfWeek.length > 0 ? config.daysOfWeek.join(",") : "1";
            return `${m} ${h} * * ${days}`;
        }
        case "monthly":
            return `${m} ${h} ${config.dayOfMonth} * *`;
        default:
            return `${m} ${h} * * *`;
    }
}

function parseCronToSchedule(cron: string): ScheduleConfig | null {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const [minutePart, hourPart, domPart, , dowPart] = parts;

    const minuteStep = minutePart?.match(/^\*\/(\d+)$/);
    const hourStep = hourPart?.match(/^(?:(\d+)|\*)\/(\d+)$/);

    if (minuteStep) {
        return {
            frequency: "interval",
            hour: 9,
            minute: 0,
            ampm: "AM",
            daysOfWeek: [],
            dayOfMonth: 1,
            intervalValue: parseInt(minuteStep[1]!, 10),
            intervalUnit: "minutes"
        };
    }
    if (hourStep) {
        const startH24 = hourStep[1] != null ? parseInt(hourStep[1], 10) : 0;
        const startM = minutePart === "*" ? 0 : parseInt(minutePart!, 10) || 0;
        const startAmpm: "AM" | "PM" = startH24 >= 12 ? "PM" : "AM";
        const startHour = startH24 === 0 ? 12 : startH24 > 12 ? startH24 - 12 : startH24;
        return {
            frequency: "interval",
            hour: startHour,
            minute: startM,
            ampm: startAmpm,
            daysOfWeek: [],
            dayOfMonth: 1,
            intervalValue: parseInt(hourStep[2]!, 10),
            intervalUnit: "hours"
        };
    }

    const minute = parseInt(minutePart!, 10);
    const hour24 = parseInt(hourPart!, 10);
    if (isNaN(minute) || isNaN(hour24)) return null;

    const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
    const hour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;

    if (domPart !== "*") {
        const dom = parseInt(domPart!, 10);
        return {
            frequency: "monthly",
            hour,
            minute,
            ampm,
            daysOfWeek: [],
            dayOfMonth: isNaN(dom) ? 1 : dom
        };
    }

    if (dowPart === "*") {
        return { frequency: "daily", hour, minute, ampm, daysOfWeek: [], dayOfMonth: 1 };
    }

    if (dowPart === "1-5") {
        return { frequency: "weekdays", hour, minute, ampm, daysOfWeek: [], dayOfMonth: 1 };
    }

    const dowValues = dowPart!
        .split(",")
        .map((v) => parseInt(v, 10))
        .filter((v) => !isNaN(v));
    return { frequency: "weekly", hour, minute, ampm, daysOfWeek: dowValues, dayOfMonth: 1 };
}

function describeScheduleFromCron(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return cron;

    const [minutePart, hourPart, domPart, , dowPart] = parts;

    // Detect interval patterns
    const minuteStep = minutePart?.match(/^\*\/(\d+)$/);
    const hourStep = hourPart?.match(/^\*\/(\d+)$/);

    if (minuteStep) {
        const val = parseInt(minuteStep[1]!, 10);
        return val === 1 ? "Every minute" : `Every ${val} minutes`;
    }
    if (hourStep) {
        const val = parseInt(hourStep[1]!, 10);
        const startMinute = minutePart === "*" ? 0 : parseInt(minutePart!, 10);
        const startHourMatch = hourPart?.match(/^(\d+)\/\d+$/);
        const startHour = startHourMatch ? parseInt(startHourMatch[1]!, 10) : -1;
        const label = val === 1 ? "Every hour" : `Every ${val} hours`;
        if (startHour >= 0) {
            const ampm = startHour >= 12 ? "PM" : "AM";
            const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
            return `${label} starting at ${displayHour}:${String(startMinute).padStart(2, "0")} ${ampm}`;
        }
        return label;
    }

    const minute = minutePart === "*" ? 0 : parseInt(minutePart!, 10);
    const hour = hourPart === "*" ? -1 : parseInt(hourPart!, 10);

    const formatTime = (h: number, m: number) => {
        if (h < 0) return "every hour";
        const ampm = h >= 12 ? "PM" : "AM";
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const timeStr = formatTime(hour, minute);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (domPart !== "*") {
        const day = parseInt(domPart!, 10);
        const suffix =
            day === 1 || day === 21 || day === 31
                ? "st"
                : day === 2 || day === 22
                  ? "nd"
                  : day === 3 || day === 23
                    ? "rd"
                    : "th";
        return `Monthly on the ${day}${suffix} at ${timeStr}`;
    }

    if (dowPart === "*") return `Daily at ${timeStr}`;
    if (dowPart === "1-5") return `Weekdays at ${timeStr}`;

    const dowValues = dowPart!
        .split(",")
        .map((v) => parseInt(v, 10))
        .filter((v) => !isNaN(v));
    if (dowValues.length === 1) return `Every ${dayNames[dowValues[0]!]} at ${timeStr}`;
    return `Every ${dowValues.map((d) => dayNames[d]!).join(", ")} at ${timeStr}`;
}

function generateSuggestedName(config: ScheduleConfig, agentName: string): string {
    if (config.frequency === "interval") {
        const val = config.intervalValue || 15;
        const unit = config.intervalUnit || "minutes";
        const label =
            val === 1 ? (unit === "minutes" ? "Every minute" : "Hourly") : `Every ${val} ${unit}`;
        return `${label} — ${agentName}`;
    }

    const timeStr = `${config.hour}${config.ampm.toLowerCase()}`;
    const freqLabel =
        config.frequency === "daily"
            ? "Daily"
            : config.frequency === "weekdays"
              ? "Weekday"
              : config.frequency === "weekly"
                ? "Weekly"
                : "Monthly";
    return `${freqLabel} ${timeStr} — ${agentName}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cron → occurrences expansion
// ═══════════════════════════════════════════════════════════════════════════════

function expandCronForRange(cronExpr: string, from: Date, to: Date): Date[] {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return [];

    const [minutePart, hourPart, domPart, , dowPart] = parts;

    // Handle interval patterns: */N minutes or */N hours
    const minuteStep = minutePart?.match(/^\*\/(\d+)$/);
    const hourStep = hourPart?.match(/^\*\/(\d+)$/);

    if (minuteStep || hourStep) {
        const stepMs = minuteStep
            ? parseInt(minuteStep[1]!, 10) * 60 * 1000
            : parseInt(hourStep![1]!, 10) * 60 * 60 * 1000;
        const occurrences: Date[] = [];
        const maxOccurrences = 500;
        const current = new Date(from);
        // Align to nearest interval boundary
        if (minuteStep) {
            const stepMin = parseInt(minuteStep[1]!, 10);
            const mins = current.getMinutes();
            const nextMin = Math.ceil(mins / stepMin) * stepMin;
            current.setMinutes(nextMin, 0, 0);
        } else {
            const stepHour = parseInt(hourStep![1]!, 10);
            const hrs = current.getHours();
            const nextHr = Math.ceil(hrs / stepHour) * stepHour;
            current.setHours(nextHr, 0, 0, 0);
        }
        while (current <= to && occurrences.length < maxOccurrences) {
            occurrences.push(new Date(current));
            current.setTime(current.getTime() + stepMs);
        }
        return occurrences;
    }

    const minute = minutePart === "*" ? 0 : parseInt(minutePart!, 10);
    const hour = hourPart === "*" ? 0 : parseInt(hourPart!, 10);

    const occurrences: Date[] = [];
    const current = new Date(from);
    current.setHours(hour, minute, 0, 0);
    if (current < from) current.setDate(current.getDate() + 1);

    const maxOccurrences = 200;
    while (current <= to && occurrences.length < maxOccurrences) {
        const dayOfMonth = current.getDate();
        const dayOfWeek = current.getDay();

        let domMatch = domPart === "*";
        if (!domMatch && domPart) {
            const domValues = domPart.split(",").map((v) => parseInt(v, 10));
            domMatch = domValues.includes(dayOfMonth);
        }

        let dowMatch = dowPart === "*";
        if (!dowMatch && dowPart) {
            const dowValues = dowPart.split(",").map((v) => parseInt(v, 10));
            dowMatch = dowValues.includes(dayOfWeek);
        }

        if (domMatch && dowMatch) {
            occurrences.push(new Date(current));
        }

        current.setDate(current.getDate() + 1);
    }
    return occurrences;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AutomationWizard — Human-friendly create/edit (replaces CreateEditDialog)
// ═══════════════════════════════════════════════════════════════════════════════

const WIZARD_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WIZARD_MINUTES = [0, 15, 30, 45];

function AutomationWizard({
    open,
    onOpenChange,
    mode,
    automation,
    agents,
    apiBase,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    automation: Automation | null;
    agents: AgentOption[];
    apiBase: string;
    onSuccess: () => void;
}) {
    const resolvedTimezone = useTimezone();

    const defaultForm: FormState = {
        automationType: "schedule",
        agentId: "",
        name: "",
        description: "",
        task: "",
        cronExpr: "0 9 * * 1-5",
        timezone: resolvedTimezone,
        triggerType: "event",
        eventName: "",
        isActive: true,
        frequency: "weekdays",
        hour: 9,
        minute: 0,
        ampm: "AM",
        daysOfWeek: [],
        dayOfMonth: 1,
        intervalValue: 15,
        intervalUnit: "minutes" as const,
        color: ""
    };

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormState>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalSteps = mode === "edit" ? 2 : 3;
    const visibleStepLabels =
        mode === "edit"
            ? ["When & Color", "Name & Review"]
            : ["Type & Agent", "When & Color", "Name & Review"];
    const contentStep = mode === "edit" ? step + 1 : step;

    useEffect(() => {
        if (!open) return;
        setStep(0);
        setError(null);
        if (mode === "edit" && automation) {
            const parsed = parseAutomationId(automation.id);
            const isScheduleType = parsed?.sourceType !== "trigger";
            const schedConfig =
                isScheduleType && automation.config.cronExpr
                    ? parseCronToSchedule(automation.config.cronExpr)
                    : null;

            setForm({
                automationType: isScheduleType ? "schedule" : "trigger",
                agentId: automation.agent?.id || "",
                name: automation.name,
                description: automation.description || "",
                task: automation.config.task || "",
                cronExpr: automation.config.cronExpr || "0 9 * * 1-5",
                timezone: automation.config.timezone || resolvedTimezone,
                triggerType: automation.type === "scheduled" ? "event" : automation.type,
                eventName: automation.config.eventName || "",
                isActive: automation.isActive,
                frequency: schedConfig?.frequency || "weekdays",
                hour: schedConfig?.hour || 9,
                minute: schedConfig?.minute || 0,
                ampm: schedConfig?.ampm || "AM",
                daysOfWeek: schedConfig?.daysOfWeek || [],
                dayOfMonth: schedConfig?.dayOfMonth || 1,
                intervalValue: schedConfig?.intervalValue || 15,
                intervalUnit: schedConfig?.intervalUnit || "minutes",
                color: automation.config.color || ""
            });
        } else {
            setForm(defaultForm);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, automation]);

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const isSchedule = form.automationType === "schedule";

    const previewCron = useMemo(() => {
        if (!isSchedule) return null;
        return buildCronFromSchedule({
            frequency: form.frequency,
            hour: form.hour,
            minute: form.minute,
            ampm: form.ampm,
            daysOfWeek: form.daysOfWeek,
            dayOfMonth: form.dayOfMonth,
            intervalValue: form.intervalValue,
            intervalUnit: form.intervalUnit
        });
    }, [
        isSchedule,
        form.frequency,
        form.hour,
        form.minute,
        form.ampm,
        form.daysOfWeek,
        form.dayOfMonth,
        form.intervalValue,
        form.intervalUnit
    ]);

    const previewDescription = useMemo(() => {
        if (!previewCron) return "";
        return describeScheduleFromCron(previewCron);
    }, [previewCron]);

    const suggestedName = useMemo(() => {
        const agent = agents.find((a) => a.id === form.agentId);
        if (!agent || !isSchedule) return "";
        return generateSuggestedName(
            {
                frequency: form.frequency,
                hour: form.hour,
                minute: form.minute,
                ampm: form.ampm,
                daysOfWeek: form.daysOfWeek,
                dayOfMonth: form.dayOfMonth,
                intervalValue: form.intervalValue,
                intervalUnit: form.intervalUnit
            },
            agent.name
        );
    }, [
        agents,
        form.agentId,
        form.frequency,
        form.hour,
        form.minute,
        form.ampm,
        form.daysOfWeek,
        form.dayOfMonth,
        form.intervalValue,
        form.intervalUnit,
        isSchedule
    ]);

    const canProceedStep0 = form.agentId !== "" || mode === "edit";
    const canProceedStep1 = true;

    const handleSave = async () => {
        setError(null);
        if (!form.name.trim()) {
            if (suggestedName) setField("name", suggestedName);
            else {
                setError("Name is required.");
                return;
            }
        }
        setSaving(true);
        try {
            const finalName = form.name.trim() || suggestedName;
            if (mode === "create") {
                if (!form.agentId) {
                    setError("Please select an agent.");
                    setSaving(false);
                    return;
                }
                if (isSchedule) {
                    const cronExpr = previewCron || form.cronExpr.trim();
                    const res = await fetch(`${apiBase}/api/agents/${form.agentId}/schedules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: finalName,
                            description: form.description.trim() || undefined,
                            task: form.task.trim() || undefined,
                            cronExpr,
                            timezone: form.timezone,
                            isActive: form.isActive,
                            color: form.color || undefined
                        })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        setError(data.error || "Failed to create schedule");
                        setSaving(false);
                        return;
                    }
                } else {
                    if (!form.triggerType) {
                        setError("Trigger type is required.");
                        setSaving(false);
                        return;
                    }
                    if (form.triggerType === "event" && !form.eventName.trim()) {
                        setError("Event name is required.");
                        setSaving(false);
                        return;
                    }
                    const res = await fetch(`${apiBase}/api/agents/${form.agentId}/triggers`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: finalName,
                            description: form.description.trim() || undefined,
                            triggerType: form.triggerType,
                            eventName:
                                form.triggerType === "event" ? form.eventName.trim() : undefined,
                            isActive: form.isActive,
                            color: form.color || undefined
                        })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        setError(data.error || "Failed to create trigger");
                        setSaving(false);
                        return;
                    }
                }
            } else if (mode === "edit" && automation) {
                const parsed = parseAutomationId(automation.id);
                if (!parsed || !automation.agent) {
                    setError("Cannot edit this automation.");
                    setSaving(false);
                    return;
                }

                if (parsed.sourceType === "schedule") {
                    const cronExpr = previewCron || form.cronExpr.trim();
                    const res = await fetch(
                        `${apiBase}/api/agents/${automation.agent.id}/schedules/${parsed.rawId}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: finalName,
                                description: form.description.trim() || undefined,
                                task: form.task.trim() || undefined,
                                cronExpr,
                                timezone: form.timezone,
                                isActive: form.isActive,
                                color: form.color || undefined
                            })
                        }
                    );
                    const data = await res.json();
                    if (!data.success) {
                        setError(data.error || "Failed to update schedule");
                        setSaving(false);
                        return;
                    }
                } else {
                    const res = await fetch(
                        `${apiBase}/api/agents/${automation.agent.id}/triggers/${parsed.rawId}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: finalName,
                                description: form.description.trim() || undefined,
                                eventName: form.eventName.trim() || undefined,
                                isActive: form.isActive,
                                color: form.color || undefined
                            })
                        }
                    );
                    const data = await res.json();
                    if (!data.success) {
                        setError(data.error || "Failed to update trigger");
                        setSaving(false);
                        return;
                    }
                }
            }
            onOpenChange(false);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "New Automation" : "Edit Automation"}
                    </DialogTitle>
                    <DialogDescription>{visibleStepLabels[step]}</DialogDescription>
                </DialogHeader>

                {mode === "edit" && automation && (
                    <div className="bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2">
                        <Badge variant="secondary" className="text-xs">
                            {isSchedule ? "Schedule" : "Trigger"}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                            {automation.agent?.name || "—"}
                        </span>
                    </div>
                )}

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 py-1">
                    {visibleStepLabels.map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (i < step) setStep(i);
                                }}
                                className={`flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                                    i === step
                                        ? "bg-primary text-primary-foreground"
                                        : i < step
                                          ? "bg-primary/20 text-primary cursor-pointer"
                                          : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {i + 1}
                            </button>
                            {i < visibleStepLabels.length - 1 && (
                                <div
                                    className={`h-px w-8 ${i < step ? "bg-primary/40" : "bg-border"}`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="max-h-[400px] min-h-[260px] space-y-4 overflow-y-auto py-2">
                    {/* ── Step 0: Type + Agent (create only) ── */}
                    {contentStep === 0 && (
                        <>
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <div className="flex gap-2">
                                    {mode === "create" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setField("automationType", "schedule")
                                                }
                                                className={`flex-1 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${
                                                    isSchedule
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border hover:bg-muted"
                                                }`}
                                            >
                                                Schedule
                                                <span className="text-muted-foreground block text-[11px] font-normal">
                                                    Runs on a recurring schedule
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setField("automationType", "trigger")
                                                }
                                                className={`flex-1 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${
                                                    !isSchedule
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border hover:bg-muted"
                                                }`}
                                            >
                                                Trigger
                                                <span className="text-muted-foreground block text-[11px] font-normal">
                                                    Runs when an event fires
                                                </span>
                                            </button>
                                        </>
                                    ) : (
                                        <Badge variant="secondary" className="text-xs">
                                            {isSchedule ? "Schedule" : "Trigger"}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Agent</Label>
                                {mode === "create" ? (
                                    <Select
                                        value={form.agentId}
                                        onValueChange={(v) => v && setField("agentId", v)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select an agent...">
                                                {form.agentId
                                                    ? agents.find((a) => a.id === form.agentId)
                                                          ?.name || form.agentId
                                                    : undefined}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agents.map((a) => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-sm">{automation?.agent?.name || "—"}</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Step 1: When + Color ── */}
                    {contentStep === 1 && (
                        <>
                            {isSchedule ? (
                                <>
                                    {/* Frequency pills */}
                                    <div className="space-y-1.5">
                                        <Label>Frequency</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {(
                                                [
                                                    "interval",
                                                    "daily",
                                                    "weekdays",
                                                    "weekly",
                                                    "monthly"
                                                ] as Frequency[]
                                            ).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setField("frequency", f)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                                                        form.frequency === f
                                                            ? "border-primary bg-primary/10 text-primary"
                                                            : "border-border hover:bg-muted"
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Interval config */}
                                    {form.frequency === "interval" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label>Run every</Label>
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={String(form.intervalValue)}
                                                        onValueChange={(v) =>
                                                            v != null &&
                                                            setField(
                                                                "intervalValue",
                                                                parseInt(v, 10)
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[80px]">
                                                            <SelectValue>
                                                                {String(form.intervalValue)}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(form.intervalUnit === "minutes"
                                                                ? [1, 2, 3, 5, 10, 15, 20, 30]
                                                                : [1, 2, 3, 4, 6, 8, 12]
                                                            ).map((v) => (
                                                                <SelectItem
                                                                    key={v}
                                                                    value={String(v)}
                                                                >
                                                                    {v}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex overflow-hidden rounded-lg border">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setField("intervalUnit", "minutes");
                                                                if (
                                                                    ![
                                                                        1, 2, 3, 5, 10, 15, 20, 30
                                                                    ].includes(form.intervalValue)
                                                                )
                                                                    setField("intervalValue", 15);
                                                            }}
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                                form.intervalUnit === "minutes"
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "hover:bg-muted"
                                                            }`}
                                                        >
                                                            Minutes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setField("intervalUnit", "hours");
                                                                if (
                                                                    ![
                                                                        1, 2, 3, 4, 6, 8, 12
                                                                    ].includes(form.intervalValue)
                                                                )
                                                                    setField("intervalValue", 1);
                                                            }}
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                                form.intervalUnit === "hours"
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "hover:bg-muted"
                                                            }`}
                                                        >
                                                            Hours
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label>Starting at</Label>
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={String(form.hour)}
                                                        onValueChange={(v) =>
                                                            v != null &&
                                                            setField("hour", parseInt(v, 10))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[72px]">
                                                            <SelectValue>
                                                                {String(form.hour)}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from(
                                                                { length: 12 },
                                                                (_, i) => i + 1
                                                            ).map((h) => (
                                                                <SelectItem
                                                                    key={h}
                                                                    value={String(h)}
                                                                >
                                                                    {h}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <span className="text-muted-foreground">:</span>
                                                    <Select
                                                        value={String(form.minute)}
                                                        onValueChange={(v) =>
                                                            v != null &&
                                                            setField("minute", parseInt(v, 10))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[72px]">
                                                            <SelectValue>
                                                                {String(form.minute).padStart(
                                                                    2,
                                                                    "0"
                                                                )}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {WIZARD_MINUTES.map((m) => (
                                                                <SelectItem
                                                                    key={m}
                                                                    value={String(m)}
                                                                >
                                                                    {String(m).padStart(2, "0")}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex overflow-hidden rounded-lg border">
                                                        <button
                                                            type="button"
                                                            onClick={() => setField("ampm", "AM")}
                                                            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                                form.ampm === "AM"
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "hover:bg-muted"
                                                            }`}
                                                        >
                                                            AM
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setField("ampm", "PM")}
                                                            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                                form.ampm === "PM"
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "hover:bg-muted"
                                                            }`}
                                                        >
                                                            PM
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Day chips for weekly */}
                                    {form.frequency === "weekly" && (
                                        <div className="space-y-1.5">
                                            <Label>Days</Label>
                                            <div className="flex gap-1.5">
                                                {WIZARD_DAY_NAMES.map((day, idx) => (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = form.daysOfWeek;
                                                            setField(
                                                                "daysOfWeek",
                                                                current.includes(idx)
                                                                    ? current.filter(
                                                                          (d) => d !== idx
                                                                      )
                                                                    : [...current, idx].sort()
                                                            );
                                                        }}
                                                        className={`flex size-8 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                                                            form.daysOfWeek.includes(idx)
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-muted hover:bg-muted/80"
                                                        }`}
                                                    >
                                                        {day.charAt(0)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Day of month for monthly */}
                                    {form.frequency === "monthly" && (
                                        <div className="space-y-1.5">
                                            <Label>Day of Month</Label>
                                            <Select
                                                value={String(form.dayOfMonth)}
                                                onValueChange={(v) =>
                                                    v != null &&
                                                    setField("dayOfMonth", parseInt(v, 10))
                                                }
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from(
                                                        { length: 28 },
                                                        (_, i) => i + 1
                                                    ).map((d) => (
                                                        <SelectItem key={d} value={String(d)}>
                                                            {d}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Time picker: Hour / Minute / AM|PM (hidden for interval) */}
                                    {form.frequency !== "interval" && (
                                        <div className="space-y-1.5">
                                            <Label>Time</Label>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={String(form.hour)}
                                                    onValueChange={(v) =>
                                                        v != null &&
                                                        setField("hour", parseInt(v, 10))
                                                    }
                                                >
                                                    <SelectTrigger className="w-[72px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from(
                                                            { length: 12 },
                                                            (_, i) => i + 1
                                                        ).map((h) => (
                                                            <SelectItem key={h} value={String(h)}>
                                                                {h}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-muted-foreground">:</span>
                                                <Select
                                                    value={String(form.minute)}
                                                    onValueChange={(v) =>
                                                        v != null &&
                                                        setField("minute", parseInt(v, 10))
                                                    }
                                                >
                                                    <SelectTrigger className="w-[72px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {WIZARD_MINUTES.map((m) => (
                                                            <SelectItem key={m} value={String(m)}>
                                                                {String(m).padStart(2, "0")}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex overflow-hidden rounded-lg border">
                                                    <button
                                                        type="button"
                                                        onClick={() => setField("ampm", "AM")}
                                                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                            form.ampm === "AM"
                                                                ? "bg-primary text-primary-foreground"
                                                                : "hover:bg-muted"
                                                        }`}
                                                    >
                                                        AM
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setField("ampm", "PM")}
                                                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                            form.ampm === "PM"
                                                                ? "bg-primary text-primary-foreground"
                                                                : "hover:bg-muted"
                                                        }`}
                                                    >
                                                        PM
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Timezone */}
                                    <div className="space-y-1.5">
                                        <Label>Timezone</Label>
                                        <Select
                                            value={form.timezone}
                                            onValueChange={(v) => v && setField("timezone", v)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COMMON_TIMEZONES.map((tz) => (
                                                    <SelectItem key={tz} value={tz}>
                                                        {tz.replace(/_/g, " ")}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Live preview */}
                                    {previewDescription && (
                                        <div className="bg-muted/50 rounded-lg border px-3 py-2">
                                            <p className="text-foreground text-sm font-medium">
                                                {previewDescription}
                                            </p>
                                            {form.timezone !== "UTC" && (
                                                <p className="text-muted-foreground text-xs">
                                                    {form.timezone.replace(/_/g, " ")}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Trigger-specific: type + event name */}
                                    {mode === "create" && (
                                        <div className="space-y-1.5">
                                            <Label>Trigger Type</Label>
                                            <Select
                                                value={form.triggerType}
                                                onValueChange={(v) =>
                                                    v && setField("triggerType", v)
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="event">Event</SelectItem>
                                                    <SelectItem value="webhook">Webhook</SelectItem>
                                                    <SelectItem value="api">API</SelectItem>
                                                    <SelectItem value="manual">Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {(form.triggerType === "event" ||
                                        automation?.config.eventName) && (
                                        <div className="space-y-1.5">
                                            <Label>Event Name</Label>
                                            <Input
                                                value={form.eventName}
                                                onChange={(e) =>
                                                    setField("eventName", e.target.value)
                                                }
                                                placeholder="e.g. lead.created"
                                                className="font-mono"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Color picker */}
                            <div className="space-y-1.5">
                                <Label>Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {AUTOMATION_COLORS.map((c) => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() =>
                                                setField(
                                                    "color",
                                                    form.color === c.name ? "" : c.name
                                                )
                                            }
                                            className={`flex size-7 items-center justify-center rounded-full transition-all ${c.class} ${
                                                form.color === c.name
                                                    ? "ring-primary ring-2 ring-offset-2"
                                                    : "opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            {form.color === c.name && (
                                                <svg
                                                    className="size-3.5 text-white"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={3}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Name + Review ── */}
                    {contentStep === 2 && (
                        <>
                            <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder={suggestedName || "e.g. Daily Morning Report"}
                                />
                                {suggestedName && !form.name && (
                                    <p className="text-muted-foreground text-[11px]">
                                        Will use: {suggestedName}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>
                                    Description{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                    placeholder="What does this automation do?"
                                    rows={2}
                                />
                            </div>

                            {isSchedule && (
                                <div className="space-y-1.5">
                                    <Label>
                                        Task{" "}
                                        <span className="text-muted-foreground font-normal">
                                            (optional)
                                        </span>
                                    </Label>
                                    <Textarea
                                        value={form.task}
                                        onChange={(e) => setField("task", e.target.value)}
                                        placeholder="What should the agent do? e.g. Review your backlog and complete pending items"
                                        rows={3}
                                        className="max-h-[120px] resize-y overflow-y-auto"
                                    />
                                    <p className="text-muted-foreground text-[11px]">
                                        The instruction sent to the agent when this schedule fires.
                                        Supports templates: {"{{date}}"}, {"{{dayOfWeek}}"},{" "}
                                        {"{{time}}"}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <p className="text-sm font-medium">Active</p>
                                    <p className="text-muted-foreground text-xs">
                                        Enable immediately
                                    </p>
                                </div>
                                <Switch
                                    checked={form.isActive}
                                    onCheckedChange={(checked) => setField("isActive", checked)}
                                />
                            </div>

                            {/* Summary card */}
                            <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
                                <div className="flex items-center gap-2">
                                    {form.color && (
                                        <div
                                            className={`size-3 rounded-full ${getColorClass(form.color) || ""}`}
                                        />
                                    )}
                                    <p className="text-sm font-medium">
                                        {form.name || suggestedName || "Untitled"}
                                    </p>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    {agents.find((a) => a.id === form.agentId)?.name ||
                                        automation?.agent?.name ||
                                        "—"}{" "}
                                    ·{" "}
                                    {isSchedule
                                        ? previewDescription || "—"
                                        : `Trigger: ${form.triggerType}`}
                                    {form.timezone !== "UTC" && isSchedule
                                        ? ` · ${form.timezone.replace(/_/g, " ")}`
                                        : ""}
                                </p>
                                {form.task.trim() && (
                                    <p className="text-muted-foreground text-xs italic">
                                        Task: {form.task.trim()}
                                    </p>
                                )}
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </>
                    )}
                </div>

                <DialogFooter className="shrink-0 gap-2">
                    {step > 0 ? (
                        <Button
                            variant="outline"
                            onClick={() => setStep(step - 1)}
                            disabled={saving}
                        >
                            Back
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                    )}
                    {step < totalSteps - 1 ? (
                        <Button
                            onClick={() => setStep(step + 1)}
                            disabled={contentStep === 0 && !canProceedStep0}
                        >
                            Next
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : mode === "create" ? "Create" : "Save Changes"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirm Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function DeleteConfirmDialog({
    open,
    onOpenChange,
    automation,
    apiBase,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    automation: Automation | null;
    apiBase: string;
    onSuccess: () => void;
}) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!automation) return;
        const parsed = parseAutomationId(automation.id);
        if (!parsed || !automation.agent) return;

        setDeleting(true);
        try {
            let res: Response;
            if (parsed.sourceType === "schedule") {
                res = await fetch(
                    `${apiBase}/api/agents/${automation.agent.id}/schedules/${parsed.rawId}`,
                    { method: "DELETE" }
                );
            } else {
                res = await fetch(
                    `${apiBase}/api/agents/${automation.agent.id}/triggers/${parsed.rawId}`,
                    { method: "DELETE" }
                );
            }
            const data = await res.json();
            if (data.success) {
                onOpenChange(false);
                onSuccess();
            }
        } catch {
            /* silently handle */
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Automation</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete{" "}
                        <strong>&ldquo;{automation?.name}&rdquo;</strong>? This action cannot be
                        undone and will remove all associated run history.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {deleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Calendar View
// ═══════════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

function toLocalDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CalendarEvent {
    date: Date;
    automation: Automation;
}

function CalendarView({
    automations,
    onEditAutomation
}: {
    automations: Automation[];
    onEditAutomation: (a: Automation) => void;
}) {
    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
    const [baseDate, setBaseDate] = useState(() => new Date());
    const [now, setNow] = useState(() => new Date());
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (viewMode === "month") return;
        requestAnimationFrame(() => {
            const container = scrollRef.current;
            if (!container) return;
            const currentRow = container.querySelector("[data-current-hour]") as HTMLElement | null;
            if (!currentRow) return;
            container.scrollTop = Math.max(0, currentRow.offsetTop - container.clientHeight / 2);
        });
    }, [viewMode]);

    const { rangeStart, rangeEnd, days } = useMemo(() => {
        const start = new Date(baseDate);
        const end = new Date(baseDate);

        if (viewMode === "day") {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { rangeStart: start, rangeEnd: end, days: [new Date(start)] };
        } else if (viewMode === "week") {
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            end.setTime(start.getTime());
            end.setDate(end.getDate() + 7);
        } else {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() + 1, 1);
            end.setHours(0, 0, 0, 0);
        }

        const dayList: Date[] = [];
        const cursor = new Date(start);
        while (cursor < end) {
            dayList.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }

        return { rangeStart: start, rangeEnd: end, days: dayList };
    }, [baseDate, viewMode]);

    const allAgentIds = useMemo(
        () => [...new Set(automations.filter((a) => a.agent).map((a) => a.agent!.id))],
        [automations]
    );

    const events = useMemo(() => {
        const result: CalendarEvent[] = [];
        const scheduled = automations.filter(
            (a) => a.isActive && a.config.cronExpr && a.sourceType === "schedule"
        );

        for (const auto of scheduled) {
            const occurrences = expandCronForRange(auto.config.cronExpr!, rangeStart, rangeEnd);
            for (const date of occurrences) {
                result.push({ date, automation: auto });
            }
        }

        return result;
    }, [automations, rangeStart, rangeEnd]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const event of events) {
            const key = toLocalDateKey(event.date);
            const existing = map.get(key) || [];
            existing.push(event);
            map.set(key, existing);
        }
        return map;
    }, [events]);

    const goForward = () => {
        const next = new Date(baseDate);
        if (viewMode === "day") next.setDate(next.getDate() + 1);
        else if (viewMode === "week") next.setDate(next.getDate() + 7);
        else next.setMonth(next.getMonth() + 1);
        setBaseDate(next);
    };

    const goBack = () => {
        const prev = new Date(baseDate);
        if (viewMode === "day") prev.setDate(prev.getDate() - 1);
        else if (viewMode === "week") prev.setDate(prev.getDate() - 7);
        else prev.setMonth(prev.getMonth() - 1);
        setBaseDate(prev);
    };

    const goToday = () => setBaseDate(new Date());

    const today = toLocalDateKey(new Date());
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const DAY_NAMES_FULL = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const headerLabel = useMemo(() => {
        if (viewMode === "day") {
            return baseDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            });
        }
        if (viewMode === "week") {
            return `${rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(rangeEnd.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        }
        return `${MONTH_NAMES[baseDate.getMonth()]} ${baseDate.getFullYear()}`;
    }, [viewMode, baseDate, rangeStart, rangeEnd]);

    const HOURS = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="space-y-4">
            {/* Calendar header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goBack}>
                        <HugeiconsIcon icon={icons["arrow-left"]!} className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={goForward}>
                        <HugeiconsIcon icon={icons["arrow-right"]!} className="size-4" />
                    </Button>
                    <span className="text-sm font-medium">{headerLabel}</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border p-0.5">
                    {(["day", "week", "month"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                                viewMode === mode
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Day View — time grid */}
            {viewMode === "day" && (
                <Card>
                    <CardContent className="p-0">
                        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
                            {HOURS.map((hour) => {
                                const dayKey = toLocalDateKey(baseDate);
                                const dayEventsAll = eventsByDay.get(dayKey) || [];
                                const hourEvents = dayEventsAll.filter(
                                    (e) => e.date.getHours() === hour
                                );
                                const isCurrentHour = dayKey === today && now.getHours() === hour;

                                return (
                                    <div
                                        key={hour}
                                        className={`relative flex min-h-[52px] border-b last:border-b-0 ${isCurrentHour ? "bg-primary/5" : ""}`}
                                        {...(isCurrentHour ? { "data-current-hour": "true" } : {})}
                                    >
                                        {isCurrentHour && (
                                            <div
                                                className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
                                                style={{
                                                    top: `${(now.getMinutes() / 60) * 100}%`
                                                }}
                                            >
                                                <div className="flex w-16 shrink-0 justify-end pr-0.5">
                                                    <div className="size-2 rounded-full bg-red-500" />
                                                </div>
                                                <div className="flex-1 border-t-2 border-dashed border-red-500" />
                                            </div>
                                        )}
                                        <div className="text-muted-foreground w-16 shrink-0 border-r px-2 py-1 text-right text-xs">
                                            {hour === 0
                                                ? "12 AM"
                                                : hour < 12
                                                  ? `${hour} AM`
                                                  : hour === 12
                                                    ? "12 PM"
                                                    : `${hour - 12} PM`}
                                        </div>
                                        <div className="flex flex-1 flex-wrap gap-1 p-1">
                                            {hourEvents.map((evt, i) => (
                                                <button
                                                    key={`${evt.automation.id}-${i}`}
                                                    onClick={() => onEditAutomation(evt.automation)}
                                                    className={`flex items-center gap-1.5 truncate rounded px-2 py-1 text-[11px] text-white transition-opacity hover:opacity-80 ${getEventColor(
                                                        evt.automation,
                                                        allAgentIds
                                                    )}`}
                                                    title={`${evt.automation.name} — ${evt.automation.agent?.name}`}
                                                >
                                                    <span className="font-medium">
                                                        {evt.date.toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })}
                                                    </span>
                                                    <span className="truncate">
                                                        {evt.automation.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Week View — Google Calendar-style time grid */}
            {viewMode === "week" && (
                <Card>
                    <CardContent className="p-0">
                        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
                            {/* Sticky day headers */}
                            <div className="bg-background sticky top-0 z-10 flex border-b">
                                <div className="w-16 shrink-0 border-r" />
                                {days.map((day) => {
                                    const key = toLocalDateKey(day);
                                    const isToday = key === today;
                                    return (
                                        <div
                                            key={key}
                                            className={`flex flex-1 flex-col items-center border-r py-2 last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}
                                        >
                                            <span className="text-muted-foreground text-[10px] font-medium uppercase">
                                                {DAY_NAMES[day.getDay()]}
                                            </span>
                                            <span
                                                className={`mt-0.5 flex size-6 items-center justify-center rounded-full text-sm font-semibold ${
                                                    isToday
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-foreground"
                                                }`}
                                            >
                                                {day.getDate()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Hour rows */}
                            {HOURS.map((hour) => {
                                const isNowRow =
                                    days.some((d) => toLocalDateKey(d) === today) &&
                                    now.getHours() === hour;
                                return (
                                    <div
                                        key={hour}
                                        className="relative flex min-h-[52px] border-b last:border-b-0"
                                        {...(isNowRow ? { "data-current-hour": "true" } : {})}
                                    >
                                        {isNowRow && (
                                            <div
                                                className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
                                                style={{
                                                    top: `${(now.getMinutes() / 60) * 100}%`
                                                }}
                                            >
                                                <div className="flex w-16 shrink-0 justify-end pr-0.5">
                                                    <div className="size-2 rounded-full bg-red-500" />
                                                </div>
                                                <div className="flex-1 border-t-2 border-dashed border-red-500" />
                                            </div>
                                        )}
                                        {/* Hour label */}
                                        <div className="text-muted-foreground w-16 shrink-0 border-r px-2 py-1 text-right text-xs">
                                            {hour === 0
                                                ? "12 AM"
                                                : hour < 12
                                                  ? `${hour} AM`
                                                  : hour === 12
                                                    ? "12 PM"
                                                    : `${hour - 12} PM`}
                                        </div>

                                        {/* Day columns */}
                                        {days.map((day) => {
                                            const key = toLocalDateKey(day);
                                            const isToday = key === today;
                                            const isCurrentHour =
                                                isToday && now.getHours() === hour;
                                            const dayEventsAll = eventsByDay.get(key) || [];
                                            const hourEvents = dayEventsAll.filter(
                                                (e) => e.date.getHours() === hour
                                            );

                                            return (
                                                <div
                                                    key={key}
                                                    className={`flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden border-r p-0.5 last:border-r-0 ${
                                                        isCurrentHour
                                                            ? "bg-primary/5"
                                                            : isToday
                                                              ? "bg-primary/2"
                                                              : ""
                                                    }`}
                                                >
                                                    {hourEvents.map((evt, i) => (
                                                        <button
                                                            key={`${evt.automation.id}-${i}`}
                                                            onClick={() =>
                                                                onEditAutomation(evt.automation)
                                                            }
                                                            className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-[9px] text-white transition-opacity hover:opacity-80 ${getEventColor(
                                                                evt.automation,
                                                                allAgentIds
                                                            )}`}
                                                            title={`${evt.automation.name} — ${evt.automation.agent?.name || "Unknown agent"} at ${evt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                                        >
                                                            <span className="shrink-0 tabular-nums">
                                                                {evt.date.toLocaleTimeString([], {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })}
                                                            </span>
                                                            <span className="truncate">
                                                                {evt.automation.name}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Month View — grid */}
            {viewMode === "month" && (
                <Card>
                    <CardContent className="p-0">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 border-b">
                            {DAY_NAMES.map((name) => (
                                <div
                                    key={name}
                                    className="text-muted-foreground border-r px-2 py-2 text-center text-xs font-medium last:border-r-0"
                                >
                                    {name}
                                </div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7">
                            {Array.from({ length: days[0]?.getDay() || 0 }).map((_, i) => (
                                <div
                                    key={`pad-${i}`}
                                    className="bg-muted/30 min-h-[100px] border-r border-b last:border-r-0"
                                />
                            ))}
                            {days.map((day) => {
                                const key = toLocalDateKey(day);
                                const dayEvents = eventsByDay.get(key) || [];
                                const isToday = key === today;
                                const maxVisible = 4;

                                return (
                                    <div
                                        key={key}
                                        className={`min-h-[100px] border-r border-b p-1.5 last:border-r-0 ${
                                            isToday ? "bg-primary/5" : ""
                                        }`}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span
                                                className={`text-xs font-medium ${
                                                    isToday
                                                        ? "bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px]"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {day.getDate()}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayEvents.slice(0, maxVisible).map((evt, i) => (
                                                <button
                                                    key={`${evt.automation.id}-${i}`}
                                                    onClick={() => onEditAutomation(evt.automation)}
                                                    className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] text-white transition-opacity hover:opacity-80 ${getEventColor(
                                                        evt.automation,
                                                        allAgentIds
                                                    )}`}
                                                    title={`${evt.automation.name} — ${evt.automation.agent?.name || "Unknown agent"} at ${evt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                                                >
                                                    <span className="shrink-0 tabular-nums">
                                                        {evt.date.toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })}
                                                    </span>
                                                    <span className="truncate">
                                                        {evt.automation.name}
                                                    </span>
                                                </button>
                                            ))}
                                            {dayEvents.length > maxVisible && (
                                                <div className="text-muted-foreground px-1 text-[10px]">
                                                    +{dayEvents.length - maxVisible} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Legend */}
            {allAgentIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground text-xs">Agents:</span>
                    {allAgentIds.map((id) => {
                        const agent = automations.find((a) => a.agent?.id === id)?.agent;
                        return (
                            <div key={id} className="flex items-center gap-1.5">
                                <div
                                    className={`size-2.5 rounded-full ${getAgentColor(id, allAgentIds)}`}
                                />
                                <span className="text-xs">{agent?.name || id}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// List View
// ═══════════════════════════════════════════════════════════════════════════════

function ListView({
    automations,
    summary,
    loading,
    error,
    onToggle,
    toggling,
    onArchive,
    archiving,
    onEdit,
    onDelete,
    showArchived,
    onShowArchivedChange,
    onNew,
    selectedIds,
    onSelectedIdsChange,
    onBulkArchive,
    bulkArchiving
}: {
    automations: Automation[];
    summary: AutomationSummary | null;
    loading: boolean;
    error: string | null;
    onToggle: (a: Automation) => void;
    toggling: string | null;
    onArchive: (a: Automation, archive: boolean) => void;
    archiving: string | null;
    onEdit: (a: Automation) => void;
    onDelete: (a: Automation) => void;
    showArchived: boolean;
    onShowArchivedChange: (v: boolean) => void;
    onNew: () => void;
    selectedIds: Set<string>;
    onSelectedIdsChange: (ids: Set<string>) => void;
    onBulkArchive: () => void;
    bulkArchiving: boolean;
}) {
    const selectableAutomations = useMemo(
        () => automations.filter((a) => !a.isArchived),
        [automations]
    );

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total</CardDescription>
                        <CardTitle className="text-2xl">{summary?.total ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                            {summary?.active ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Schedules</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">
                            {summary?.schedules ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Event Triggers</CardDescription>
                        <CardTitle className="text-2xl">{summary?.triggers ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Archived</CardDescription>
                        <CardTitle className="text-muted-foreground text-2xl">
                            {summary?.archived ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                        <CardTitle
                            className={`text-2xl ${getSuccessRateColor(summary?.overallSuccessRate ?? 100)}`}
                        >
                            {summary?.overallSuccessRate?.toFixed(0) ?? "—"}%
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Switch checked={showArchived} onCheckedChange={onShowArchivedChange} />
                    <span className="text-muted-foreground text-sm">Show archived</span>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onBulkArchive}
                            disabled={bulkArchiving}
                        >
                            <HugeiconsIcon icon={Archive01Icon} className="mr-1.5 size-4" />
                            {bulkArchiving
                                ? "Archiving..."
                                : `Archive ${selectedIds.size} selected`}
                        </Button>
                    )}
                    <Button size="sm" onClick={onNew}>
                        <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                        New Automation
                    </Button>
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] pl-4">
                                    <Checkbox
                                        checked={
                                            selectableAutomations.length > 0 &&
                                            selectableAutomations.every((a) =>
                                                selectedIds.has(a.id)
                                            )
                                        }
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                onSelectedIdsChange(
                                                    new Set(selectableAutomations.map((a) => a.id))
                                                );
                                            } else {
                                                onSelectedIdsChange(new Set());
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="w-[80px]">Type</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead className="w-[80px]">Status</TableHead>
                                <TableHead>Config</TableHead>
                                <TableHead className="text-right">Runs</TableHead>
                                <TableHead className="text-right">Success</TableHead>
                                <TableHead>Last Run</TableHead>
                                <TableHead>Next Run</TableHead>
                                <TableHead className="w-[48px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {automations.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={11}
                                        className="text-muted-foreground py-8 text-center"
                                    >
                                        No automations found.{" "}
                                        <button
                                            onClick={onNew}
                                            className="text-primary underline-offset-4 hover:underline"
                                        >
                                            Create one
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                automations.map((auto) => (
                                    <TableRow
                                        key={auto.id}
                                        className={auto.isArchived ? "opacity-50" : ""}
                                    >
                                        <TableCell className="pl-4">
                                            {!auto.isArchived && (
                                                <Checkbox
                                                    checked={selectedIds.has(auto.id)}
                                                    onCheckedChange={(checked) => {
                                                        const next = new Set(selectedIds);
                                                        if (checked) {
                                                            next.add(auto.id);
                                                        } else {
                                                            next.delete(auto.id);
                                                        }
                                                        onSelectedIdsChange(next);
                                                    }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] ${getTypeBadgeColor(auto.type)}`}
                                            >
                                                {getTypeLabel(auto.type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{auto.name}</div>
                                                {auto.description && (
                                                    <div className="text-muted-foreground max-w-[200px] truncate text-xs">
                                                        {auto.description}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {auto.agent?.name || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={auto.isActive}
                                                disabled={toggling === auto.id || auto.isArchived}
                                                onCheckedChange={() => onToggle(auto)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {auto.config.color && (
                                                    <div
                                                        className={`size-2.5 shrink-0 rounded-full ${getColorClass(auto.config.color) || "bg-gray-400"}`}
                                                    />
                                                )}
                                                <span className="text-muted-foreground text-xs">
                                                    {auto.config.cronExpr
                                                        ? describeScheduleFromCron(
                                                              auto.config.cronExpr
                                                          )
                                                        : auto.config.eventName ||
                                                          auto.config.webhookPath ||
                                                          "—"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {auto.stats.totalRuns}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span
                                                className={`tabular-nums ${getSuccessRateColor(auto.stats.successRate)}`}
                                            >
                                                {auto.stats.totalRuns > 0
                                                    ? `${auto.stats.successRate.toFixed(0)}%`
                                                    : "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-xs">
                                                {formatRelativeTime(auto.stats.lastRunAt)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-xs">
                                                {auto.stats.nextRunAt
                                                    ? formatRelativeTime(auto.stats.nextRunAt)
                                                    : "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="hover:bg-accent flex size-7 items-center justify-center rounded">
                                                    <HugeiconsIcon
                                                        icon={MoreHorizontalIcon}
                                                        className="size-4"
                                                    />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem onClick={() => onEdit(auto)}>
                                                        <HugeiconsIcon
                                                            icon={PencilEdit02Icon}
                                                            className="mr-2 size-3.5"
                                                        />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            onArchive(auto, !auto.isArchived)
                                                        }
                                                        disabled={archiving === auto.id}
                                                    >
                                                        <HugeiconsIcon
                                                            icon={Archive01Icon}
                                                            className="mr-2 size-3.5"
                                                        />
                                                        {auto.isArchived ? "Unarchive" : "Archive"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(auto)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <HugeiconsIcon
                                                            icon={Delete02Icon}
                                                            className="mr-2 size-3.5"
                                                        />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Schedule Page
// ═══════════════════════════════════════════════════════════════════════════════

function SchedulePageClient() {
    const searchParams = useSearchParams();
    const initialView = searchParams.get("view") || "list";
    const apiBase = getApiBase();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [summary, setSummary] = useState<AutomationSummary | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [archiving, setArchiving] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkArchiving, setBulkArchiving] = useState(false);

    // CRUD state
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

    const fetchAutomations = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (showArchived) params.set("includeArchived", "true");
            const url = `${apiBase}/api/live/automations${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setAutomations(data.automations || []);
                setSummary(data.summary || null);
            } else {
                setError(data.error || "Failed to load automations");
            }
        } catch (fetchError) {
            setError(
                fetchError instanceof Error ? fetchError.message : "Failed to load automations"
            );
        } finally {
            setLoading(false);
        }
    }, [apiBase, showArchived]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/agents`);
            const data = await res.json();
            if (data.success) {
                setAgents(
                    (data.agents || []).map((a: AgentOption) => ({
                        id: a.id,
                        slug: a.slug,
                        name: a.name
                    }))
                );
            }
        } catch {
            /* silently handle */
        }
    }, [apiBase]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    useEffect(() => {
        const interval = setInterval(fetchAutomations, 30000);
        return () => clearInterval(interval);
    }, [fetchAutomations]);

    const toggleAutomation = useCallback(
        async (automation: Automation) => {
            setToggling(automation.id);
            try {
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automation.id)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: !automation.isActive })
                    }
                );
                const data = await res.json();
                if (data.success) {
                    setAutomations((prev) =>
                        prev.map((a) =>
                            a.id === automation.id ? { ...a, isActive: !a.isActive } : a
                        )
                    );
                }
            } catch {
                /* silently handle */
            } finally {
                setToggling(null);
            }
        },
        [apiBase]
    );

    const archiveAutomation = useCallback(
        async (automation: Automation, archive: boolean) => {
            setArchiving(automation.id);
            try {
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automation.id)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isArchived: archive })
                    }
                );
                const data = await res.json();
                if (data.success) {
                    if (archive && !showArchived) {
                        setAutomations((prev) => prev.filter((a) => a.id !== automation.id));
                    } else {
                        setAutomations((prev) =>
                            prev.map((a) =>
                                a.id === automation.id
                                    ? {
                                          ...a,
                                          isArchived: archive,
                                          archivedAt: archive ? new Date().toISOString() : null,
                                          isActive: archive ? false : a.isActive
                                      }
                                    : a
                            )
                        );
                    }
                }
            } catch {
                /* silently handle */
            } finally {
                setArchiving(null);
            }
        },
        [apiBase, showArchived]
    );

    const bulkArchive = useCallback(async () => {
        if (selectedIds.size === 0) return;
        setBulkArchiving(true);
        try {
            const archivable = automations.filter((a) => selectedIds.has(a.id));
            await Promise.all(
                archivable.map((a) =>
                    fetch(`${apiBase}/api/live/automations/${encodeURIComponent(a.id)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isArchived: true })
                    })
                )
            );
            const archivedSet = new Set(archivable.map((a) => a.id));
            if (!showArchived) {
                setAutomations((prev) => prev.filter((a) => !archivedSet.has(a.id)));
            } else {
                setAutomations((prev) =>
                    prev.map((a) =>
                        archivedSet.has(a.id)
                            ? {
                                  ...a,
                                  isArchived: true,
                                  archivedAt: new Date().toISOString(),
                                  isActive: false
                              }
                            : a
                    )
                );
            }
            setSelectedIds(new Set());
        } catch {
            /* silently handle */
        } finally {
            setBulkArchiving(false);
        }
    }, [apiBase, automations, selectedIds, showArchived]);

    const handleEdit = (automation: Automation) => {
        setSelectedAutomation(automation);
        setEditDialogOpen(true);
    };

    const handleDelete = (automation: Automation) => {
        setSelectedAutomation(automation);
        setDeleteDialogOpen(true);
    };

    const handleNew = () => {
        setCreateDialogOpen(true);
    };

    const handleCrudSuccess = () => {
        setLoading(true);
        fetchAutomations();
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Schedule</h1>
                        <p className="text-muted-foreground">
                            Manage automations, schedules, and triggers. See when your agents are
                            scheduled to work.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setLoading(true);
                                fetchAutomations();
                            }}
                        >
                            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-4" />
                        </Button>
                        <Button size="sm" onClick={handleNew}>
                            <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                            New Automation
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue={initialView} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="list">
                            <HugeiconsIcon icon={icons["task-list"]!} className="mr-1.5 size-4" />
                            List
                        </TabsTrigger>
                        <TabsTrigger value="calendar">
                            <HugeiconsIcon icon={icons.calendar!} className="mr-1.5 size-4" />
                            Calendar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-0">
                        <ListView
                            automations={automations}
                            summary={summary}
                            loading={loading}
                            error={error}
                            onToggle={toggleAutomation}
                            toggling={toggling}
                            onArchive={archiveAutomation}
                            archiving={archiving}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            showArchived={showArchived}
                            onShowArchivedChange={setShowArchived}
                            onNew={handleNew}
                            selectedIds={selectedIds}
                            onSelectedIdsChange={setSelectedIds}
                            onBulkArchive={bulkArchive}
                            bulkArchiving={bulkArchiving}
                        />
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-0">
                        {loading ? (
                            <Skeleton className="h-[500px]" />
                        ) : (
                            <CalendarView automations={automations} onEditAutomation={handleEdit} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Create Wizard */}
            <AutomationWizard
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                mode="create"
                automation={null}
                agents={agents}
                apiBase={apiBase}
                onSuccess={handleCrudSuccess}
            />

            {/* Edit Wizard */}
            <AutomationWizard
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                mode="edit"
                automation={selectedAutomation}
                agents={agents}
                apiBase={apiBase}
                onSuccess={handleCrudSuccess}
            />

            {/* Sidekick Sidebar */}
            <SidekickSidebar
                pageContext={{
                    page: "schedule",
                    summary: summary
                        ? `${summary.total} automations, ${summary.active} active`
                        : undefined
                }}
                onAction={handleCrudSuccess}
            />

            {/* Delete Confirm Dialog */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                automation={selectedAutomation}
                apiBase={apiBase}
                onSuccess={() => {
                    setAutomations((prev) => prev.filter((a) => a.id !== selectedAutomation?.id));
                    setSummary((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  total: Math.max(0, prev.total - 1),
                                  active: selectedAutomation?.isActive
                                      ? Math.max(0, prev.active - 1)
                                      : prev.active,
                                  schedules:
                                      selectedAutomation?.sourceType === "schedule"
                                          ? Math.max(0, prev.schedules - 1)
                                          : prev.schedules,
                                  triggers:
                                      selectedAutomation?.sourceType === "trigger"
                                          ? Math.max(0, prev.triggers - 1)
                                          : prev.triggers
                              }
                            : prev
                    );
                }}
            />
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <SchedulePageClient />
        </Suspense>
    );
}
