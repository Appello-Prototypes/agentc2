"use client";

import { useMemo, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    Checkbox,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    HugeiconsIcon,
    Skeleton,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import {
    Archive01Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    Delete02Icon,
    Add01Icon
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
    describeScheduleFromCron,
    estimateMonthlyCost,
    formatRelativeTime,
    getColorClass,
    getSuccessRateColor,
    getTypeBadgeColor,
    getTypeLabel
} from "./helpers";
import { getAutomationHealth, getAutomationHealthStyles, healthSortOrder } from "./health";
import type { Automation } from "./types";

interface AutomationTableProps {
    automations: Automation[];
    loading: boolean;
    error: string | null;
    onToggle: (a: Automation) => void;
    toggling: string | null;
    onArchive: (a: Automation, archive: boolean) => void;
    archiving: string | null;
    onEdit: (a: Automation) => void;
    onDelete: (a: Automation) => void;
    showArchived: boolean;
    onShowArchivedChange: (v: boolean) => void;
    onNew: () => void;
    selectedIds: Set<string>;
    onSelectedIdsChange: (ids: Set<string>) => void;
    onBulkArchive: () => void;
    bulkArchiving: boolean;
    avgCostPerRun?: number;
}

type SortField = "health" | "name" | "runs" | "success" | "cost";
type SortDir = "asc" | "desc";

export function AutomationTable({
    automations,
    loading,
    error,
    onToggle,
    toggling,
    onArchive,
    archiving,
    onEdit,
    onDelete,
    showArchived,
    onShowArchivedChange,
    onNew,
    selectedIds,
    onSelectedIdsChange,
    onBulkArchive,
    bulkArchiving,
    avgCostPerRun = 0.01
}: AutomationTableProps) {
    const [sortField, setSortField] = useState<SortField>("health");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const selectableAutomations = useMemo(
        () => automations.filter((a) => !a.isArchived),
        [automations]
    );

    const sorted = useMemo(() => {
        const items = [...automations];
        items.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "health": {
                    const ha = healthSortOrder[getAutomationHealth(a.stats.successRate)];
                    const hb = healthSortOrder[getAutomationHealth(b.stats.successRate)];
                    cmp = ha - hb;
                    break;
                }
                case "name":
                    cmp = a.name.localeCompare(b.name);
                    break;
                case "runs":
                    cmp = a.stats.totalRuns - b.stats.totalRuns;
                    break;
                case "success":
                    cmp = a.stats.successRate - b.stats.successRate;
                    break;
                case "cost": {
                    const ca = a.config.cronExpr
                        ? estimateMonthlyCost(a.config.cronExpr, avgCostPerRun)
                        : 0;
                    const cb = b.config.cronExpr
                        ? estimateMonthlyCost(b.config.cronExpr, avgCostPerRun)
                        : 0;
                    cmp = ca - cb;
                    break;
                }
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
        return items;
    }, [automations, sortField, sortDir, avgCostPerRun]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Switch checked={showArchived} onCheckedChange={onShowArchivedChange} />
                    <span className="text-muted-foreground text-sm">Show archived</span>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onBulkArchive}
                            disabled={bulkArchiving}
                        >
                            <HugeiconsIcon icon={Archive01Icon} className="mr-1.5 size-4" />
                            {bulkArchiving
                                ? "Archiving..."
                                : `Archive ${selectedIds.size} selected`}
                        </Button>
                    )}
                    <Button size="sm" onClick={onNew}>
                        <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                        New Automation
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] pl-4">
                                    <Checkbox
                                        checked={
                                            selectableAutomations.length > 0 &&
                                            selectableAutomations.every((a) =>
                                                selectedIds.has(a.id)
                                            )
                                        }
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                onSelectedIdsChange(
                                                    new Set(selectableAutomations.map((a) => a.id))
                                                );
                                            } else {
                                                onSelectedIdsChange(new Set());
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="w-[80px]">Type</TableHead>
                                <TableHead>
                                    <button
                                        className="hover:text-foreground"
                                        onClick={() => toggleSort("name")}
                                    >
                                        Name{" "}
                                        {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                                    </button>
                                </TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead className="w-[80px]">Status</TableHead>
                                <TableHead>Config</TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="hover:text-foreground"
                                        onClick={() => toggleSort("runs")}
                                    >
                                        Runs{" "}
                                        {sortField === "runs" && (sortDir === "asc" ? "↑" : "↓")}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="hover:text-foreground"
                                        onClick={() => toggleSort("success")}
                                    >
                                        Success{" "}
                                        {sortField === "success" && (sortDir === "asc" ? "↑" : "↓")}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="hover:text-foreground"
                                        onClick={() => toggleSort("cost")}
                                    >
                                        Est. Cost/mo{" "}
                                        {sortField === "cost" && (sortDir === "asc" ? "↑" : "↓")}
                                    </button>
                                </TableHead>
                                <TableHead>Last Run</TableHead>
                                <TableHead>Next Run</TableHead>
                                <TableHead className="w-[48px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={12}
                                        className="text-muted-foreground py-8 text-center"
                                    >
                                        No automations found.{" "}
                                        <button
                                            onClick={onNew}
                                            className="text-primary underline-offset-4 hover:underline"
                                        >
                                            Create one
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sorted.map((auto) => {
                                    const health = getAutomationHealth(auto.stats.successRate);
                                    const healthStyles = getAutomationHealthStyles(
                                        auto.stats.successRate
                                    );
                                    const needsAttention =
                                        auto.stats.totalRuns > 0 &&
                                        (health === "unstable" || health === "failing");
                                    const monthlyCost = auto.config.cronExpr
                                        ? estimateMonthlyCost(auto.config.cronExpr, avgCostPerRun)
                                        : null;

                                    return (
                                        <TableRow
                                            key={auto.id}
                                            className={cn(
                                                auto.isArchived && "opacity-50",
                                                !auto.isArchived &&
                                                    auto.stats.totalRuns > 0 &&
                                                    `border-l-2 ${healthStyles.border}`
                                            )}
                                        >
                                            <TableCell className="pl-4">
                                                {!auto.isArchived && (
                                                    <Checkbox
                                                        checked={selectedIds.has(auto.id)}
                                                        onCheckedChange={(checked) => {
                                                            const next = new Set(selectedIds);
                                                            if (checked) {
                                                                next.add(auto.id);
                                                            } else {
                                                                next.delete(auto.id);
                                                            }
                                                            onSelectedIdsChange(next);
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] ${getTypeBadgeColor(auto.type)}`}
                                                >
                                                    {getTypeLabel(auto.type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-medium">
                                                            {auto.name}
                                                        </div>
                                                        {auto.description && (
                                                            <div className="text-muted-foreground max-w-[200px] truncate text-xs">
                                                                {auto.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {needsAttention && (
                                                        <span
                                                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${healthStyles.badge}`}
                                                        >
                                                            {health === "failing"
                                                                ? "Failing"
                                                                : "Attention"}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {auto.agent?.name || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={auto.isActive}
                                                    disabled={
                                                        toggling === auto.id || auto.isArchived
                                                    }
                                                    onCheckedChange={() => onToggle(auto)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {auto.config.color && (
                                                        <div
                                                            className={`size-2.5 shrink-0 rounded-full ${getColorClass(auto.config.color) || "bg-gray-400"}`}
                                                        />
                                                    )}
                                                    <span className="text-muted-foreground text-xs">
                                                        {auto.config.cronExpr
                                                            ? describeScheduleFromCron(
                                                                  auto.config.cronExpr
                                                              )
                                                            : auto.config.eventName ||
                                                              auto.config.webhookPath ||
                                                              "—"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {auto.stats.totalRuns}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span
                                                    className={`tabular-nums ${getSuccessRateColor(auto.stats.successRate)}`}
                                                >
                                                    {auto.stats.totalRuns > 0
                                                        ? `${auto.stats.successRate.toFixed(0)}%`
                                                        : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-muted-foreground text-xs tabular-nums">
                                                    {monthlyCost != null
                                                        ? `$${monthlyCost.toFixed(2)}`
                                                        : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-muted-foreground text-xs">
                                                    {formatRelativeTime(auto.stats.lastRunAt)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-muted-foreground text-xs">
                                                    {auto.stats.nextRunAt
                                                        ? formatRelativeTime(auto.stats.nextRunAt)
                                                        : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger className="hover:bg-accent flex size-7 items-center justify-center rounded">
                                                        <HugeiconsIcon
                                                            icon={MoreHorizontalIcon}
                                                            className="size-4"
                                                        />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-44"
                                                    >
                                                        <DropdownMenuItem
                                                            onClick={() => onEdit(auto)}
                                                        >
                                                            <HugeiconsIcon
                                                                icon={PencilEdit02Icon}
                                                                className="mr-2 size-3.5"
                                                            />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                onArchive(auto, !auto.isArchived)
                                                            }
                                                            disabled={archiving === auto.id}
                                                        >
                                                            <HugeiconsIcon
                                                                icon={Archive01Icon}
                                                                className="mr-2 size-3.5"
                                                            />
                                                            {auto.isArchived
                                                                ? "Unarchive"
                                                                : "Archive"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => onDelete(auto)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <HugeiconsIcon
                                                                icon={Delete02Icon}
                                                                className="mr-2 size-3.5"
                                                            />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
