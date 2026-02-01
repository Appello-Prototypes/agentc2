"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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
    version: number;
    createdAt: string;
    createdBy: string;
    description: string;
    changes: string[];
    isActive: boolean;
    stats: {
        runs: number;
        successRate: number;
        avgQuality: number;
    };
}

const mockVersions: AgentVersion[] = [
    {
        version: 4,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        createdBy: "user@example.com",
        description: "Updated instructions for better conciseness",
        changes: [
            "Reduced verbosity in system instructions",
            "Added tone guidelines",
            "Enabled semantic recall"
        ],
        isActive: true,
        stats: { runs: 312, successRate: 94.2, avgQuality: 91 }
    },
    {
        version: 3,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        createdBy: "user@example.com",
        description: "Added new tools and increased max steps",
        changes: ["Added calendar tool", "Added email tool", "Increased max steps from 3 to 5"],
        isActive: false,
        stats: { runs: 523, successRate: 91.8, avgQuality: 87 }
    },
    {
        version: 2,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        createdBy: "user@example.com",
        description: "Switched to Claude Sonnet 4",
        changes: ["Model changed from gpt-4o to claude-sonnet-4", "Temperature reduced to 0.7"],
        isActive: false,
        stats: { runs: 412, successRate: 89.5, avgQuality: 84 }
    },
    {
        version: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        createdBy: "user@example.com",
        description: "Initial version",
        changes: ["Created agent with basic instructions", "Added web-search and calculator tools"],
        isActive: false,
        stats: { runs: 156, successRate: 85.2, avgQuality: 79 }
    }
];

export default function VersionsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [versions, setVersions] = useState<AgentVersion[]>([]);
    // Store mount time in state (lazy initializer only runs once)
    const [now] = useState(() => Date.now());

    useEffect(() => {
        setTimeout(() => {
            setVersions(mockVersions);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

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
                                <p className="text-xl font-bold">{activeVersion.stats.runs}</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Success Rate</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats.successRate}%
                                </p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-muted-foreground text-sm">Quality</p>
                                <p className="text-xl font-bold">
                                    {activeVersion.stats.avgQuality}%
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
                                            {version.stats.runs} runs
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {version.stats.successRate}% success
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {version.stats.avgQuality}% quality
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
                                    const qualityDiff = prev
                                        ? version.stats.avgQuality - prev.stats.avgQuality
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
                                                {version.stats.runs}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {version.stats.successRate}%
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {version.stats.avgQuality}%
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
