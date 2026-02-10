"use client";

import * as React from "react";
import {
    BarChart,
    Bar,
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
export function BarChartBlock({ config }: { config: any }) {
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
                <BarChart
                    data={data}
                    layout={config.orientation === "horizontal" ? "vertical" : "horizontal"}
                >
                    {config.showGrid !== false && (
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    )}
                    {config.orientation === "horizontal" ? (
                        <>
                            <YAxis dataKey={config.xAxis} type="category" className="text-xs" />
                            <XAxis type="number" className="text-xs" />
                        </>
                    ) : (
                        <>
                            <XAxis dataKey={config.xAxis} className="text-xs" />
                            <YAxis className="text-xs" />
                        </>
                    )}
                    {config.showTooltip !== false && <Tooltip />}
                    {config.showLegend !== false && yAxisKeys.length > 1 && <Legend />}
                    {yAxisKeys.map((key: string, idx: number) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            fill={colors[idx % colors.length]}
                            stackId={config.stacked ? "stack" : undefined}
                            radius={[2, 2, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </BlockWrapper>
    );
}
