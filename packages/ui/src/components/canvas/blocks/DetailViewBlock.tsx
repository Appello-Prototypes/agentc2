"use client";

import * as React from "react";
import { useResolvedData, formatValue } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DetailViewBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = rawData && typeof rawData === "object" ? rawData : {};

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <div className="grid grid-cols-12 gap-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(config.fields || []).map((field: any) => (
                    <div key={field.key} style={{ gridColumn: `span ${field.span || 6}` }}>
                        <dt className="text-muted-foreground text-xs font-medium">{field.label}</dt>
                        <dd className="mt-0.5 text-sm">
                            {formatValue(
                                (data as Record<string, unknown>)[field.key],
                                field.format
                            )}
                        </dd>
                    </div>
                ))}
            </div>
            {config.actions && config.actions.length > 0 && (
                <div className="mt-4 flex gap-2 border-t pt-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {config.actions.map((action: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => {
                                if (action.type === "link" && action.href) {
                                    window.open(action.href, "_blank");
                                } else if (action.type === "navigate" && action.target) {
                                    window.location.href = action.target;
                                }
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            {action.icon && <span className="mr-1.5">{action.icon}</span>}
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </BlockWrapper>
    );
}
