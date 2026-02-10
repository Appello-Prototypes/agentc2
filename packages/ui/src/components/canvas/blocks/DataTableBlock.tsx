"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../table";
import { useResolvedData, formatValue } from "../use-resolved-data";
import { cn } from "../../../lib/utils";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTableBlock({ config }: { config: any }) {
    const rawData = useResolvedData(config.data);
    const [sortKey, setSortKey] = React.useState<string | null>(null);
    const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);

    const data = Array.isArray(rawData) ? rawData : [];
    const columns = config.columns || [];
    const pageSize = config.pageSize || 10;

    // Filter by search
    const filtered = React.useMemo(() => {
        if (!search || !config.searchable) return data;
        const term = search.toLowerCase();
        return data.filter((row: Record<string, unknown>) =>
            columns.some(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (col: any) =>
                    String(row[col.key] ?? "")
                        .toLowerCase()
                        .includes(term)
            )
        );
    }, [data, search, config.searchable, columns]);

    // Sort
    const sorted = React.useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aVal = (a as any)[sortKey];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bVal = (b as any)[sortKey];
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDir === "desc" ? -cmp : cmp;
        });
    }, [filtered, sortKey, sortDir]);

    // Paginate
    const totalPages = Math.ceil(sorted.length / pageSize);
    const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            {config.searchable && (
                <div className="mb-3">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        {columns
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .filter((col: any) => !col.hidden)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .map((col: any) => (
                                <TableHead
                                    key={col.key}
                                    className={cn(
                                        col.sortable &&
                                            "hover:bg-muted/50 cursor-pointer select-none",
                                        col.align === "center" && "text-center",
                                        col.align === "right" && "text-right"
                                    )}
                                    style={col.width ? { width: col.width } : undefined}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                >
                                    {col.label}
                                    {sortKey === col.key && (
                                        <span className="ml-1">
                                            {sortDir === "asc" ? "↑" : "↓"}
                                        </span>
                                    )}
                                </TableHead>
                            ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginated.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={
                                    columns.filter((c: { hidden?: boolean }) => !c.hidden).length
                                }
                                className="text-muted-foreground py-8 text-center"
                            >
                                {config.emptyMessage || "No data available"}
                            </TableCell>
                        </TableRow>
                    ) : (
                        paginated.map((row: Record<string, unknown>, idx: number) => (
                            <TableRow
                                key={idx}
                                className={cn(config.striped && idx % 2 === 1 && "bg-muted/30")}
                            >
                                {columns
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    .filter((col: any) => !col.hidden)
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    .map((col: any) => (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                config.compact && "py-1",
                                                col.align === "center" && "text-center",
                                                col.align === "right" && "text-right"
                                            )}
                                        >
                                            {col.format === "badge" ? (
                                                <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                                                    {String(row[col.key] ?? "")}
                                                </span>
                                            ) : col.format === "link" ? (
                                                <a
                                                    href={String(row[col.key] ?? "#")}
                                                    className="text-primary underline"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {String(row[col.key] ?? "")}
                                                </a>
                                            ) : (
                                                formatValue(row[col.key], col.format)
                                            )}
                                        </TableCell>
                                    ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Pagination and Export */}
            {(totalPages > 1 || sorted.length > 0) && (
                <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{sorted.length} results</span>
                        {sorted.length > 0 && (
                            <button
                                onClick={() => {
                                    const visibleCols = columns.filter(
                                        (c: { hidden?: boolean }) => !c.hidden
                                    );
                                    const header = visibleCols
                                        .map((c: { label: string }) => c.label)
                                        .join(",");
                                    const rows = sorted.map((row: Record<string, unknown>) =>
                                        visibleCols
                                            .map((col: { key: string }) => {
                                                const val = String(row[col.key] ?? "");
                                                return val.includes(",") || val.includes('"')
                                                    ? `"${val.replace(/"/g, '""')}"`
                                                    : val;
                                            })
                                            .join(",")
                                    );
                                    const csv = [header, ...rows].join("\n");
                                    const blob = new Blob([csv], {
                                        type: "text/csv;charset=utf-8;"
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `${config.title || "data"}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="text-muted-foreground hover:text-foreground text-xs underline"
                            >
                                Export CSV
                            </button>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span className="px-2 py-1 text-xs">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </BlockWrapper>
    );
}
