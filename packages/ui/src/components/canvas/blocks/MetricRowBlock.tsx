"use client";

import * as React from "react";
import { useResolvedValue, formatValue } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MetricItem({ metric }: { metric: any }) {
    const rawValue = useResolvedValue(metric.value);
    const displayValue = formatValue(rawValue, metric.format, metric.prefix, metric.suffix);

    return (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-3 py-2">
            {metric.icon && <span className="text-lg">{metric.icon}</span>}
            <span className="text-2xl font-bold tabular-nums">{displayValue}</span>
            <span className="text-muted-foreground truncate text-xs font-medium">
                {metric.label}
            </span>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MetricRowBlock({ config }: { config: any }) {
    const metrics = config.metrics || [];

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <div className="divide-border flex divide-x">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {metrics.map((metric: any, idx: number) => (
                    <MetricItem key={idx} metric={metric} />
                ))}
            </div>
        </BlockWrapper>
    );
}
