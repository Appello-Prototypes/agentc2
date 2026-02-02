"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@repo/ui";

interface AgentVersion {
    id: string;
    version: number;
    createdAt: string;
    createdBy: string;
    description: string;
    changes: string[];
    isActive: boolean;
    modelProvider: string;
    modelName: string;
    stats: {
        runs: number;
        successRate: number;
        avgQuality: number;
    } | null;
}

export default function VersionsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<AgentVersion[]>([]);
    // Store mount time in state (lazy initializer only runs once)
    const [now] = useState(() => Date.now());

    const fetchVersions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/versions`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch versions");
            }

            // Transform API response to match our interface
            const transformedVersions: AgentVersion[] = result.versions.map(
                (v: {
                    id: string;
                    version: number;
                    description: string;
                    modelProvider: string;
                    modelName: string;
                    changesJson?: string[];
                    createdBy?: string;
                    createdAt: string;
                    isActive: boolean;
                    stats?: { runs: number; successRate: number; avgQuality: number };
                }) => ({
                    id: v.id,
                    version: v.version,
                    createdAt: v.createdAt,
                    createdBy: v.createdBy || "Unknown",
                    description: v.description || `Version ${v.version}`,
                    changes: v.changesJson || [],
                    isActive: v.isActive,
                    modelProvider: v.modelProvider,
                    modelName: v.modelName,
                    stats: v.stats || null
                })
            );

            setVersions(transformedVersions);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load versions");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Version History</h1>
                    <p className="text-muted-foreground">
                        Track changes, compare versions, and rollback if needed
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchVersions}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const activeVersion = versions.find((v) => v.isActive);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Version History</h1>
                    <p className="text-muted-foreground">
                        Track changes, compare versions, and rollback if needed
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Compare Versions</Button>
                    <Button variant="outline">Export History</Button>
                </div>
            </div>

            {/* Active Version Highlight */}
            {activeVersion && (
                <Card className="border-primary bg-primary/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Badge className="px-3 py-1 text-lg">
                                    v{activeVersion.version}
                                </Badge>
                                <div>
                                    <CardTitle>Current Active Version</CardTitle>
                                    <CardDescription>{activeVersion.description}</CardDescription>
                                </div>
                            </div>
                            <Badge variant="default">Active</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Runs</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats?.runs ?? 0}
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Success Rate</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats?.successRate ?? 0}%
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Quality</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats?.avgQuality ?? 0}%
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Deployed</p>
                                <p className="text-lg font-medium">
                                    {Math.floor(
                                        (now - new Date(activeVersion.createdAt).getTime()) /
                                            (1000 * 60 * 60 * 24)
                                    )}{" "}
                                    days ago
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Version List */}
            <Card>
                <CardHeader>
                    <CardTitle>All Versions</CardTitle>
                    <CardDescription>{versions.length} versions total</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {versions.map((version, index) => (
                            <div
                                key={version.version}
                                className={`relative pb-8 pl-8 ${index === versions.length - 1 ? "" : "border-muted ml-3 border-l-2"}`}
                            >
                                {/* Timeline dot */}
                                <div
                                    className={`absolute left-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full ${
                                        version.isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    <span className="text-xs font-bold">{version.version}</span>
                                </div>

                                {/* Version Card */}
                                <div
                                    className={`rounded-lg border p-4 ${version.isActive ? "border-primary" : ""}`}
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div>
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="font-medium">
                                                    Version {version.version}
                                                </span>
                                                {version.isActive && <Badge>Active</Badge>}
                                            </div>
                                            <p className="text-muted-foreground text-sm">
                                                {version.description}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm">
                                                {new Date(version.createdAt).toLocaleDateString()}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {version.createdBy}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Changes */}
                                    <div className="mb-3">
                                        <p className="text-muted-foreground mb-1 text-xs">
                                            Changes:
                                        </p>
                                        <ul className="space-y-1 text-sm">
                                            {version.changes.map((change, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <span className="text-primary">•</span>
                                                    {change}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Stats */}
                                    <div className="mb-3 flex items-center gap-4">
                                        <span className="text-muted-foreground text-xs">
                                            {version.stats?.runs ?? 0} runs
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {version.stats?.successRate ?? 0}% success
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {version.stats?.avgQuality ?? 0}% quality
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="sm">
                                            View Details
                                        </Button>
                                        <Button variant="ghost" size="sm">
                                            Compare
                                        </Button>
                                        {!version.isActive && (
                                            <AlertDialog>
                                                <AlertDialogTrigger>
                                                    <Button variant="outline" size="sm">
                                                        Rollback to v{version.version}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            Rollback to Version {version.version}?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will restore the agent
                                                            configuration from{" "}
                                                            {new Date(
                                                                version.createdAt
                                                            ).toLocaleDateString()}
                                                            . A new version (v
                                                            {versions[0].version + 1}) will be
                                                            created with the restored settings.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>
                                                            Cancel
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction>
                                                            Rollback
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Version Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle>Version Comparison</CardTitle>
                    <CardDescription>Compare performance across versions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">Version</th>
                                    <th className="px-4 py-3 text-right font-medium">Runs</th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Success Rate
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">Quality</th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        vs Previous
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map((version, i) => {
                                    const prev = versions[i + 1];
                                    const versionQuality = version.stats?.avgQuality ?? 0;
                                    const prevQuality = prev?.stats?.avgQuality ?? 0;
                                    const qualityDiff =
                                        prev && version.stats && prev.stats
                                            ? versionQuality - prevQuality
                                            : 0;

                                    return (
                                        <tr
                                            key={version.version}
                                            className="hover:bg-muted/50 border-b"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={
                                                            version.isActive ? "default" : "outline"
                                                        }
                                                    >
                                                        v{version.version}
                                                    </Badge>
                                                    {version.isActive && (
                                                        <span className="text-muted-foreground text-xs">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {version.stats?.runs ?? 0}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {version.stats?.successRate ?? 0}%
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {version.stats?.avgQuality ?? 0}%
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {qualityDiff !== 0 && (
                                                    <span
                                                        className={
                                                            qualityDiff > 0
                                                                ? "text-green-600"
                                                                : "text-red-600"
                                                        }
                                                    >
                                                        {qualityDiff > 0 ? "↑" : "↓"}{" "}
                                                        {Math.abs(qualityDiff)}%
                                                    </span>
                                                )}
                                                {qualityDiff === 0 && i < versions.length - 1 && (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
