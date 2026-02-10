"use client";

import * as React from "react";
import { useResolvedValue } from "../use-resolved-data";
import { formatValue } from "../use-resolved-data";
import { cn } from "../../../lib/utils";

const colorMap: Record<string, string> = {
    default: "",
    blue: "border-l-4 border-l-blue-500",
    green: "border-l-4 border-l-green-500",
    red: "border-l-4 border-l-red-500",
    yellow: "border-l-4 border-l-yellow-500",
    purple: "border-l-4 border-l-purple-500"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function KPICardBlock({ config }: { config: any }) {
    const rawValue = useResolvedValue(config.value);
    const trendValue = useResolvedValue(config.trend?.value);

    const displayValue = formatValue(rawValue, config.format, config.prefix, config.suffix);
    const colorClass = colorMap[config.color || "default"] || "";

    return (
        <div
            className={cn(
                "bg-card text-card-foreground rounded-lg border p-4 shadow-sm",
                colorClass,
                config.className
            )}
        >
            {config.title && (
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
                    {config.title}
                </p>
            )}
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{displayValue}</span>
                {config.trend && trendValue != null && (
                    <span
                        className={cn(
                            "inline-flex items-center text-sm font-medium",
                            config.trend.direction === "up" && "text-green-600",
                            config.trend.direction === "down" && "text-red-600",
                            config.trend.direction === "neutral" && "text-muted-foreground"
                        )}
                    >
                        {config.trend.direction === "up" && "↑"}
                        {config.trend.direction === "down" && "↓"}
                        {String(trendValue)}
                        {config.trend.label && (
                            <span className="text-muted-foreground ml-1 text-xs">
                                {config.trend.label}
                            </span>
                        )}
                    </span>
                )}
            </div>
            {config.description && (
                <p className="text-muted-foreground mt-1 text-xs">{config.description}</p>
            )}
        </div>
    );
}
