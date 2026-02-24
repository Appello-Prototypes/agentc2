"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
    sourceType: "schedule" | "trigger" | "implicit";
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
    implicit: number;
    overallSuccessRate: number;
}

interface FormState {
    automationType: "schedule" | "trigger";
    agentId: string;
    name: string;
    description: string;
    cronExpr: string;
    timezone: string;
    triggerType: string;
    eventName: string;
    isActive: boolean;
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
// Cron → occurrences expansion
// ═══════════════════════════════════════════════════════════════════════════════

function expandCronForRange(cronExpr: string, from: Date, to: Date): Date[] {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return [];

    const [minutePart, hourPart, domPart, , dowPart] = parts;
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
// Create/Edit Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function CreateEditDialog({
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
    const defaultForm: FormState = {
        automationType: "schedule",
        agentId: "",
        name: "",
        description: "",
        cronExpr: "0 9 * * 1-5",
        timezone: "UTC",
        triggerType: "event",
        eventName: "",
        isActive: true
    };

    const [form, setForm] = useState<FormState>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (mode === "edit" && automation) {
            const parsed = parseAutomationId(automation.id);
            setForm({
                automationType: parsed?.sourceType === "trigger" ? "trigger" : "schedule",
                agentId: automation.agent?.id || "",
                name: automation.name,
                description: automation.description || "",
                cronExpr: automation.config.cronExpr || "0 9 * * 1-5",
                timezone: automation.config.timezone || "UTC",
                triggerType: automation.type === "scheduled" ? "event" : automation.type,
                eventName: automation.config.eventName || "",
                isActive: automation.isActive
            });
        } else {
            setForm(defaultForm);
        }
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, automation]);

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setError(null);
        setSaving(true);
        try {
            if (mode === "create") {
                if (!form.agentId) {
                    setError("Please select an agent.");
                    setSaving(false);
                    return;
                }
                if (!form.name.trim()) {
                    setError("Name is required.");
                    setSaving(false);
                    return;
                }

                if (form.automationType === "schedule") {
                    if (!form.cronExpr.trim()) {
                        setError("Cron expression is required.");
                        setSaving(false);
                        return;
                    }
                    const res = await fetch(`${apiBase}/api/agents/${form.agentId}/schedules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: form.name.trim(),
                            description: form.description.trim() || undefined,
                            cronExpr: form.cronExpr.trim(),
                            timezone: form.timezone,
                            isActive: form.isActive
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
                        setError("Event name is required for event triggers.");
                        setSaving(false);
                        return;
                    }
                    const res = await fetch(`${apiBase}/api/agents/${form.agentId}/triggers`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: form.name.trim(),
                            description: form.description.trim() || undefined,
                            triggerType: form.triggerType,
                            eventName:
                                form.triggerType === "event" ? form.eventName.trim() : undefined,
                            isActive: form.isActive
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
                if (!form.name.trim()) {
                    setError("Name is required.");
                    setSaving(false);
                    return;
                }
                const parsed = parseAutomationId(automation.id);
                if (!parsed || !automation.agent) {
                    setError("Cannot edit this automation.");
                    setSaving(false);
                    return;
                }

                if (parsed.sourceType === "schedule") {
                    const res = await fetch(
                        `${apiBase}/api/agents/${automation.agent.id}/schedules/${parsed.rawId}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: form.name.trim(),
                                description: form.description.trim() || undefined,
                                cronExpr: form.cronExpr.trim(),
                                timezone: form.timezone,
                                isActive: form.isActive
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
                                name: form.name.trim(),
                                description: form.description.trim() || undefined,
                                eventName: form.eventName.trim() || undefined,
                                isActive: form.isActive
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

    const isSchedule = form.automationType === "schedule";
    const isEditingTrigger = mode === "edit" && automation?.sourceType === "trigger";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "New Automation" : "Edit Automation"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? "Create a new schedule or trigger for an agent."
                            : "Update the automation configuration."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Type selector — only for create */}
                    {mode === "create" && (
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setField("automationType", "schedule")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                        isSchedule
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border hover:bg-muted"
                                    }`}
                                >
                                    Schedule
                                    <span className="text-muted-foreground block text-[11px] font-normal">
                                        Cron-based recurring
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setField("automationType", "trigger")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                        !isSchedule
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border hover:bg-muted"
                                    }`}
                                >
                                    Trigger
                                    <span className="text-muted-foreground block text-[11px] font-normal">
                                        Event or webhook
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Agent selector — only for create */}
                    {mode === "create" && (
                        <div className="space-y-1.5">
                            <Label>Agent</Label>
                            <Select
                                value={form.agentId}
                                onValueChange={(v) => v && setField("agentId", v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select an agent..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="e.g. Daily Morning Report"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label>
                            Description{" "}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                            placeholder="What does this automation do?"
                            rows={2}
                        />
                    </div>

                    {/* Schedule-specific fields */}
                    {(isSchedule ||
                        (!isEditingTrigger &&
                            mode === "edit" &&
                            automation?.sourceType !== "trigger")) &&
                        !isEditingTrigger && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Cron Expression</Label>
                                    <Input
                                        value={form.cronExpr}
                                        onChange={(e) => setField("cronExpr", e.target.value)}
                                        placeholder="0 9 * * 1-5"
                                        className="font-mono"
                                    />
                                    <p className="text-muted-foreground text-[11px]">
                                        Format: minute hour day month weekday — e.g.{" "}
                                        <code className="bg-muted rounded px-1">0 9 * * 1-5</code> =
                                        9am Mon–Fri
                                    </p>
                                </div>
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
                                                    {tz}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                    {/* Trigger-specific fields */}
                    {(!isSchedule || isEditingTrigger) && (
                        <>
                            {mode === "create" && (
                                <div className="space-y-1.5">
                                    <Label>Trigger Type</Label>
                                    <Select
                                        value={form.triggerType}
                                        onValueChange={(v) => v && setField("triggerType", v)}
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
                            {(form.triggerType === "event" || automation?.config.eventName) && (
                                <div className="space-y-1.5">
                                    <Label>Event Name</Label>
                                    <Input
                                        value={form.eventName}
                                        onChange={(e) => setField("eventName", e.target.value)}
                                        placeholder="e.g. lead.created"
                                        className="font-mono"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Active toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Active</p>
                            <p className="text-muted-foreground text-xs">
                                Enable this automation immediately
                            </p>
                        </div>
                        <Switch
                            checked={form.isActive}
                            onCheckedChange={(checked) => setField("isActive", checked)}
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : mode === "create" ? "Create" : "Save Changes"}
                    </Button>
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
            const key = event.date.toISOString().slice(0, 10);
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

    const today = new Date().toISOString().slice(0, 10);
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
                        <div className="max-h-[600px] overflow-y-auto">
                            {HOURS.map((hour) => {
                                const dayKey = baseDate.toISOString().slice(0, 10);
                                const dayEventsAll = eventsByDay.get(dayKey) || [];
                                const hourEvents = dayEventsAll.filter(
                                    (e) => e.date.getHours() === hour
                                );
                                const isCurrentHour =
                                    dayKey === today && new Date().getHours() === hour;

                                return (
                                    <div
                                        key={hour}
                                        className={`flex min-h-[52px] border-b last:border-b-0 ${isCurrentHour ? "bg-primary/5" : ""}`}
                                    >
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
                                                    className={`flex items-center gap-1.5 truncate rounded px-2 py-1 text-[11px] text-white transition-opacity hover:opacity-80 ${
                                                        evt.automation.agent
                                                            ? getAgentColor(
                                                                  evt.automation.agent.id,
                                                                  allAgentIds
                                                              )
                                                            : "bg-gray-500"
                                                    }`}
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
                        <div className="max-h-[600px] overflow-y-auto">
                            {/* Sticky day headers */}
                            <div className="bg-background sticky top-0 z-10 flex border-b">
                                <div className="w-16 shrink-0 border-r" />
                                {days.map((day) => {
                                    const key = day.toISOString().slice(0, 10);
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
                                return (
                                    <div
                                        key={hour}
                                        className="flex min-h-[52px] border-b last:border-b-0"
                                    >
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
                                            const key = day.toISOString().slice(0, 10);
                                            const isToday = key === today;
                                            const isCurrentHour =
                                                isToday && new Date().getHours() === hour;
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
                                                            className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-[9px] text-white transition-opacity hover:opacity-80 ${
                                                                evt.automation.agent
                                                                    ? getAgentColor(
                                                                          evt.automation.agent.id,
                                                                          allAgentIds
                                                                      )
                                                                    : "bg-gray-500"
                                                            }`}
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
                                const key = day.toISOString().slice(0, 10);
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
                                                    className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] text-white transition-opacity hover:opacity-80 ${
                                                        evt.automation.agent
                                                            ? getAgentColor(
                                                                  evt.automation.agent.id,
                                                                  allAgentIds
                                                              )
                                                            : "bg-gray-500"
                                                    }`}
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
    onNew
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
}) {
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
                        <CardTitle className="text-2xl">
                            {(summary?.triggers ?? 0) + (summary?.implicit ?? 0)}
                        </CardTitle>
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
                <Button size="sm" onClick={onNew}>
                    <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                    New Automation
                </Button>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
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
                                        colSpan={10}
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
                                            {auto.sourceType !== "implicit" ? (
                                                <Switch
                                                    checked={auto.isActive}
                                                    disabled={
                                                        toggling === auto.id || auto.isArchived
                                                    }
                                                    onCheckedChange={() => onToggle(auto)}
                                                />
                                            ) : (
                                                <Badge variant="outline" className="text-[10px]">
                                                    Auto
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground font-mono text-xs">
                                                {auto.config.cronExpr ||
                                                    auto.config.eventName ||
                                                    auto.config.webhookPath ||
                                                    "—"}
                                            </span>
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
                                            {auto.sourceType !== "implicit" && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger className="hover:bg-accent flex size-7 items-center justify-center rounded">
                                                        <HugeiconsIcon
                                                            icon={MoreHorizontalIcon}
                                                            className="size-4"
                                                        />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-44"
                                                    >
                                                        <DropdownMenuItem
                                                            onClick={() => onEdit(auto)}
                                                        >
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
                                                            {auto.isArchived
                                                                ? "Unarchive"
                                                                : "Archive"}
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
                                            )}
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
            if (automation.sourceType === "implicit") return;
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
            if (automation.sourceType === "implicit") return;
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

            {/* Create Dialog */}
            <CreateEditDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                mode="create"
                automation={null}
                agents={agents}
                apiBase={apiBase}
                onSuccess={handleCrudSuccess}
            />

            {/* Edit Dialog */}
            <CreateEditDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                mode="edit"
                automation={selectedAutomation}
                agents={agents}
                apiBase={apiBase}
                onSuccess={handleCrudSuccess}
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
