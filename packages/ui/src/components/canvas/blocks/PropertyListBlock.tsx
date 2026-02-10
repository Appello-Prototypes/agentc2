"use client";

import * as React from "react";
import { useResolvedData, formatValue } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";
import { cn } from "../../../lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PropertyListBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};

    const properties =
        config.properties ||
        Object.keys(data).map((key: string) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
            format: "text"
        }));

    const isHorizontal = config.orientation === "horizontal";

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <dl className={cn(isHorizontal ? "flex flex-wrap gap-x-6 gap-y-2" : "space-y-2")}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {properties.map((prop: any) => (
                    <div
                        key={prop.key}
                        className={cn(
                            isHorizontal
                                ? "flex items-center gap-2"
                                : "flex items-center justify-between border-b py-1.5 last:border-0"
                        )}
                    >
                        <dt className="text-muted-foreground text-xs font-medium">{prop.label}</dt>
                        <dd className="text-sm">{formatValue(data[prop.key], prop.format)}</dd>
                    </div>
                ))}
            </dl>
        </BlockWrapper>
    );
}
