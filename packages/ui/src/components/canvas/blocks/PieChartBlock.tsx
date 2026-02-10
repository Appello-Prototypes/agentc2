"use client";

import * as React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useResolvedData } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";

const DEFAULT_COLORS = [
    "hsl(221 83% 53%)",
    "hsl(142 76% 36%)",
    "hsl(47 96% 53%)",
    "hsl(0 84% 60%)",
    "hsl(262 83% 58%)",
    "hsl(200 70% 50%)",
    "hsl(30 90% 55%)",
    "hsl(315 70% 50%)"
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PieChartBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];
    const colors = config.colors || DEFAULT_COLORS;
    const height = config.height || 300;

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey={config.valueKey}
                        nameKey={config.nameKey}
                        cx="50%"
                        cy="50%"
                        innerRadius={config.donut ? "55%" : 0}
                        outerRadius="80%"
                        label={config.showLabels || false}
                    >
                        {data.map((_: unknown, idx: number) => (
                            <Cell key={idx} fill={colors[idx % colors.length]} />
                        ))}
                    </Pie>
                    {config.showTooltip !== false && <Tooltip />}
                    {config.showLegend !== false && <Legend />}
                </PieChart>
            </ResponsiveContainer>
        </BlockWrapper>
    );
}
