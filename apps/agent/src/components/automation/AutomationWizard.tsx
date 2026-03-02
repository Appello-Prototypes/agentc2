"use client";

import { useEffect, useMemo, useState } from "react";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Slider,
    Switch,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { useTimezone } from "@/components/TimezoneProvider";
import {
    AUTOMATION_COLORS,
    COMMON_TIMEZONES,
    buildCronFromSchedule,
    describeScheduleFromCron,
    generateSuggestedName,
    getColorClass,
    parseAutomationId,
    parseCronToSchedule
} from "./helpers";
import type { AgentOption, Automation, FormState, Frequency } from "./types";

const WIZARD_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WIZARD_MINUTES = [0, 15, 30, 45];

interface AutomationWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    automation: Automation | null;
    agents: AgentOption[];
    apiBase?: string;
    onSuccess: () => void;
}

export function AutomationWizard({
    open,
    onOpenChange,
    mode,
    automation,
    agents,
    apiBase: apiBaseProp,
    onSuccess
}: AutomationWizardProps) {
    const resolvedTimezone = useTimezone();
    const apiBase = apiBaseProp ?? getApiBase();

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
        color: "",
        healthPolicyEnabled: false,
        healthThreshold: 50,
        healthWindow: 10,
        healthAction: "pause_and_alert"
    };

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormState>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalSteps = mode === "edit" ? 3 : 4;
    const visibleStepLabels =
        mode === "edit"
            ? ["When & Color", "Health Policy", "Name & Review"]
            : ["Type & Agent", "When & Color", "Health Policy", "Name & Review"];
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
                color: automation.config.color || "",
                healthPolicyEnabled: false,
                healthThreshold: 50,
                healthWindow: 10,
                healthAction: "pause_and_alert"
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
                            color: form.color || undefined,
                            healthPolicyEnabled: form.healthPolicyEnabled,
                            healthThreshold: form.healthPolicyEnabled
                                ? (form.healthThreshold ?? 50) / 100
                                : undefined,
                            healthWindow: form.healthPolicyEnabled ? form.healthWindow : undefined,
                            healthAction: form.healthPolicyEnabled ? form.healthAction : undefined
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
                                color: form.color || undefined,
                                healthPolicyEnabled: form.healthPolicyEnabled,
                                healthThreshold: form.healthPolicyEnabled
                                    ? (form.healthThreshold ?? 50) / 100
                                    : undefined,
                                healthWindow: form.healthPolicyEnabled
                                    ? form.healthWindow
                                    : undefined,
                                healthAction: form.healthPolicyEnabled
                                    ? form.healthAction
                                    : undefined
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

                    {/* ── Step 2: Health Policy (schedules only) ── */}
                    {contentStep === 2 && (
                        <>
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <p className="text-sm font-medium">Health Policy</p>
                                    <p className="text-muted-foreground text-xs">
                                        Auto-pause when failure rate exceeds threshold
                                    </p>
                                </div>
                                <Switch
                                    checked={form.healthPolicyEnabled ?? false}
                                    onCheckedChange={(checked) =>
                                        setField("healthPolicyEnabled", checked)
                                    }
                                />
                            </div>

                            {form.healthPolicyEnabled && (
                                <>
                                    <div className="space-y-2">
                                        <Label>
                                            Failure Threshold: {form.healthThreshold ?? 50}%
                                        </Label>
                                        <Slider
                                            value={[form.healthThreshold ?? 50]}
                                            onValueChange={(val) =>
                                                setField(
                                                    "healthThreshold",
                                                    Array.isArray(val) ? val[0] : val
                                                )
                                            }
                                            min={10}
                                            max={90}
                                            step={5}
                                            className="w-full"
                                        />
                                        <p className="text-muted-foreground text-[11px]">
                                            Trigger when failure rate exceeds this percentage
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Window (recent runs)</Label>
                                        <Select
                                            value={String(form.healthWindow ?? 10)}
                                            onValueChange={(v) =>
                                                v && setField("healthWindow", parseInt(v, 10))
                                            }
                                        >
                                            <SelectTrigger className="w-[100px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[5, 10, 20, 50, 100].map((n) => (
                                                    <SelectItem key={n} value={String(n)}>
                                                        {n} runs
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Action</Label>
                                        <Select
                                            value={form.healthAction ?? "pause_and_alert"}
                                            onValueChange={(v) => v && setField("healthAction", v)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pause">
                                                    Pause schedule
                                                </SelectItem>
                                                <SelectItem value="alert">Alert only</SelectItem>
                                                <SelectItem value="pause_and_alert">
                                                    Pause + Alert
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ── Step 3: Name + Review ── */}
                    {contentStep === 3 && (
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
                                {form.healthPolicyEnabled && (
                                    <p className="text-muted-foreground text-xs">
                                        Health: auto-{form.healthAction?.replace(/_/g, " ")} at{" "}
                                        {form.healthThreshold}% failure over {form.healthWindow}{" "}
                                        runs
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

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    automation: Automation | null;
    apiBase?: string;
    onSuccess: () => void;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    automation,
    apiBase: apiBaseProp,
    onSuccess
}: DeleteConfirmDialogProps) {
    const apiBase = apiBaseProp ?? getApiBase();
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
