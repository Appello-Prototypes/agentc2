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
    AlertDialogTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";

interface VersionSnapshot {
    name?: string;
    description?: string;
    instructions?: string;
    instructionsTemplate?: string;
    modelProvider?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    modelConfig?: Record<string, unknown>;
    memoryEnabled?: boolean;
    memoryConfig?: Record<string, unknown>;
    maxSteps?: number;
    scorers?: string[];
    tools?: Array<{ toolId: string; config?: Record<string, unknown> }>;
    isPublic?: boolean;
    metadata?: Record<string, unknown>;
}

interface AgentVersion {
    id: string;
    version: number;
    createdAt: string;
    createdBy: string;
    description: string;
    instructions: string;
    changes: string[];
    isActive: boolean;
    modelProvider: string;
    modelName: string;
    snapshot: VersionSnapshot | null;
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
    const [rollingBack, setRollingBack] = useState<number | null>(null);
    const [rollbackError, setRollbackError] = useState<string | null>(null);
    // Store mount time in state (lazy initializer only runs once)
    const [now] = useState(() => Date.now());

    // Modal states
    const [selectedVersion, setSelectedVersion] = useState<AgentVersion | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareVersions, setCompareVersions] = useState<
        [AgentVersion | null, AgentVersion | null]
    >([null, null]);
    const [selectModeActive, setSelectModeActive] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<Set<number>>(new Set());

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
                    instructions: string;
                    modelProvider: string;
                    modelName: string;
                    changesJson?:
                        | string[]
                        | {
                              type: string;
                              fromVersion?: number;
                              toVersion?: number;
                              reason?: string;
                          };
                    snapshot?: VersionSnapshot;
                    createdBy?: string;
                    createdAt: string;
                    isActive: boolean;
                    stats?: { runs: number; successRate: number; avgQuality: number };
                }) => {
                    // Handle changesJson which can be an array or an object (for rollbacks)
                    let changes: string[] = [];
                    if (Array.isArray(v.changesJson)) {
                        changes = v.changesJson;
                    } else if (v.changesJson && typeof v.changesJson === "object") {
                        // Rollback format: {type: "rollback", fromVersion, toVersion, reason}
                        if (v.changesJson.type === "rollback") {
                            changes = [
                                `Rolled back from v${v.changesJson.fromVersion} to v${v.changesJson.toVersion}`
                            ];
                            if (v.changesJson.reason) {
                                changes.push(`Reason: ${v.changesJson.reason}`);
                            }
                        }
                    }

                    return {
                        id: v.id,
                        version: v.version,
                        createdAt: v.createdAt,
                        createdBy: v.createdBy || "System",
                        description: v.description || `Version ${v.version}`,
                        instructions: v.instructions || "",
                        changes,
                        isActive: v.isActive,
                        modelProvider: v.modelProvider,
                        modelName: v.modelName,
                        snapshot: v.snapshot || null,
                        stats: v.stats || null
                    };
                }
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

    const handleRollback = async (targetVersion: number) => {
        try {
            setRollingBack(targetVersion);
            setRollbackError(null);

            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/versions/${targetVersion}/rollback`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                }
            );

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to rollback");
            }

            // Refresh the versions list to show the new state
            await fetchVersions();
        } catch (err) {
            setRollbackError(err instanceof Error ? err.message : "Failed to rollback");
            console.error("Rollback failed:", err);
        } finally {
            setRollingBack(null);
        }
    };

    // Open View Details modal
    const handleViewDetails = (version: AgentVersion) => {
        setSelectedVersion(version);
        setDetailsOpen(true);
    };

    // Compare a version against the active version
    const handleCompareWithActive = (version: AgentVersion) => {
        const activeVersion = versions.find((v) => v.isActive);
        if (activeVersion) {
            setCompareVersions([version, activeVersion]);
            setCompareOpen(true);
        }
    };

    // Toggle version selection for comparison
    const toggleVersionSelection = (versionNum: number) => {
        const newSelected = new Set(selectedForCompare);
        if (newSelected.has(versionNum)) {
            newSelected.delete(versionNum);
        } else if (newSelected.size < 2) {
            newSelected.add(versionNum);
        }
        setSelectedForCompare(newSelected);
    };

    // Start comparison from header button
    const handleCompareVersionsClick = () => {
        if (selectModeActive && selectedForCompare.size === 2) {
            // Launch comparison
            const [v1, v2] = Array.from(selectedForCompare).sort((a, b) => b - a);
            const version1 = versions.find((v) => v.version === v1);
            const version2 = versions.find((v) => v.version === v2);
            if (version1 && version2) {
                setCompareVersions([version1, version2]);
                setCompareOpen(true);
                setSelectModeActive(false);
                setSelectedForCompare(new Set());
            }
        } else {
            // Enter selection mode
            setSelectModeActive(true);
            setSelectedForCompare(new Set());
        }
    };

    // Cancel selection mode
    const handleCancelSelection = () => {
        setSelectModeActive(false);
        setSelectedForCompare(new Set());
    };

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
                    {selectModeActive ? (
                        <>
                            <Button variant="outline" onClick={handleCancelSelection}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCompareVersionsClick}
                                disabled={selectedForCompare.size !== 2}
                            >
                                Compare ({selectedForCompare.size}/2 selected)
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={handleCompareVersionsClick}>
                            Compare Versions
                        </Button>
                    )}
                    <Button variant="outline">Export History</Button>
                </div>
            </div>

            {/* Rollback Error */}
            {rollbackError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-sm text-red-600">Rollback failed: {rollbackError}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setRollbackError(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

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
                                    className={`rounded-lg border p-4 ${version.isActive ? "border-primary" : ""} ${selectModeActive && selectedForCompare.has(version.version) ? "ring-primary ring-2" : ""}`}
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {selectModeActive && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedForCompare.has(
                                                        version.version
                                                    )}
                                                    onChange={() =>
                                                        toggleVersionSelection(version.version)
                                                    }
                                                    disabled={
                                                        !selectedForCompare.has(version.version) &&
                                                        selectedForCompare.size >= 2
                                                    }
                                                    className="mt-1 h-4 w-4"
                                                />
                                            )}
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewDetails(version)}
                                        >
                                            View Details
                                        </Button>
                                        {!version.isActive && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCompareWithActive(version)}
                                            >
                                                Compare with Active
                                            </Button>
                                        )}
                                        {!version.isActive && (
                                            <AlertDialog>
                                                <AlertDialogTrigger>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={rollingBack !== null}
                                                    >
                                                        {rollingBack === version.version
                                                            ? "Rolling back..."
                                                            : `Rollback to v${version.version}`}
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
                                                        <AlertDialogAction
                                                            onClick={() =>
                                                                handleRollback(version.version)
                                                            }
                                                        >
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

            {/* View Details Modal */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-h-[80vh] max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Version {selectedVersion?.version} Details
                            {selectedVersion?.isActive && <Badge>Active</Badge>}
                        </DialogTitle>
                        <DialogDescription>
                            Created on{" "}
                            {selectedVersion
                                ? new Date(selectedVersion.createdAt).toLocaleString()
                                : ""}{" "}
                            by {selectedVersion?.createdBy}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {selectedVersion && (
                            <Tabs defaultValue="instructions" className="w-full">
                                <TabsList className="w-full justify-start">
                                    <TabsTrigger value="instructions">Instructions</TabsTrigger>
                                    <TabsTrigger value="model">Model Config</TabsTrigger>
                                    <TabsTrigger value="tools">Tools</TabsTrigger>
                                    <TabsTrigger value="memory">Memory</TabsTrigger>
                                </TabsList>
                                <TabsContent value="instructions" className="mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="mb-2 text-sm font-medium">
                                                Description
                                            </h4>
                                            <p className="text-muted-foreground bg-muted rounded-lg p-3 text-sm">
                                                {selectedVersion.description || "No description"}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-2 text-sm font-medium">
                                                Instructions
                                            </h4>
                                            <pre className="bg-muted max-h-[300px] overflow-x-auto rounded-lg p-3 text-sm whitespace-pre-wrap">
                                                {selectedVersion.instructions ||
                                                    selectedVersion.snapshot?.instructions ||
                                                    "No instructions"}
                                            </pre>
                                        </div>
                                        {selectedVersion.changes.length > 0 && (
                                            <div>
                                                <h4 className="mb-2 text-sm font-medium">
                                                    Changes in this version
                                                </h4>
                                                <ul className="space-y-1 text-sm">
                                                    {selectedVersion.changes.map((change, i) => (
                                                        <li
                                                            key={i}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <span className="text-primary">•</span>
                                                            {change}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="model" className="mt-4">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Provider
                                                </p>
                                                <p className="font-medium">
                                                    {selectedVersion.modelProvider}
                                                </p>
                                            </div>
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Model
                                                </p>
                                                <p className="font-medium">
                                                    {selectedVersion.modelName}
                                                </p>
                                            </div>
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Temperature
                                                </p>
                                                <p className="font-medium">
                                                    {selectedVersion.snapshot?.temperature ??
                                                        "Default"}
                                                </p>
                                            </div>
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Max Tokens
                                                </p>
                                                <p className="font-medium">
                                                    {selectedVersion.snapshot?.maxTokens ??
                                                        "Default"}
                                                </p>
                                            </div>
                                            <div className="bg-muted rounded-lg p-3">
                                                <p className="text-muted-foreground text-xs">
                                                    Max Steps
                                                </p>
                                                <p className="font-medium">
                                                    {selectedVersion.snapshot?.maxSteps ??
                                                        "Default"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="tools" className="mt-4">
                                    <div className="space-y-2">
                                        {selectedVersion.snapshot?.tools &&
                                        selectedVersion.snapshot.tools.length > 0 ? (
                                            selectedVersion.snapshot.tools.map((tool, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-muted flex items-center justify-between rounded-lg p-3"
                                                >
                                                    <span className="font-mono text-sm">
                                                        {tool.toolId}
                                                    </span>
                                                    {tool.config &&
                                                        Object.keys(tool.config).length > 0 && (
                                                            <Badge variant="outline">
                                                                Configured
                                                            </Badge>
                                                        )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                No tools configured
                                            </p>
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="memory" className="mt-4">
                                    <div className="space-y-4">
                                        <div className="bg-muted rounded-lg p-3">
                                            <p className="text-muted-foreground text-xs">
                                                Memory Enabled
                                            </p>
                                            <p className="font-medium">
                                                {selectedVersion.snapshot?.memoryEnabled
                                                    ? "Yes"
                                                    : "No"}
                                            </p>
                                        </div>
                                        {selectedVersion.snapshot?.memoryConfig && (
                                            <div>
                                                <p className="text-muted-foreground mb-2 text-xs">
                                                    Memory Configuration
                                                </p>
                                                <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-sm">
                                                    {JSON.stringify(
                                                        selectedVersion.snapshot.memoryConfig,
                                                        null,
                                                        2
                                                    )}
                                                </pre>
                                            </div>
                                        )}
                                        {selectedVersion.snapshot?.scorers &&
                                            selectedVersion.snapshot.scorers.length > 0 && (
                                                <div>
                                                    <p className="text-muted-foreground mb-2 text-xs">
                                                        Scorers
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedVersion.snapshot.scorers.map(
                                                            (scorer, i) => (
                                                                <Badge key={i} variant="outline">
                                                                    {scorer}
                                                                </Badge>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Compare Versions Modal */}
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                <DialogContent className="max-h-[85vh] max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            Compare Version {compareVersions[0]?.version} vs Version{" "}
                            {compareVersions[1]?.version}
                        </DialogTitle>
                        <DialogDescription>
                            Side-by-side comparison of agent configurations
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {compareVersions[0] && compareVersions[1] && (
                            <div className="space-y-6">
                                {/* Header comparison */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted rounded-lg p-4">
                                        <div className="mb-2 flex items-center gap-2">
                                            <Badge variant="outline">
                                                v{compareVersions[0].version}
                                            </Badge>
                                            {compareVersions[0].isActive && <Badge>Active</Badge>}
                                        </div>
                                        <p className="text-muted-foreground text-sm">
                                            {new Date(
                                                compareVersions[0].createdAt
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-muted rounded-lg p-4">
                                        <div className="mb-2 flex items-center gap-2">
                                            <Badge variant="outline">
                                                v{compareVersions[1].version}
                                            </Badge>
                                            {compareVersions[1].isActive && <Badge>Active</Badge>}
                                        </div>
                                        <p className="text-muted-foreground text-sm">
                                            {new Date(
                                                compareVersions[1].createdAt
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Model comparison */}
                                <div>
                                    <h4 className="mb-3 text-sm font-medium">
                                        Model Configuration
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].modelProvider !== compareVersions[1].modelProvider ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Provider:
                                                </span>{" "}
                                                {compareVersions[0].modelProvider}
                                            </div>
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].modelName !== compareVersions[1].modelName ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Model:
                                                </span>{" "}
                                                {compareVersions[0].modelName}
                                            </div>
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].snapshot?.temperature !== compareVersions[1].snapshot?.temperature ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Temperature:
                                                </span>{" "}
                                                {compareVersions[0].snapshot?.temperature ??
                                                    "Default"}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].modelProvider !== compareVersions[1].modelProvider ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Provider:
                                                </span>{" "}
                                                {compareVersions[1].modelProvider}
                                            </div>
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].modelName !== compareVersions[1].modelName ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Model:
                                                </span>{" "}
                                                {compareVersions[1].modelName}
                                            </div>
                                            <div
                                                className={`rounded p-2 text-sm ${compareVersions[0].snapshot?.temperature !== compareVersions[1].snapshot?.temperature ? "bg-yellow-500/20" : "bg-muted"}`}
                                            >
                                                <span className="text-muted-foreground">
                                                    Temperature:
                                                </span>{" "}
                                                {compareVersions[1].snapshot?.temperature ??
                                                    "Default"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tools comparison */}
                                <div>
                                    <h4 className="mb-3 text-sm font-medium">Tools</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted rounded-lg p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {compareVersions[0]?.snapshot?.tools?.map(
                                                    (tool, i) => {
                                                        const inOther =
                                                            compareVersions[1]?.snapshot?.tools?.some(
                                                                (t) => t.toolId === tool.toolId
                                                            );
                                                        return (
                                                            <Badge
                                                                key={i}
                                                                variant={
                                                                    inOther ? "outline" : "default"
                                                                }
                                                                className={
                                                                    !inOther ? "bg-green-600" : ""
                                                                }
                                                            >
                                                                {tool.toolId}
                                                            </Badge>
                                                        );
                                                    }
                                                ) || (
                                                    <span className="text-muted-foreground text-sm">
                                                        No tools
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-muted rounded-lg p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {compareVersions[1]?.snapshot?.tools?.map(
                                                    (tool, i) => {
                                                        const inOther =
                                                            compareVersions[0]?.snapshot?.tools?.some(
                                                                (t) => t.toolId === tool.toolId
                                                            );
                                                        return (
                                                            <Badge
                                                                key={i}
                                                                variant={
                                                                    inOther ? "outline" : "default"
                                                                }
                                                                className={
                                                                    !inOther ? "bg-green-600" : ""
                                                                }
                                                            >
                                                                {tool.toolId}
                                                            </Badge>
                                                        );
                                                    }
                                                ) || (
                                                    <span className="text-muted-foreground text-sm">
                                                        No tools
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground mt-2 text-xs">
                                        Green = unique to that version, Outline = present in both
                                    </p>
                                </div>

                                {/* Instructions comparison */}
                                <div>
                                    <h4 className="mb-3 text-sm font-medium">Instructions</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={`rounded-lg p-3 text-sm ${compareVersions[0].instructions !== compareVersions[1].instructions ? "border border-yellow-500/30 bg-yellow-500/10" : "bg-muted"}`}
                                        >
                                            <pre className="max-h-[200px] overflow-y-auto text-xs whitespace-pre-wrap">
                                                {compareVersions[0].instructions ||
                                                    compareVersions[0].snapshot?.instructions ||
                                                    "No instructions"}
                                            </pre>
                                        </div>
                                        <div
                                            className={`rounded-lg p-3 text-sm ${compareVersions[0].instructions !== compareVersions[1].instructions ? "border border-yellow-500/30 bg-yellow-500/10" : "bg-muted"}`}
                                        >
                                            <pre className="max-h-[200px] overflow-y-auto text-xs whitespace-pre-wrap">
                                                {compareVersions[1].instructions ||
                                                    compareVersions[1].snapshot?.instructions ||
                                                    "No instructions"}
                                            </pre>
                                        </div>
                                    </div>
                                    {compareVersions[0].instructions !==
                                        compareVersions[1].instructions && (
                                        <p className="mt-2 text-xs text-yellow-600">
                                            Instructions differ between versions
                                        </p>
                                    )}
                                </div>

                                {/* Stats comparison */}
                                <div>
                                    <h4 className="mb-3 text-sm font-medium">Performance Stats</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">Runs:</span>{" "}
                                                {compareVersions[0].stats?.runs ?? 0}
                                            </div>
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    Success Rate:
                                                </span>{" "}
                                                {compareVersions[0].stats?.successRate ?? 0}%
                                            </div>
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    Quality:
                                                </span>{" "}
                                                {compareVersions[0].stats?.avgQuality ?? 0}%
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">Runs:</span>{" "}
                                                {compareVersions[1].stats?.runs ?? 0}
                                            </div>
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    Success Rate:
                                                </span>{" "}
                                                {compareVersions[1].stats?.successRate ?? 0}%
                                            </div>
                                            <div className="bg-muted rounded p-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    Quality:
                                                </span>{" "}
                                                {compareVersions[1].stats?.avgQuality ?? 0}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
