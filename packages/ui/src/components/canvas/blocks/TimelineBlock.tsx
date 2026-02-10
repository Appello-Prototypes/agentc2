"use client";

import * as React from "react";
import { useResolvedData } from "../use-resolved-data";
import { cn } from "../../../lib/utils";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TimelineBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <div className="relative space-y-4 pl-6">
                <div className="bg-border absolute top-0 bottom-0 left-2 w-px" />
                {data.map((item: Record<string, unknown>, idx: number) => {
                    const dotColor = config.colorKey && item[config.colorKey]
                        ? String(item[config.colorKey])
                        : undefined;
                    const icon = config.iconKey && item[config.iconKey]
                        ? String(item[config.iconKey])
                        : undefined;

                    return (
                        <div key={idx} className="relative">
                            {icon ? (
                                <span className="absolute -left-5 top-0.5 text-sm">{icon}</span>
                            ) : (
                                <div
                                    className={cn(
                                        "absolute top-1.5 -left-4 size-2 rounded-full",
                                        !dotColor && "bg-primary"
                                    )}
                                    style={dotColor ? { backgroundColor: dotColor } : undefined}
                                />
                            )}
                            <div className="text-muted-foreground mb-0.5 text-xs">
                                {item[config.dateKey]
                                    ? new Date(String(item[config.dateKey])).toLocaleString()
                                    : ""}
                            </div>
                            <div className="text-sm font-medium">
                                {String(item[config.titleKey] ?? "")}
                            </div>
                            {config.descriptionKey && item[config.descriptionKey] && (
                                <div className="text-muted-foreground mt-0.5 text-xs">
                                    {String(item[config.descriptionKey])}
                                </div>
                            )}
                        </div>
                    );
                })}
                {data.length === 0 && (
                    <p className="text-muted-foreground text-sm">No events to display</p>
                )}
            </div>
        </BlockWrapper>
    );
}
