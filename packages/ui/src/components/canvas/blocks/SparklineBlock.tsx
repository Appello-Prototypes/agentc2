"use client";

import * as React from "react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ResponsiveContainer } from "recharts";
import { useResolvedData } from "../use-resolved-data";
import { useChartColors } from "../use-chart-colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SparklineBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const arr = Array.isArray(rawData) ? rawData : [];
    const chartColors = useChartColors(config.color ? [config.color] : undefined);
    const color = chartColors[0]!;
    const height = config.height || 40;
    const width = config.width || 120;
    const chartType = config.chartType || "line";

    // Normalize data to [{value: number}] format
    const data = arr.map((item: unknown, idx: number) => {
        if (typeof item === "number") return { value: item, idx };
        if (typeof item === "object" && item !== null && config.valueKey) {
            return { value: Number((item as Record<string, unknown>)[config.valueKey]) || 0, idx };
        }
        return { value: Number(item) || 0, idx };
    });

    const renderChart = () => {
        switch (chartType) {
            case "bar":
                return (
                    <BarChart data={data}>
                        <Bar dataKey="value" fill={color} radius={[1, 1, 0, 0]} />
                    </BarChart>
                );
            case "area":
                return (
                    <AreaChart data={data}>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            fill={color}
                            fillOpacity={0.2}
                            strokeWidth={1.5}
                        />
                    </AreaChart>
                );
            default:
                return (
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            dot={config.showDots || false}
                            strokeWidth={1.5}
                        />
                    </LineChart>
                );
        }
    };

    return (
        <div style={{ width, height }} className={config.className}>
            <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
            </ResponsiveContainer>
        </div>
    );
}
