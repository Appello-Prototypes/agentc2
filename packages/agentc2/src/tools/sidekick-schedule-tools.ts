import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const baseOutputSchema = z.object({ success: z.boolean() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

// ─── Cron builder ────────────────────────────────────────────────────────────

type Frequency = "daily" | "weekdays" | "weekly" | "monthly";

function buildCronFromHumanParams(params: {
    frequency: Frequency;
    time: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
}): string {
    const [hourStr, minuteStr] = params.time.split(":");
    const hour = parseInt(hourStr!, 10);
    const minute = parseInt(minuteStr!, 10);

    switch (params.frequency) {
        case "daily":
            return `${minute} ${hour} * * *`;
        case "weekdays":
            return `${minute} ${hour} * * 1-5`;
        case "weekly": {
            const days =
                params.daysOfWeek && params.daysOfWeek.length > 0
                    ? params.daysOfWeek.join(",")
                    : "1";
            return `${minute} ${hour} * * ${days}`;
        }
        case "monthly": {
            const dom = params.dayOfMonth ?? 1;
            return `${minute} ${hour} ${dom} * *`;
        }
        default:
            return `${minute} ${hour} * * *`;
    }
}

function describeSchedule(cronExpr: string): string {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return cronExpr;

    const [minutePart, hourPart, domPart, , dowPart] = parts;

    const minute = minutePart === "*" ? 0 : parseInt(minutePart!, 10);
    const hour = hourPart === "*" ? -1 : parseInt(hourPart!, 10);

    const formatTime = (h: number, m: number) => {
        if (h < 0) return "every hour";
        const ampm = h >= 12 ? "PM" : "AM";
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const timeStr = formatTime(hour, minute);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

    if (dowPart === "*") {
        return `Every day at ${timeStr}`;
    }

    if (dowPart === "1-5") {
        return `Every weekday at ${timeStr}`;
    }

    const dowValues = dowPart!
        .split(",")
        .map((v) => parseInt(v, 10))
        .filter((v) => !isNaN(v));

    if (dowValues.length === 1) {
        return `Every ${dayNames[dowValues[0]!]} at ${timeStr}`;
    }

    const dayList = dowValues.map((d) => dayNames[d]!).join(", ");
    return `Every ${dayList} at ${timeStr}`;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export const sidekickListAgentsTool = createTool({
    id: "sidekick-list-agents",
    description:
        "List all available agents on the platform. Use this to find which agents exist and their slugs before creating a schedule.",
    inputSchema: z.object({}),
    outputSchema: z.object({
        agents: z.array(
            z.object({
                id: z.string(),
                slug: z.string(),
                name: z.string()
            })
        )
    }),
    execute: async () => {
        const data = await callInternalApi("/api/agents");
        return {
            agents: (data.agents || []).map((a: { id: string; slug: string; name: string }) => ({
                id: a.id,
                slug: a.slug,
                name: a.name
            }))
        };
    }
});

export const sidekickListAutomationsTool = createTool({
    id: "sidekick-list-automations",
    description:
        "List all automations (schedules and triggers) across all agents. Returns each automation with a human-readable description of when it runs.",
    inputSchema: z.object({
        includeArchived: z
            .boolean()
            .optional()
            .describe("Include archived automations. Defaults to false.")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ includeArchived }) => {
        const data = await callInternalApi("/api/live/automations", {
            query: includeArchived ? { includeArchived: "true" } : {}
        });
        const automations = (data.automations || []).map(
            (a: {
                id: string;
                name: string;
                sourceType: string;
                type: string;
                isActive: boolean;
                agent?: { name: string; slug: string } | null;
                config: {
                    cronExpr?: string;
                    timezone?: string;
                    eventName?: string | null;
                    task?: string | null;
                };
                stats: { totalRuns: number; successRate: number; lastRunAt: string | null };
            }) => ({
                id: a.id,
                name: a.name,
                sourceType: a.sourceType,
                type: a.type,
                isActive: a.isActive,
                agentName: a.agent?.name || "Unknown",
                agentSlug: a.agent?.slug || "unknown",
                description: a.config.cronExpr
                    ? `${describeSchedule(a.config.cronExpr)}${a.config.timezone && a.config.timezone !== "UTC" ? ` (${a.config.timezone})` : ""}`
                    : a.config.eventName || a.type,
                task: a.config.task || null,
                totalRuns: a.stats.totalRuns,
                successRate: a.stats.successRate,
                lastRunAt: a.stats.lastRunAt
            })
        );
        return { success: true, automations, total: automations.length };
    }
});

export const sidekickCreateScheduleTool = createTool({
    id: "sidekick-create-schedule",
    description:
        "Create a new scheduled automation for an agent. Accepts human-friendly frequency and time instead of raw cron expressions. Always confirm what was created with the user.",
    inputSchema: z.object({
        agentSlug: z.string().describe("The agent's slug (use sidekick-list-agents to find it)"),
        name: z.string().describe("A short descriptive name for this schedule"),
        frequency: z
            .enum(["daily", "weekdays", "weekly", "monthly"])
            .describe("How often to run: daily, weekdays (Mon-Fri), weekly, or monthly"),
        time: z.string().describe("Time to run in HH:MM 24-hour format (e.g., '09:00', '14:30')"),
        timezone: z
            .string()
            .optional()
            .describe("IANA timezone (e.g., 'America/New_York'). Defaults to UTC."),
        daysOfWeek: z
            .array(z.number().min(0).max(6))
            .optional()
            .describe(
                "For weekly frequency: days of week (0=Sunday, 1=Monday, ..., 6=Saturday). Defaults to Monday."
            ),
        dayOfMonth: z
            .number()
            .min(1)
            .max(31)
            .optional()
            .describe("For monthly frequency: day of month (1-31). Defaults to 1."),
        description: z.string().optional().describe("What this automation does"),
        task: z
            .string()
            .optional()
            .describe(
                "The instruction/task the agent should perform when this schedule fires. Supports template variables like {{date}}, {{dayOfWeek}}, {{time}}."
            ),
        color: z
            .enum(["blue", "emerald", "purple", "amber", "rose", "cyan", "indigo", "orange"])
            .optional()
            .describe("Calendar color for this schedule"),
        isActive: z
            .boolean()
            .optional()
            .describe("Whether to activate immediately. Defaults to true.")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        agentSlug,
        name,
        frequency,
        time,
        timezone,
        daysOfWeek,
        dayOfMonth,
        description,
        task,
        color,
        isActive
    }) => {
        const cronExpr = buildCronFromHumanParams({
            frequency,
            time,
            daysOfWeek,
            dayOfMonth
        });

        const result = await callInternalApi(`/api/agents/${agentSlug}/schedules`, {
            method: "POST",
            body: {
                name,
                cronExpr,
                description,
                task,
                timezone: timezone || "UTC",
                color,
                isActive: isActive !== false
            }
        });

        const humanDesc = describeSchedule(cronExpr);
        return {
            ...result,
            humanDescription: `${humanDesc}${timezone && timezone !== "UTC" ? ` (${timezone})` : ""}`
        };
    }
});

export const sidekickEditScheduleTool = createTool({
    id: "sidekick-edit-schedule",
    description:
        "Edit an existing schedule. Use sidekick-list-automations first to find the schedule ID. Any field not provided will remain unchanged.",
    inputSchema: z.object({
        scheduleId: z
            .string()
            .describe(
                "The schedule ID (the part after 'schedule:' from the automation ID, e.g., 'cm...')"
            ),
        agentSlug: z.string().describe("The agent's slug that owns this schedule"),
        name: z.string().optional(),
        frequency: z.enum(["daily", "weekdays", "weekly", "monthly"]).optional(),
        time: z.string().optional().describe("Time in HH:MM 24-hour format"),
        timezone: z.string().optional(),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        dayOfMonth: z.number().min(1).max(31).optional(),
        description: z.string().optional(),
        task: z
            .string()
            .nullable()
            .optional()
            .describe(
                "The instruction/task the agent should perform when this schedule fires. Set to null to clear."
            ),
        color: z
            .enum(["blue", "emerald", "purple", "amber", "rose", "cyan", "indigo", "orange"])
            .nullable()
            .optional(),
        isActive: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        scheduleId,
        agentSlug,
        name,
        frequency,
        time,
        timezone,
        daysOfWeek,
        dayOfMonth,
        description,
        task,
        color,
        isActive
    }) => {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (task !== undefined) body.task = task;
        if (timezone !== undefined) body.timezone = timezone;
        if (color !== undefined) body.color = color;
        if (isActive !== undefined) body.isActive = isActive;

        if (frequency && time) {
            body.cronExpr = buildCronFromHumanParams({
                frequency,
                time,
                daysOfWeek,
                dayOfMonth
            });
        }

        return callInternalApi(`/api/agents/${agentSlug}/schedules/${scheduleId}`, {
            method: "PATCH",
            body
        });
    }
});

export const sidekickToggleScheduleTool = createTool({
    id: "sidekick-toggle-schedule",
    description:
        "Turn a schedule on or off. Use sidekick-list-automations to find the automation ID first.",
    inputSchema: z.object({
        automationId: z
            .string()
            .describe("The full automation ID (e.g., 'schedule:cm...' or 'trigger:cm...')"),
        isActive: z.boolean().describe("true to activate, false to deactivate")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ automationId, isActive }) => {
        return callInternalApi(`/api/live/automations/${encodeURIComponent(automationId)}`, {
            method: "PATCH",
            body: { isActive }
        });
    }
});

export const sidekickDeleteScheduleTool = createTool({
    id: "sidekick-delete-schedule",
    description:
        "Permanently delete a schedule or trigger. This cannot be undone. Always confirm with the user before deleting.",
    inputSchema: z.object({
        scheduleId: z
            .string()
            .describe("The schedule ID (the raw ID without the 'schedule:' prefix)"),
        agentSlug: z.string().describe("The agent's slug that owns this schedule")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ scheduleId, agentSlug }) => {
        return callInternalApi(`/api/agents/${agentSlug}/schedules/${scheduleId}`, {
            method: "DELETE"
        });
    }
});

export const sidekickDescribeScheduleTool = createTool({
    id: "sidekick-describe-schedule",
    description:
        "Convert a cron expression into a human-readable description. Useful when explaining existing schedules to users.",
    inputSchema: z.object({
        cronExpr: z.string().describe("The cron expression to describe (e.g., '0 9 * * 1-5')")
    }),
    outputSchema: z.object({
        description: z.string().describe("Human-readable schedule description")
    }),
    execute: async ({ cronExpr }) => {
        return { description: describeSchedule(cronExpr) };
    }
});
