"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AuditEntry {
    id: string;
    action: string;
    actorType: string;
    actorId: string;
    resource: string;
    outcome: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
    const searchParams = useSearchParams();
    const connectionIdParam = searchParams.get("connectionId") ?? "";

    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);

    const [filterAction, setFilterAction] = useState("");
    const [filterOutcome, setFilterOutcome] = useState("all");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterAction) params.set("action", filterAction);
        if (filterOutcome && filterOutcome !== "all") params.set("outcome", filterOutcome);
        if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
        if (filterTo) params.set("to", new Date(filterTo).toISOString());
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));

        try {
            const res = await fetch(`${getApiBase()}/api/federation/audit?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setEntries(data.entries);
                setTotal(data.total);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [filterAction, filterOutcome, filterFrom, filterTo, offset]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = () => {
        const params = new URLSearchParams();
        if (filterAction) params.set("action", filterAction);
        if (filterOutcome && filterOutcome !== "all") params.set("outcome", filterOutcome);
        if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
        if (filterTo) params.set("to", new Date(filterTo).toISOString());
        params.set("limit", "10000");
        params.set("format", "csv");
        window.open(`${getApiBase()}/api/federation/audit?${params.toString()}`, "_blank");
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    const outcomeBadgeVariant = (outcome: string) => {
        if (outcome === "success") return "default" as const;
        if (outcome === "denied") return "outline" as const;
        return "destructive" as const;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href={
                        connectionIdParam !== ""
                            ? `/settings/connections/${connectionIdParam}`
                            : "/settings/connections"
                    }
                >
                    <Button variant="ghost" size="sm">
                        &larr; Back
                    </Button>
                </Link>
                <div>
                    <h2 className="text-xl font-semibold">Federation Audit Log</h2>
                    <p className="text-muted-foreground text-sm">
                        All security-relevant federation events
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[140px]">
                            <Label className="text-xs">Action</Label>
                            <Input
                                placeholder="e.g. federation."
                                value={filterAction}
                                onChange={(e) => {
                                    setFilterAction(e.target.value);
                                    setOffset(0);
                                }}
                                className="mt-1"
                            />
                        </div>
                        <div className="min-w-[120px]">
                            <Label className="text-xs">Outcome</Label>
                            <Select
                                value={filterOutcome}
                                onValueChange={(v: string | null) => {
                                    setFilterOutcome(v ?? "all");
                                    setOffset(0);
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="denied">Denied</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">From</Label>
                            <Input
                                type="date"
                                value={filterFrom}
                                onChange={(e) => {
                                    setFilterFrom(e.target.value);
                                    setOffset(0);
                                }}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">To</Label>
                            <Input
                                type="date"
                                value={filterTo}
                                onChange={(e) => {
                                    setFilterTo(e.target.value);
                                    setOffset(0);
                                }}
                                className="mt-1"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            Export CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-2 p-4">
                            <Skeleton className="h-8" />
                            <Skeleton className="h-8" />
                            <Skeleton className="h-8" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            No audit entries found.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Actor</TableHead>
                                        <TableHead>Resource</TableHead>
                                        <TableHead>Outcome</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {new Date(entry.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {entry.action}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <span className="text-muted-foreground">
                                                    {entry.actorType}:
                                                </span>{" "}
                                                {entry.actorId}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-xs">
                                                {entry.resource}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={outcomeBadgeVariant(entry.outcome)}
                                                    className="text-xs"
                                                >
                                                    {entry.outcome}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {/* Pagination */}
                            <div className="flex items-center justify-between border-t px-4 py-3">
                                <p className="text-muted-foreground text-xs">
                                    {total} entries &middot; Page {currentPage} of {totalPages || 1}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={offset === 0}
                                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={offset + PAGE_SIZE >= total}
                                        onClick={() => setOffset(offset + PAGE_SIZE)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
