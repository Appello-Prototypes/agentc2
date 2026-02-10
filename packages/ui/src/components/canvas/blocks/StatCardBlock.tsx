"use client";

import * as React from "react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ResponsiveContainer } from "recharts";
import { useResolvedValue, useResolvedData, formatValue } from "../use-resolved-data";
import { useChartColors } from "../use-chart-colors";
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
export function StatCardBlock({ config }: { config: any }) {
    const rawValue = useResolvedValue(config.value);
    const trendValue = useResolvedValue(config.trend?.value);
    const sparklineRaw = useResolvedData(config.sparklineData);
    const chartColors = useChartColors();

    const displayValue = formatValue(rawValue, config.format, config.prefix, config.suffix);
    const colorClass = colorMap[config.color || "default"] || "";

    // Normalize sparkline data
    const sparkData = React.useMemo(() => {
        if (!Array.isArray(sparklineRaw)) return null;
        return sparklineRaw.map((item: unknown, idx: number) => ({
            value: typeof item === "number" ? item : Number(item) || 0,
            idx
        }));
    }, [sparklineRaw]);

    const sparkColor = chartColors[0] || "oklch(0.57 0.26 230)";
    const sparkType = config.sparklineType || "line";

    return (
        <div
            className={cn(
                "bg-card text-card-foreground rounded-lg border p-4 shadow-sm",
                colorClass,
                config.className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    {(config.icon || config.title) && (
                        <div className="mb-1 flex items-center gap-2">
                            {config.icon && <span className="text-lg">{config.icon}</span>}
                            {config.title && (
                                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                    {config.title}
                                </p>
                            )}
                        </div>
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
                                {config.trend.direction === "up" && "\u2191"}
                                {config.trend.direction === "down" && "\u2193"}
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

                {/* Sparkline */}
                {sparkData && sparkData.length > 1 && (
                    <div className="flex-shrink-0" style={{ width: 80, height: 32 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {sparkType === "bar" ? (
                                <BarChart data={sparkData}>
                                    <Bar dataKey="value" fill={sparkColor} radius={[1, 1, 0, 0]} />
                                </BarChart>
                            ) : sparkType === "area" ? (
                                <AreaChart data={sparkData}>
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={sparkColor}
                                        fill={sparkColor}
                                        fillOpacity={0.2}
                                        strokeWidth={1.5}
                                    />
                                </AreaChart>
                            ) : (
                                <LineChart data={sparkData}>
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={sparkColor}
                                        dot={false}
                                        strokeWidth={1.5}
                                    />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
