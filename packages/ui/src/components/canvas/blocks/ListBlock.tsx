"use client";

import * as React from "react";
import { useResolvedData } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ListBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            {data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                    {config.emptyMessage || "No items"}
                </p>
            ) : (
                <div className="divide-y">
                    {data.map((item: Record<string, unknown>, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 py-2.5">
                            {config.imageKey && item[config.imageKey] && (
                                <img
                                    src={String(item[config.imageKey])}
                                    alt=""
                                    className="size-8 rounded-full object-cover"
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                    {String(item[config.titleKey] ?? "")}
                                </div>
                                {config.descriptionKey && item[config.descriptionKey] && (
                                    <div className="text-muted-foreground truncate text-xs">
                                        {String(item[config.descriptionKey])}
                                    </div>
                                )}
                            </div>
                            {config.badgeKey && item[config.badgeKey] && (
                                <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                    {String(item[config.badgeKey])}
                                </span>
                            )}
                            {config.actions && config.actions.length > 0 && (
                                <div className="flex gap-1">
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {config.actions.map((action: any, actionIdx: number) => (
                                        <button
                                            key={actionIdx}
                                            onClick={() => {
                                                if (action.type === "link" && action.href) {
                                                    window.open(action.href, "_blank");
                                                } else if (
                                                    action.type === "navigate" &&
                                                    action.target
                                                ) {
                                                    window.location.href = action.target;
                                                }
                                            }}
                                            className="text-primary text-xs hover:underline"
                                        >
                                            {action.icon && (
                                                <span className="mr-0.5">{action.icon}</span>
                                            )}
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </BlockWrapper>
    );
}
