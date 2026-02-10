"use client";

import * as React from "react";
import { useCanvasData } from "../CanvasRenderer";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FilterBarBlock({ config }: { config: any }) {
    const { filters, setFilter } = useCanvasData();

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <div className="flex flex-wrap items-end gap-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(config.filters || []).map((filter: any) => (
                    <div key={filter.id} className="flex flex-col gap-1">
                        <label className="text-muted-foreground text-xs font-medium">
                            {filter.label}
                        </label>
                        {filter.type === "select" ? (
                            <select
                                value={String(filters[filter.id] ?? filter.defaultValue ?? "")}
                                onChange={(e) => setFilter(filter.id, e.target.value)}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
                                value={String(filters[filter.id] ?? filter.defaultValue ?? "")}
                                onChange={(e) => setFilter(filter.id, e.target.value)}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            />
                        ) : filter.type === "number" ? (
                            <input
                                type="number"
                                value={String(filters[filter.id] ?? filter.defaultValue ?? "")}
                                placeholder={filter.placeholder}
                                onChange={(e) => setFilter(filter.id, e.target.value)}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring w-32 rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={String(filters[filter.id] ?? filter.defaultValue ?? "")}
                                placeholder={filter.placeholder || "Search..."}
                                onChange={(e) => setFilter(filter.id, e.target.value)}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            />
                        )}
                    </div>
                ))}
            </div>
        </BlockWrapper>
    );
}
