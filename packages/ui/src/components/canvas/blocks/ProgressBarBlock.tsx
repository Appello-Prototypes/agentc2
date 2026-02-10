"use client";

import * as React from "react";
import { useResolvedValue } from "../use-resolved-data";
import { useChartColors } from "../use-chart-colors";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProgressBarBlock({ config }: { config: any }) {
    const rawValue = useResolvedValue(config.value);
    const chartColors = useChartColors();
    const value = Number(rawValue) || 0;
    const max = config.max || 100;
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const barColor = config.color || chartColors[0];
    const height = config.height || 8;

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            {config.label && (
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{config.label}</span>
                    {config.showPercentage !== false && (
                        <span className="text-muted-foreground tabular-nums">
                            {percentage.toFixed(1)}%
                        </span>
                    )}
                </div>
            )}
            <div
                className="bg-muted w-full overflow-hidden rounded-full"
                style={{ height: `${height}px` }}
            >
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: barColor
                    }}
                />
            </div>
            {!config.label && config.showPercentage !== false && (
                <div className="text-muted-foreground mt-1 text-right text-xs tabular-nums">
                    {percentage.toFixed(1)}%
                </div>
            )}
        </BlockWrapper>
    );
}
