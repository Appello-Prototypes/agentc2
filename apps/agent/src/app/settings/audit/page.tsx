"use client";

import { useEffect, useState, useCallback } from "react";
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
    TableRow,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AuditLogEntry {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    metadata: Record<string, unknown> | null;
    integrityHash: string | null;
    createdAt: string;
}

interface VerifyResult {
    verified: boolean;
    totalChecked: number;
    firstBreak: { id: string; createdAt: string } | null;
    chainIntact: boolean;
}

const ACTION_TYPES = [
    "AGENT_CREATE",
    "AGENT_UPDATE",
    "AGENT_DELETE",
    "VERSION_CREATE",
    "CONFIG_CHANGE",
    "TOOL_ATTACH",
    "TOOL_DETACH",
    "CREDENTIAL_CREATE",
    "CREDENTIAL_UPDATE",
    "INTEGRATION_UPDATE",
    "INTEGRATION_DELETE",
    "DATA_ACCESS",
    "ORG_GUARDRAIL_UPDATE",
    "GUARDRAIL_UPDATE"
] as const;

const ENTITY_TYPES = [
    "Agent",
    "AgentVersion",
    "Workflow",
    "Network",
    "IntegrationConnection",
    "GuardrailPolicy",
    "OrgGuardrailPolicy",
    "Document"
] as const;

const PAGE_SIZE = 50;

function HashCell({ hash }: { hash: string | null }) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    if (!hash) return <span className="text-muted-foreground text-xs">—</span>;

    const display = expanded ? hash : `${hash.slice(0, 12)}…`;
    const handleClick = () => {
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={() => {
                setExpanded(!expanded);
                handleClick();
            }}
            className="cursor-pointer text-left font-mono text-xs hover:underline"
            title={hash}
        >
            {display}
            {copied && <span className="text-muted-foreground ml-1 text-[10px]">(copied)</span>}
        </button>
    );
}

export default function AuditLogPage() {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [cursor, setCursor] = useState<string | null>(null);
    const [prevCursors, setPrevCursors] = useState<string[]>([]);
    const [hasMore, setHasMore] = useState(false);

    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterAction, setFilterAction] = useState<string>("");
    const [filterEntityType, setFilterEntityType] = useState<string>("");

    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

    const fetchLogs = useCallback(
        async (pageCursor?: string | null) => {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterAction) params.set("action", filterAction);
            if (filterEntityType) params.set("entityType", filterEntityType);
            if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
            if (filterTo) params.set("to", new Date(filterTo).toISOString());
            params.set("limit", String(PAGE_SIZE));
            if (pageCursor) params.set("cursor", pageCursor);

            try {
                const res = await fetch(`${getApiBase()}/api/audit-logs?${params.toString()}`);
                const data = await res.json();
                if (data.success) {
                    setEntries(data.logs);
                    setHasMore(data.hasMore ?? false);
                    setCursor(data.nextCursor ?? null);
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        },
        [filterAction, filterEntityType, filterFrom, filterTo]
    );

    const fetchWithPrevCursor = useCallback(
        async (prevCursor: string) => {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterAction) params.set("action", filterAction);
            if (filterEntityType) params.set("entityType", filterEntityType);
            if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
            if (filterTo) params.set("to", new Date(filterTo).toISOString());
            params.set("limit", String(PAGE_SIZE));
            params.set("cursor", prevCursor);

            try {
                const res = await fetch(`${getApiBase()}/api/audit-logs?${params.toString()}`);
                const data = await res.json();
                if (data.success) {
                    setEntries(data.logs);
                    setHasMore(data.hasMore ?? false);
                    setCursor(data.nextCursor ?? null);
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        },
        [filterAction, filterEntityType, filterFrom, filterTo]
    );

    useEffect(() => {
        setPrevCursors([]);
        fetchLogs(null);
    }, [filterAction, filterEntityType, filterFrom, filterTo, fetchLogs]);

    const handleNextPage = () => {
        if (!cursor) return;
        setPrevCursors((p) => [...p, cursor]);
        fetchLogs(cursor);
    };

    const handlePrevPage = () => {
        const next = [...prevCursors];
        next.pop();
        setPrevCursors(next);
        const cursorToUse = next.length > 0 ? next[next.length - 1]! : null;
        if (cursorToUse) {
            fetchWithPrevCursor(cursorToUse);
        } else {
            fetchLogs(null);
        }
    };

    const handleVerify = async () => {
        setVerifyLoading(true);
        setVerifyResult(null);
        try {
            const res = await fetch(`${getApiBase()}/api/audit-logs/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: filterFrom ? new Date(filterFrom).toISOString() : undefined,
                    endDate: filterTo ? new Date(filterTo).toISOString() : undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setVerifyResult({
                    verified: data.verified,
                    totalChecked: data.totalChecked,
                    firstBreak: data.firstBreak
                        ? {
                              id: data.firstBreak.id,
                              createdAt:
                                  typeof data.firstBreak.createdAt === "string"
                                      ? data.firstBreak.createdAt
                                      : new Date(data.firstBreak.createdAt).toISOString()
                          }
                        : null,
                    chainIntact: data.chainIntact
                });
            }
        } catch {
            setVerifyResult({
                verified: false,
                totalChecked: 0,
                firstBreak: null,
                chainIntact: false
            });
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleExportCsv = () => {
        const headers = ["Timestamp", "Action", "Entity Type", "Entity ID", "Actor", "Hash"];
        const rows = entries.map((e) => [
            e.createdAt,
            e.action,
            e.entityType,
            e.entityId,
            e.actorId ?? "",
            e.integrityHash ?? ""
        ]);
        const csv = [
            headers.join(","),
            ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const canGoPrev = prevCursors.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/settings">
                    <Button variant="ghost" size="sm">
                        &larr; Back
                    </Button>
                </Link>
                <div>
                    <h2 className="text-xl font-semibold">Audit Log</h2>
                    <p className="text-muted-foreground text-sm">
                        Platform audit trail with integrity verification
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifyLoading}>
                    {verifyLoading ? "Verifying…" : "Verify Integrity"}
                </Button>
                {verifyResult && (
                    <Alert
                        variant={verifyResult.chainIntact ? "default" : "destructive"}
                        className={
                            verifyResult.chainIntact
                                ? "max-w-md flex-1 border-green-500/50 bg-green-500/10"
                                : "max-w-md flex-1"
                        }
                    >
                        <AlertDescription>
                            {verifyResult.chainIntact ? (
                                <>Chain intact. {verifyResult.totalChecked} entries verified.</>
                            ) : (
                                <>
                                    Chain broken. {verifyResult.totalChecked} checked. First break:{" "}
                                    {verifyResult.firstBreak?.id ?? "unknown"} at{" "}
                                    {verifyResult.firstBreak?.createdAt
                                        ? new Date(
                                              verifyResult.firstBreak.createdAt
                                          ).toLocaleString()
                                        : "—"}
                                </>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <Label className="text-xs">From</Label>
                            <Input
                                type="date"
                                value={filterFrom}
                                onChange={(e) => {
                                    setFilterFrom(e.target.value);
                                    setPrevCursors([]);
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
                                    setPrevCursors([]);
                                }}
                                className="mt-1"
                            />
                        </div>
                        <div className="min-w-[160px]">
                            <Label className="text-xs">Action</Label>
                            <Select
                                value={filterAction || "all"}
                                onValueChange={(v: string | null) => {
                                    setFilterAction(v === "all" ? "" : (v ?? ""));
                                    setPrevCursors([]);
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {ACTION_TYPES.map((a) => (
                                        <SelectItem key={a} value={a}>
                                            {a}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[180px]">
                            <Label className="text-xs">Entity Type</Label>
                            <Select
                                value={filterEntityType || "all"}
                                onValueChange={(v: string | null) => {
                                    setFilterEntityType(v === "all" ? "" : (v ?? ""));
                                    setPrevCursors([]);
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {ENTITY_TYPES.map((e) => (
                                        <SelectItem key={e} value={e}>
                                            {e}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportCsv}>
                            Export CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

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
                                        <TableHead>Entity Type</TableHead>
                                        <TableHead>Entity ID</TableHead>
                                        <TableHead>Actor</TableHead>
                                        <TableHead>Hash</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {new Date(entry.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono text-xs"
                                                >
                                                    {entry.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {entry.entityType}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate font-mono text-xs">
                                                {entry.entityId}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {entry.actorId ?? (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <HashCell hash={entry.integrityHash} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex items-center justify-between border-t px-4 py-3">
                                <p className="text-muted-foreground text-xs">
                                    {entries.length} entries on this page
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!canGoPrev}
                                        onClick={handlePrevPage}
                                    >
                                        Previous Page
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!hasMore}
                                        onClick={handleNextPage}
                                    >
                                        Next Page
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
