"use client";

import {
    Badge,
    Button,
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
import { AgentVersion } from "./types";

interface VersionCardProps {
    version: AgentVersion;
    previousVersion: AgentVersion | null;
    isLast: boolean;
    selectModeActive: boolean;
    isSelected: boolean;
    selectionDisabled: boolean;
    onToggleSelection: (versionNum: number) => void;
    onViewDetails: (version: AgentVersion) => void;
    onCompareWithActive: (version: AgentVersion) => void;
    onRollback: (version: number) => void;
    rollingBack: number | null;
}

export function VersionCard({
    version,
    previousVersion,
    isLast,
    selectModeActive,
    isSelected,
    selectionDisabled,
    onToggleSelection,
    onViewDetails,
    onCompareWithActive,
    onRollback,
    rollingBack
}: VersionCardProps) {
    // Compute quality delta vs previous
    const qualityDelta =
        previousVersion && version.stats.runs > 0 && previousVersion.stats.runs > 0
            ? version.stats.avgQuality - previousVersion.stats.avgQuality
            : null;

    // Timeline dot color
    const getDotColor = () => {
        if (version.isActive) return "bg-primary text-primary-foreground";
        if (version.isRollback) return "bg-blue-500 text-white";
        if (version.experimentResult) return "bg-purple-500 text-white";
        if (qualityDelta !== null && qualityDelta > 0) return "bg-green-500 text-white";
        if (qualityDelta !== null && qualityDelta < 0) return "bg-red-500 text-white";
        return "bg-muted text-muted-foreground";
    };

    return (
        <div className={`relative pb-8 pl-8 ${!isLast ? "border-muted ml-3 border-l-2" : ""}`}>
            {/* Timeline dot */}
            <div
                className={`absolute left-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full ${getDotColor()}`}
            >
                <span className="text-xs font-bold">{version.version}</span>
            </div>

            {/* Version Card */}
            <div
                className={`rounded-lg border p-4 ${version.isActive ? "border-primary" : ""} ${selectModeActive && isSelected ? "ring-primary ring-2" : ""}`}
            >
                <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        {selectModeActive && (
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelection(version.version)}
                                disabled={selectionDisabled}
                                className="mt-1 h-4 w-4"
                            />
                        )}
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="font-medium">Version {version.version}</span>
                                {version.isActive && <Badge>Active</Badge>}
                                {version.isRollback && (
                                    <Badge
                                        variant="outline"
                                        className="border-blue-500 text-blue-500"
                                    >
                                        Rollback
                                    </Badge>
                                )}
                                {version.experimentResult && (
                                    <Badge
                                        variant="outline"
                                        className={
                                            version.experimentResult.gatingResult === "passed"
                                                ? "border-green-500 text-green-500"
                                                : version.experimentResult.gatingResult === "failed"
                                                  ? "border-red-500 text-red-500"
                                                  : "border-purple-500 text-purple-500"
                                        }
                                    >
                                        Experiment
                                        {version.experimentResult.winRate !== null
                                            ? ` ${Math.round(version.experimentResult.winRate * 100)}%`
                                            : ""}
                                    </Badge>
                                )}
                                {version.createdBy?.toLowerCase().includes("learning") && (
                                    <Badge
                                        variant="outline"
                                        className="border-purple-500 text-purple-500"
                                    >
                                        Learning
                                    </Badge>
                                )}
                                {/* Regression / Improvement badge */}
                                {qualityDelta !== null && Math.abs(qualityDelta) > 0.01 && (
                                    <Badge
                                        variant="outline"
                                        className={
                                            qualityDelta > 0
                                                ? "border-green-500 text-green-500"
                                                : "border-red-500 text-red-500"
                                        }
                                    >
                                        {qualityDelta > 0 ? "↑" : "↓"}{" "}
                                        {Math.abs(Math.round(qualityDelta * 100) / 100)}% quality
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground text-sm">{version.description}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm">
                            {new Date(version.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-muted-foreground text-xs">{version.createdBy}</p>
                    </div>
                </div>

                {/* Changes */}
                {version.changes.length > 0 && (
                    <div className="mb-2">
                        <p className="text-muted-foreground mb-1 text-xs">Changes:</p>
                        <ul className="space-y-0.5 text-sm">
                            {version.changes.map((change, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    <span className="text-primary">•</span>
                                    {change}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Inline Stats */}
                <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground text-xs">{version.stats.runs} runs</span>
                    <span className="text-muted-foreground text-xs">
                        {version.stats.successRate}% success
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {version.stats.avgQuality}% quality
                    </span>
                    {version.stats.totalCost > 0 && (
                        <span className="text-muted-foreground text-xs">
                            ${version.stats.totalCost.toFixed(4)} cost
                        </span>
                    )}
                    {version.stats.avgDurationMs && (
                        <span className="text-muted-foreground text-xs">
                            {(version.stats.avgDurationMs / 1000).toFixed(1)}s avg
                        </span>
                    )}
                    {(version.stats.feedbackSummary.thumbsUp > 0 ||
                        version.stats.feedbackSummary.thumbsDown > 0) && (
                        <span className="text-muted-foreground text-xs">
                            {version.stats.feedbackSummary.thumbsUp}↑{" "}
                            {version.stats.feedbackSummary.thumbsDown}↓
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onViewDetails(version)}>
                        View Details
                    </Button>
                    {!version.isActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCompareWithActive(version)}
                        >
                            Compare with Active
                        </Button>
                    )}
                    {!version.isActive && (
                        <AlertDialog>
                            <AlertDialogTrigger>
                                <Button variant="outline" size="sm" disabled={rollingBack !== null}>
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
                                        This will restore the agent configuration from{" "}
                                        {new Date(version.createdAt).toLocaleDateString()}. A new
                                        version will be created with the restored settings.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onRollback(version.version)}>
                                        Rollback
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        </div>
    );
}
