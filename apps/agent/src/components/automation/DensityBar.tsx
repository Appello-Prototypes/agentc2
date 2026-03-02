"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { expandCronForRange } from "./helpers";
import type { Automation } from "./types";

interface DensityBarProps {
    automations: Automation[];
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

function getDensityColor(count: number): string {
    if (count === 0) return "bg-muted/30";
    if (count <= 2) return "bg-emerald-500/30";
    if (count <= 5) return "bg-amber-500/50";
    return "bg-red-500/60";
}

export function DensityBar({ automations }: DensityBarProps) {
    const { hourCounts, hourDetails } = useMemo(() => {
        const counts = new Array(24).fill(0) as number[];
        const details = new Array(24).fill(null).map(() => [] as string[]) as string[][];

        const now = new Date();
        const sampleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const sampleEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const scheduled = automations.filter(
            (a) => a.isActive && a.config.cronExpr && a.sourceType === "schedule"
        );

        for (const auto of scheduled) {
            const occurrences = expandCronForRange(auto.config.cronExpr!, sampleStart, sampleEnd);
            for (const occ of occurrences) {
                const h = occ.getHours();
                counts[h]!++;
                if (!details[h]!.includes(auto.name)) {
                    details[h]!.push(auto.name);
                }
            }
        }

        return { hourCounts: counts, hourDetails: details };
    }, [automations]);

    const maxCount = Math.max(...hourCounts, 1);

    if (automations.filter((a) => a.isActive && a.config.cronExpr).length === 0) {
        return null;
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">
                    Execution Density (today)
                </span>
                {hourCounts.some((c) => c >= 8) && (
                    <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                        High concurrency detected
                    </span>
                )}
            </div>
            <div className="flex gap-px overflow-hidden rounded-md">
                {hourCounts.map((count, hour) => (
                    <div
                        key={hour}
                        className="group relative flex-1"
                        title={`${HOUR_LABELS[hour]}: ${count} execution${count !== 1 ? "s" : ""}${hourDetails[hour]!.length > 0 ? `\n${hourDetails[hour]!.join(", ")}` : ""}`}
                    >
                        <div
                            className={cn(
                                "h-6 w-full transition-colors",
                                getDensityColor(count),
                                count >= 8 && "ring-1 ring-orange-500/50"
                            )}
                        />
                        {hour % 6 === 0 && (
                            <span className="text-muted-foreground absolute -bottom-4 left-0 text-[9px]">
                                {HOUR_LABELS[hour]}
                            </span>
                        )}
                        <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-md group-hover:block">
                            <div className="font-medium">
                                {HOUR_LABELS[hour]}: {count} run{count !== 1 ? "s" : ""}
                            </div>
                            {hourDetails[hour]!.slice(0, 5).map((name) => (
                                <div key={name} className="text-muted-foreground truncate">
                                    {name}
                                </div>
                            ))}
                            {hourDetails[hour]!.length > 5 && (
                                <div className="text-muted-foreground">
                                    +{hourDetails[hour]!.length - 5} more
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="h-4" />
        </div>
    );
}
