"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Skeleton,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface ToolPermission {
    id: string;
    toolId: string;
    permission: string;
    maxCostUsd: number | null;
}

const PERMISSION_OPTIONS = ["read_only", "write", "spend", "full"] as const;

export default function PermissionsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<ToolPermission[]>([]);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [bulkSaving, setBulkSaving] = useState(false);

    const fetchPermissions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/permissions`);
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to load permissions");
            }
            setPermissions(data.permissions || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load permissions");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const putPermission = async (toolId: string, permission: string, maxCostUsd: number | null) => {
        const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolId, permission, maxCostUsd })
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to save");
        }
        return data.permission;
    };

    const deletePermission = async (toolId: string) => {
        const res = await fetch(`${getApiBase()}/api/agents/${agentSlug}/permissions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolId })
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to reset");
        }
    };

    const handlePermissionChange = async (
        perm: ToolPermission,
        permission: string,
        maxCostUsd?: number | null
    ) => {
        const id = perm.id;
        setSavingId(id);
        try {
            const updated = await putPermission(
                perm.toolId,
                permission,
                maxCostUsd ?? (permission === "spend" ? perm.maxCostUsd : null)
            );
            setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSavingId(null);
        }
    };

    const handleMaxCostBlur = async (perm: ToolPermission, value: string) => {
        if (perm.permission !== "spend") return;
        const num = value === "" ? null : parseFloat(value);
        if (num !== null && (isNaN(num) || num < 0)) return;
        if (num === perm.maxCostUsd) return;
        setSavingId(perm.id);
        try {
            const updated = await putPermission(perm.toolId, perm.permission, num);
            setPermissions((prev) =>
                prev.map((p) => (p.id === perm.id ? { ...p, ...updated } : p))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSavingId(null);
        }
    };

    const handleReset = async (perm: ToolPermission) => {
        setSavingId(perm.id);
        try {
            await deletePermission(perm.toolId);
            setPermissions((prev) => prev.filter((p) => p.id !== perm.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reset");
        } finally {
            setSavingId(null);
        }
    };

    const handleBulkSet = async (permission: "read_only" | "full") => {
        if (permissions.length === 0) return;
        setBulkSaving(true);
        setError(null);
        try {
            for (const perm of permissions) {
                await putPermission(perm.toolId, permission, null);
            }
            setPermissions((prev) =>
                prev.map((p) => ({
                    ...p,
                    permission,
                    maxCostUsd: null
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply bulk action");
        } finally {
            setBulkSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Tool Permissions</h1>
                <p className="text-muted-foreground">
                    Control permission levels for individual tools
                </p>
            </div>

            {error && (
                <Card className="border-destructive">
                    <CardContent className="flex items-center justify-between py-4">
                        <p className="text-destructive text-sm">{error}</p>
                        <Button variant="outline" size="sm" onClick={fetchPermissions}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {permissions.length > 0 && (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={bulkSaving}
                        onClick={() => handleBulkSet("read_only")}
                    >
                        {bulkSaving ? "Applying..." : "Set All to Read Only"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={bulkSaving}
                        onClick={() => handleBulkSet("full")}
                    >
                        {bulkSaving ? "Applying..." : "Set All to Full"}
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Permission Overrides</CardTitle>
                    <CardDescription>
                        Override default permissions per tool. Tools without overrides default to
                        full permission.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {permissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-muted-foreground font-medium">
                                No permission overrides configured
                            </p>
                            <p className="text-muted-foreground mt-1 max-w-md text-sm">
                                All tools default to full permission.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tool ID</TableHead>
                                    <TableHead>Permission</TableHead>
                                    <TableHead>Max Cost (USD)</TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {permissions.map((perm) => (
                                    <TableRow key={perm.id}>
                                        <TableCell>
                                            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
                                                {perm.toolId}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={perm.permission}
                                                onValueChange={(v) => {
                                                    if (v) handlePermissionChange(perm, v);
                                                }}
                                                disabled={savingId === perm.id}
                                            >
                                                <SelectTrigger className="w-[140px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PERMISSION_OPTIONS.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>
                                                            {opt}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                placeholder="—"
                                                value={
                                                    perm.permission === "spend" &&
                                                    perm.maxCostUsd != null
                                                        ? String(perm.maxCostUsd)
                                                        : ""
                                                }
                                                disabled={perm.permission !== "spend"}
                                                onBlur={(e) =>
                                                    handleMaxCostBlur(perm, e.target.value)
                                                }
                                                className="w-24"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={savingId === perm.id}
                                                onClick={() => handleReset(perm)}
                                            >
                                                Reset
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
