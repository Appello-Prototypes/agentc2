"use client";

import * as React from "react";
import { useResolvedData } from "../use-resolved-data";
import { useChartColors } from "../use-chart-colors";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FunnelBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];
    const colors = useChartColors(config.colors);

    // Find max value for width calculation
    const maxValue =
        data.length > 0
            ? Math.max(...data.map((d: Record<string, unknown>) => Number(d[config.valueKey]) || 0))
            : 1;

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <div className="space-y-2">
                {data.map((item: Record<string, unknown>, idx: number) => {
                    const value = Number(item[config.valueKey]) || 0;
                    const widthPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    const color = colors[idx % colors.length];

                    return (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="flex-1">
                                <div
                                    className="flex items-center justify-between rounded px-3 py-2"
                                    style={{
                                        width: `${Math.max(widthPct, 20)}%`,
                                        backgroundColor: color,
                                        color: "white"
                                    }}
                                >
                                    {config.showLabels !== false && (
                                        <span className="truncate text-xs font-medium">
                                            {String(item[config.nameKey] ?? "")}
                                        </span>
                                    )}
                                    {config.showValues !== false && (
                                        <span className="ml-2 text-xs font-bold">
                                            {new Intl.NumberFormat().format(value)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {data.length === 0 && (
                    <p className="text-muted-foreground py-4 text-center text-sm">No data</p>
                )}
            </div>
        </BlockWrapper>
    );
}
