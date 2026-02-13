"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { AgentVersion } from "./types";

interface VersionTrendChartProps {
    versions: AgentVersion[];
    onVersionClick?: (version: AgentVersion) => void;
}

export function VersionTrendChart({ versions, onVersionClick }: VersionTrendChartProps) {
    // Reverse so oldest is first (left to right)
    const data = [...versions]
        .reverse()
        .filter((v) => v.stats.runs > 0)
        .map((v) => ({
            version: `v${v.version}`,
            quality: v.stats.avgQuality,
            successRate: v.stats.successRate,
            _raw: v
        }));

    if (data.length < 2) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Version Performance Trends</CardTitle>
                <CardDescription>
                    Quality and success rate across versions with data
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                        data={data}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onClick={(e: any) => {
                            if (e?.activePayload?.[0]?.payload?._raw && onVersionClick) {
                                onVersionClick(e.activePayload[0].payload._raw);
                            }
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                            dataKey="version"
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: 12
                            }}
                            /* eslint-disable @typescript-eslint/no-explicit-any */
                            formatter={
                                ((value: any, name: any) => [
                                    `${value}%`,
                                    name === "quality" ? "Quality" : "Success Rate"
                                ]) as any
                            }
                            /* eslint-enable @typescript-eslint/no-explicit-any */
                        />
                        <Legend
                            formatter={(value: string) =>
                                value === "quality" ? "Quality" : "Success Rate"
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="quality"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 4, cursor: "pointer" }}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="successRate"
                            stroke="hsl(142, 76%, 36%)"
                            strokeWidth={2}
                            dot={{ r: 4, cursor: "pointer" }}
                            activeDot={{ r: 6 }}
                            strokeDasharray="5 5"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
