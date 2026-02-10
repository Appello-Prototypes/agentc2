"use client";

import * as React from "react";
import { useResolvedData } from "../use-resolved-data";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function KanbanBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const data = Array.isArray(rawData) ? rawData : [];

    const columns = config.columns || [];

    // Group items by column
    const grouped = React.useMemo(() => {
        const groups: Record<string, Record<string, unknown>[]> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const col of columns as any[]) {
            groups[col.value] = [];
        }
        for (const item of data) {
            const colVal = String((item as Record<string, unknown>)[config.columnKey] ?? "");
            if (groups[colVal]) {
                groups[colVal]!.push(item as Record<string, unknown>);
            }
        }
        return groups;
    }, [data, columns, config.columnKey]);

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
            noPadding
        >
            <div className="flex gap-3 overflow-x-auto p-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {columns.map((col: any) => (
                    <div key={col.value} className="min-w-[250px] flex-1">
                        <div className="mb-2 flex items-center gap-2">
                            {col.color && (
                                <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: col.color }}
                                />
                            )}
                            <span className="text-xs font-semibold tracking-wider uppercase">
                                {col.label}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                ({grouped[col.value]?.length || 0})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {(grouped[col.value] || []).map((item, idx) => (
                                <div key={idx} className="bg-card rounded-md border p-3 shadow-sm">
                                    <div className="text-sm font-medium">
                                        {String(item[config.titleKey] ?? "")}
                                    </div>
                                    {config.descriptionKey && item[config.descriptionKey] && (
                                        <div className="text-muted-foreground mt-1 text-xs">
                                            {String(item[config.descriptionKey])}
                                        </div>
                                    )}
                                    {config.assigneeKey && item[config.assigneeKey] && (
                                        <div className="text-muted-foreground mt-2 text-xs">
                                            {String(item[config.assigneeKey])}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </BlockWrapper>
    );
}
