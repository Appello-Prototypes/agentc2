"use client";

import * as React from "react";
import { useCanvasData } from "../CanvasRenderer";
import { cn } from "../../../lib/utils";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FilterBarBlock({ config }: { config: any }) {
    const { filters, setFilter } = useCanvasData();

    // Build a composite filter key from queryId + paramKey for proper binding
    const getFilterKey = (filter: { id: string; queryId?: string; paramKey?: string }) => {
        if (filter.queryId && filter.paramKey) {
            return `${filter.queryId}:${filter.paramKey}`;
        }
        return filter.id;
    };

    const handleFilterChange = (filter: { id: string; queryId?: string; paramKey?: string }, value: unknown) => {
        // Set both the composite key and the individual id for compatibility
        const key = getFilterKey(filter);
        setFilter(key, value);
        if (key !== filter.id) {
            setFilter(filter.id, value);
        }
    };

    const inputClass = "border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={cn("sticky top-0 z-10", config.className)}
        >
            <div className="flex flex-wrap items-end gap-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(config.filters || []).map((filter: any) => {
                    const filterKey = getFilterKey(filter);
                    const currentValue = filters[filterKey] ?? filters[filter.id] ?? filter.defaultValue ?? "";

                    return (
                        <div key={filter.id} className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">
                                {filter.label}
                            </label>
                            {filter.type === "select" ? (
                                <select
                                    value={String(currentValue)}
                                    onChange={(e) => handleFilterChange(filter, e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">{filter.placeholder || "All"}</option>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {(filter.options || []).map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            ) : filter.type === "date" || filter.type === "dateRange" ? (
                                <input
                                    type="date"
                                    value={String(currentValue)}
                                    onChange={(e) => handleFilterChange(filter, e.target.value)}
                                    className={inputClass}
                                />
                            ) : filter.type === "number" ? (
                                <input
                                    type="number"
                                    value={String(currentValue)}
                                    placeholder={filter.placeholder}
                                    onChange={(e) => handleFilterChange(filter, e.target.value)}
                                    className={cn(inputClass, "w-32")}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={String(currentValue)}
                                    placeholder={filter.placeholder || "Search..."}
                                    onChange={(e) => handleFilterChange(filter, e.target.value)}
                                    className={inputClass}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </BlockWrapper>
    );
}
