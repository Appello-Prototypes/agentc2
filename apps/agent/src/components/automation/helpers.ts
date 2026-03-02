import type { Automation, ScheduleConfig } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const COMMON_TIMEZONES = [
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

export const AUTOMATION_COLORS: { name: string; class: string }[] = [
    { name: "blue", class: "bg-blue-500" },
    { name: "emerald", class: "bg-emerald-500" },
    { name: "purple", class: "bg-purple-500" },
    { name: "amber", class: "bg-amber-500" },
    { name: "rose", class: "bg-rose-500" },
    { name: "cyan", class: "bg-cyan-500" },
    { name: "indigo", class: "bg-indigo-500" },
    { name: "orange", class: "bg-orange-500" }
];

export const AGENT_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-orange-500"
];

// ═══════════════════════════════════════════════════════════════════════════════
// Display helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function formatRelativeTime(dateStr: string | null | undefined): string {
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

export function getTypeBadgeColor(type: string): string {
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

export function getTypeLabel(type: string): string {
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

export function getSuccessRateColor(rate: number): string {
    if (rate >= 95) return "text-green-600 dark:text-green-400";
    if (rate >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

export function getColorClass(name: string | null | undefined): string | null {
    if (!name) return null;
    const found = AUTOMATION_COLORS.find((c) => c.name === name);
    return found?.class ?? null;
}

export function getAgentColor(agentId: string, allIds: string[]): string {
    const index = allIds.indexOf(agentId);
    return AGENT_COLORS[index % AGENT_COLORS.length]!;
}

export function getEventColor(automation: Automation, allAgentIds: string[]): string {
    const customColor = getColorClass(automation.config.color);
    if (customColor) return customColor;
    if (automation.agent) return getAgentColor(automation.agent.id, allAgentIds);
    return "bg-gray-400";
}

export function parseAutomationId(
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

// ═══════════════════════════════════════════════════════════════════════════════
// Cron helpers
// ═══════════════════════════════════════════════════════════════════════════════

export function to24Hour(hour: number, ampm: "AM" | "PM"): number {
    if (ampm === "AM") return hour === 12 ? 0 : hour;
    return hour === 12 ? 12 : hour + 12;
}

export function buildCronFromSchedule(config: ScheduleConfig): string {
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

export function parseCronToSchedule(cron: string): ScheduleConfig | null {
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

export function describeScheduleFromCron(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return cron;

    const [minutePart, hourPart, domPart, , dowPart] = parts;

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

export function generateSuggestedName(config: ScheduleConfig, agentName: string): string {
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
// Cron expansion (used by calendar and density bar)
// ═══════════════════════════════════════════════════════════════════════════════

export function expandCronForRange(cronExpr: string, from: Date, to: Date): Date[] {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return [];

    const [minutePart, hourPart, domPart, , dowPart] = parts;

    const minuteStep = minutePart?.match(/^\*\/(\d+)$/);
    const hourStep = hourPart?.match(/^\*\/(\d+)$/);

    if (minuteStep || hourStep) {
        const stepMs = minuteStep
            ? parseInt(minuteStep[1]!, 10) * 60 * 1000
            : parseInt(hourStep![1]!, 10) * 60 * 60 * 1000;
        const occurrences: Date[] = [];
        const maxOccurrences = 500;
        const current = new Date(from);
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
            if (dowPart === "1-5") {
                dowMatch = dayOfWeek >= 1 && dayOfWeek <= 5;
            } else {
                const dowValues = dowPart.split(",").map((v) => parseInt(v, 10));
                dowMatch = dowValues.includes(dayOfWeek);
            }
        }

        if (domMatch && dowMatch) {
            occurrences.push(new Date(current));
        }

        current.setDate(current.getDate() + 1);
    }
    return occurrences;
}

/**
 * Estimate monthly cost by counting how many times the cron fires in a 30-day window
 * and multiplying by the average cost per run.
 */
export function estimateMonthlyCost(cronExpr: string, avgCostPerRun: number): number {
    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);
    to.setDate(to.getDate() + 30);
    const occurrences = expandCronForRange(cronExpr, from, to);
    return occurrences.length * avgCostPerRun;
}
