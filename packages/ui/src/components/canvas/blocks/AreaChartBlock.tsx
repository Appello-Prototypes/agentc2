"use client";

import * as React from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import { useResolvedData } from "../use-resolved-data";
import { useChartColors } from "../use-chart-colors";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AreaChartBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];
    const yAxisKeys = Array.isArray(config.yAxis) ? config.yAxis : [config.yAxis];
    const colors = useChartColors(config.colors);
    const height = config.height || 300;

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data}>
                    {config.showGrid !== false && (
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    )}
                    <XAxis dataKey={config.xAxis} className="text-xs" />
                    <YAxis className="text-xs" />
                    {config.showTooltip !== false && <Tooltip />}
                    {config.showLegend !== false && yAxisKeys.length > 1 && <Legend />}
                    {yAxisKeys.map((key: string, idx: number) => (
                        <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={colors[idx % colors.length]}
                            fill={colors[idx % colors.length]}
                            fillOpacity={config.gradient !== false ? 0.2 : 0.6}
                            stackId={config.stacked ? "stack" : undefined}
                            strokeWidth={2}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </BlockWrapper>
    );
}
