"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, Checkbox, HugeiconsIcon, icons, Label } from "@repo/ui";
import { cn } from "@/lib/utils";
import { expandCronForRange, getAgentColor, getEventColor } from "./helpers";
import { getAutomationHealth, getAutomationHealthStyles } from "./health";
import type { Automation, CalendarColorMode, CalendarEvent } from "./types";

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

interface CalendarViewProps {
    automations: Automation[];
    onEditAutomation: (a: Automation) => void;
}

const RUNS_PER_DAY_COMPRESSION_THRESHOLD = 12;

function getColorForEvent(
    automation: Automation,
    allAgentIds: string[],
    colorMode: CalendarColorMode
): string {
    if (colorMode === "health") {
        const styles = getAutomationHealthStyles(automation.stats.successRate);
        return styles.dot;
    }
    if (colorMode === "primitive") {
        switch (automation.sourceType) {
            case "schedule":
                return "bg-blue-500";
            case "trigger":
                return "bg-green-500";
            default:
                return "bg-gray-400";
        }
    }
    return getEventColor(automation, allAgentIds);
}

export function CalendarView({ automations, onEditAutomation }: CalendarViewProps) {
    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
    const [baseDate, setBaseDate] = useState(() => new Date());
    const [now, setNow] = useState(() => new Date());
    const [colorMode, setColorMode] = useState<CalendarColorMode>("agent");
    const [filterAgentIds, setFilterAgentIds] = useState<Set<string>>(new Set());
    const [filterPrimitiveTypes, setFilterPrimitiveTypes] = useState<Set<string>>(new Set());
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

    const filteredAutomations = useMemo(() => {
        let result = automations;
        if (filterAgentIds.size > 0) {
            result = result.filter((a) => a.agent && filterAgentIds.has(a.agent.id));
        }
        if (filterPrimitiveTypes.size > 0) {
            result = result.filter((a) => filterPrimitiveTypes.has(a.sourceType));
        }
        return result;
    }, [automations, filterAgentIds, filterPrimitiveTypes]);

    const events = useMemo(() => {
        const result: CalendarEvent[] = [];
        const scheduled = filteredAutomations.filter(
            (a) => a.isActive && a.config.cronExpr && a.sourceType === "schedule"
        );

        for (const auto of scheduled) {
            const occurrences = expandCronForRange(auto.config.cronExpr!, rangeStart, rangeEnd);
            for (const date of occurrences) {
                result.push({ date, automation: auto });
            }
        }

        return result;
    }, [filteredAutomations, rangeStart, rangeEnd]);

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

    const runsPerDayPerAutomation = useMemo(() => {
        const map = new Map<string, Map<string, number>>();
        for (const event of events) {
            const dayKey = toLocalDateKey(event.date);
            let dayMap = map.get(dayKey);
            if (!dayMap) {
                dayMap = new Map();
                map.set(dayKey, dayMap);
            }
            dayMap.set(event.automation.id, (dayMap.get(event.automation.id) || 0) + 1);
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

    const hourConcurrency = useMemo(() => {
        const map = new Map<string, number[]>();
        for (const event of events) {
            const dayKey = toLocalDateKey(event.date);
            if (!map.has(dayKey)) {
                map.set(dayKey, new Array(24).fill(0) as number[]);
            }
            const hours = map.get(dayKey)!;
            hours[event.date.getHours()]!++;
        }
        return map;
    }, [events]);

    const toggleAgentFilter = (agentId: string) => {
        setFilterAgentIds((prev) => {
            const next = new Set(prev);
            if (next.has(agentId)) next.delete(agentId);
            else next.add(agentId);
            return next;
        });
    };

    const togglePrimitiveFilter = (type: string) => {
        setFilterPrimitiveTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const renderHourEvents = (hourEvents: CalendarEvent[], compact = false) => {
        return hourEvents.map((evt, i) => (
            <button
                key={`${evt.automation.id}-${i}`}
                onClick={() => onEditAutomation(evt.automation)}
                className={cn(
                    "flex items-center gap-1 truncate rounded text-white transition-opacity hover:opacity-80",
                    compact
                        ? "w-full min-w-0 overflow-hidden px-1 py-0.5 text-[9px]"
                        : "gap-1.5 px-2 py-1 text-[11px]",
                    getColorForEvent(evt.automation, allAgentIds, colorMode)
                )}
                title={`${evt.automation.name} — ${evt.automation.agent?.name || "Unknown agent"} at ${evt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            >
                <span className="shrink-0 font-medium tabular-nums">
                    {evt.date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    })}
                </span>
                <span className="truncate">{evt.automation.name}</span>
            </button>
        ));
    };

    const renderConcurrencyOverlay = (dayKey: string, hour: number) => {
        const dayConcurrency = hourConcurrency.get(dayKey);
        if (!dayConcurrency) return null;
        const count = dayConcurrency[hour] ?? 0;
        if (count <= 1) return null;
        const intensity = Math.min(count / 10, 1);
        return (
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
                style={{
                    backgroundColor: `rgba(239, 68, 68, ${intensity})`
                }}
            />
        );
    };

    const renderCompressedDay = (dayKey: string, dayEvents: CalendarEvent[]) => {
        const dayAutoMap = runsPerDayPerAutomation.get(dayKey);
        if (!dayAutoMap) return renderHourEvents(dayEvents);

        const compressed: { automation: Automation; count: number }[] = [];
        const individual: CalendarEvent[] = [];

        const seen = new Set<string>();
        for (const evt of dayEvents) {
            const count = dayAutoMap.get(evt.automation.id) || 0;
            if (count >= RUNS_PER_DAY_COMPRESSION_THRESHOLD) {
                if (!seen.has(evt.automation.id)) {
                    seen.add(evt.automation.id);
                    compressed.push({ automation: evt.automation, count });
                }
            } else {
                individual.push(evt);
            }
        }

        return (
            <>
                {compressed.map(({ automation, count }) => (
                    <button
                        key={`range-${automation.id}`}
                        onClick={() => onEditAutomation(automation)}
                        className={cn(
                            "flex w-full items-center justify-between rounded px-1.5 py-0.5 text-[10px] text-white transition-opacity hover:opacity-80",
                            getColorForEvent(automation, allAgentIds, colorMode)
                        )}
                        title={`${automation.name}: ${count} runs today`}
                    >
                        <span className="truncate">{automation.name}</span>
                        <span className="ml-1 shrink-0 font-mono text-[9px] opacity-80">
                            ×{count}
                        </span>
                    </button>
                ))}
                {individual.slice(0, 4).map((evt, i) => (
                    <button
                        key={`${evt.automation.id}-${i}`}
                        onClick={() => onEditAutomation(evt.automation)}
                        className={cn(
                            "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] text-white transition-opacity hover:opacity-80",
                            getColorForEvent(evt.automation, allAgentIds, colorMode)
                        )}
                        title={`${evt.automation.name} at ${evt.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    >
                        <span className="shrink-0 tabular-nums">
                            {evt.date.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </span>
                        <span className="truncate">{evt.automation.name}</span>
                    </button>
                ))}
                {individual.length > 4 && (
                    <div className="text-muted-foreground px-1 text-[10px]">
                        +{individual.length - 4} more
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="space-y-4">
            {/* Calendar header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                <div className="flex items-center gap-3">
                    {/* Color mode toggle */}
                    <div className="flex items-center gap-1 rounded-lg border p-0.5">
                        {(["agent", "primitive", "health"] as CalendarColorMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setColorMode(mode)}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                                    colorMode === mode
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    {/* View mode toggle */}
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
            </div>

            {/* Filters */}
            {(allAgentIds.length > 1 || automations.some((a) => a.sourceType === "trigger")) && (
                <div className="flex flex-wrap items-center gap-4">
                    {allAgentIds.length > 1 && (
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Agents:</Label>
                            {allAgentIds.map((id) => {
                                const agent = automations.find((a) => a.agent?.id === id)?.agent;
                                return (
                                    <label key={id} className="flex items-center gap-1.5 text-xs">
                                        <Checkbox
                                            checked={
                                                filterAgentIds.size === 0 || filterAgentIds.has(id)
                                            }
                                            onCheckedChange={() => toggleAgentFilter(id)}
                                        />
                                        <div
                                            className={cn(
                                                "size-2 rounded-full",
                                                getAgentColor(id, allAgentIds)
                                            )}
                                        />
                                        {agent?.name || id}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Type:</Label>
                        {["schedule", "trigger"].map((type) => (
                            <label
                                key={type}
                                className="flex items-center gap-1.5 text-xs capitalize"
                            >
                                <Checkbox
                                    checked={
                                        filterPrimitiveTypes.size === 0 ||
                                        filterPrimitiveTypes.has(type)
                                    }
                                    onCheckedChange={() => togglePrimitiveFilter(type)}
                                />
                                {type}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Day View */}
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
                                        className={cn(
                                            "relative flex min-h-[52px] border-b last:border-b-0",
                                            isCurrentHour && "bg-primary/5"
                                        )}
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
                                        {renderConcurrencyOverlay(dayKey, hour)}
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
                                            {renderHourEvents(hourEvents)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Week View */}
            {viewMode === "week" && (
                <Card>
                    <CardContent className="p-0">
                        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
                            <div className="bg-background sticky top-0 z-10 flex border-b">
                                <div className="w-16 shrink-0 border-r" />
                                {days.map((day) => {
                                    const key = toLocalDateKey(day);
                                    const isToday = key === today;
                                    return (
                                        <div
                                            key={key}
                                            className={cn(
                                                "flex flex-1 flex-col items-center border-r py-2 last:border-r-0",
                                                isToday && "bg-primary/5"
                                            )}
                                        >
                                            <span className="text-muted-foreground text-[10px] font-medium uppercase">
                                                {DAY_NAMES[day.getDay()]}
                                            </span>
                                            <span
                                                className={cn(
                                                    "mt-0.5 flex size-6 items-center justify-center rounded-full text-sm font-semibold",
                                                    isToday
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-foreground"
                                                )}
                                            >
                                                {day.getDate()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

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
                                        <div className="text-muted-foreground w-16 shrink-0 border-r px-2 py-1 text-right text-xs">
                                            {hour === 0
                                                ? "12 AM"
                                                : hour < 12
                                                  ? `${hour} AM`
                                                  : hour === 12
                                                    ? "12 PM"
                                                    : `${hour - 12} PM`}
                                        </div>

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
                                                    className={cn(
                                                        "relative flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden border-r p-0.5 last:border-r-0",
                                                        isCurrentHour
                                                            ? "bg-primary/5"
                                                            : isToday
                                                              ? "bg-primary/2"
                                                              : ""
                                                    )}
                                                >
                                                    {renderHourEvents(hourEvents, true)}
                                                    {renderConcurrencyOverlay(key, hour)}
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

            {/* Month View */}
            {viewMode === "month" && (
                <Card>
                    <CardContent className="p-0">
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

                                return (
                                    <div
                                        key={key}
                                        className={cn(
                                            "min-h-[100px] border-r border-b p-1.5 last:border-r-0",
                                            isToday && "bg-primary/5"
                                        )}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span
                                                className={cn(
                                                    "text-xs font-medium",
                                                    isToday
                                                        ? "bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px]"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {day.getDate()}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {renderCompressedDay(key, dayEvents)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Legend */}
            {allAgentIds.length > 0 && colorMode === "agent" && (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground text-xs">Agents:</span>
                    {allAgentIds.map((id) => {
                        const agent = automations.find((a) => a.agent?.id === id)?.agent;
                        return (
                            <div key={id} className="flex items-center gap-1.5">
                                <div
                                    className={cn(
                                        "size-2.5 rounded-full",
                                        getAgentColor(id, allAgentIds)
                                    )}
                                />
                                <span className="text-xs">{agent?.name || id}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            {colorMode === "health" && (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground text-xs">Health:</span>
                    {(["healthy", "degrading", "unstable", "failing"] as const).map((status) => {
                        const styles = getAutomationHealthStyles(
                            status === "healthy"
                                ? 100
                                : status === "degrading"
                                  ? 85
                                  : status === "unstable"
                                    ? 70
                                    : 30
                        );
                        return (
                            <div key={status} className="flex items-center gap-1.5">
                                <div className={cn("size-2.5 rounded-full", styles.dot)} />
                                <span className="text-xs capitalize">{status}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
