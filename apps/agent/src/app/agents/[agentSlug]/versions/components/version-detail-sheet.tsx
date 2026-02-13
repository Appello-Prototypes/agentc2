"use client";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    Badge,
    Button,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
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
import { VersionStatsBar } from "./version-stats-bar";
import { InstructionDiffView } from "./instruction-diff-view";

interface VersionDetailSheetProps {
    version: AgentVersion | null;
    previousVersion: AgentVersion | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRollback: (version: number) => void;
    onCompareWithActive: (version: AgentVersion) => void;
    rollingBack: number | null;
    agentSlug: string;
}

export function VersionDetailSheet({
    version,
    previousVersion,
    open,
    onOpenChange,
    onRollback,
    onCompareWithActive,
    rollingBack,
    agentSlug
}: VersionDetailSheetProps) {
    if (!version) return null;

    const memoryConfig = version.snapshot?.memoryConfig as Record<string, unknown> | undefined;
    const modelConfig = version.snapshot?.modelConfig as Record<string, unknown> | undefined;

    const handleCopyConfig = () => {
        const config = {
            version: version.version,
            instructions: version.instructions,
            modelProvider: version.modelProvider,
            modelName: version.modelName,
            snapshot: version.snapshot
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className="w-full overflow-y-auto sm:w-[720px] sm:max-w-[720px]"
                side="right"
            >
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                        Version {version.version} Details
                        {version.isActive && <Badge>Active</Badge>}
                        {version.isRollback && <Badge variant="outline">Rollback</Badge>}
                        {version.experimentResult && (
                            <Badge
                                variant="outline"
                                className={
                                    version.experimentResult.gatingResult === "passed"
                                        ? "border-green-500 text-green-500"
                                        : version.experimentResult.gatingResult === "failed"
                                          ? "border-red-500 text-red-500"
                                          : ""
                                }
                            >
                                Experiment{" "}
                                {version.experimentResult.winRate !== null
                                    ? `${Math.round(version.experimentResult.winRate * 100)}%`
                                    : ""}
                            </Badge>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        Created on {new Date(version.createdAt).toLocaleString()} by{" "}
                        {version.createdBy}
                    </SheetDescription>
                </SheetHeader>

                {/* Stats Bar */}
                <div className="mb-4">
                    <VersionStatsBar stats={version.stats} />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="config" className="w-full">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="config">Config</TabsTrigger>
                        <TabsTrigger value="tools">
                            Tools
                            {version.snapshot?.tools && version.snapshot.tools.length > 0 && (
                                <Badge variant="outline" className="ml-1 px-1 text-[10px]">
                                    {version.snapshot.tools.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="scorers">Scorers + Skills</TabsTrigger>
                        <TabsTrigger value="changes">Changes</TabsTrigger>
                        <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                    </TabsList>

                    {/* Config Tab: Instructions + Model + Memory */}
                    <TabsContent value="config" className="mt-4 space-y-4">
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Instructions</h4>
                            <InstructionDiffView
                                current={
                                    version.instructions || version.snapshot?.instructions || ""
                                }
                                previous={
                                    previousVersion?.instructions ||
                                    previousVersion?.snapshot?.instructions ||
                                    null
                                }
                                previousVersion={version.previousVersion}
                            />
                        </div>

                        <div>
                            <h4 className="mb-2 text-sm font-medium">Model Configuration</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Provider</p>
                                    <p className="text-sm font-medium">{version.modelProvider}</p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Model</p>
                                    <p className="text-sm font-medium">{version.modelName}</p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Temperature</p>
                                    <p className="text-sm font-medium">
                                        {version.snapshot?.temperature ?? "Default"}
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Max Tokens</p>
                                    <p className="text-sm font-medium">
                                        {version.snapshot?.maxTokens ?? "Default"}
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Max Steps</p>
                                    <p className="text-sm font-medium">
                                        {version.snapshot?.maxSteps ?? "Default"}
                                    </p>
                                </div>
                            </div>
                            {modelConfig && Object.keys(modelConfig).length > 0 && (
                                <details className="mt-2">
                                    <summary className="text-muted-foreground cursor-pointer text-xs">
                                        Advanced Model Config
                                    </summary>
                                    <pre className="bg-muted mt-1 overflow-x-auto rounded-lg p-2 text-xs">
                                        {JSON.stringify(modelConfig, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <div>
                            <h4 className="mb-2 text-sm font-medium">Memory</h4>
                            <div className="bg-muted rounded-lg p-2">
                                <p className="text-muted-foreground text-[10px]">Memory Enabled</p>
                                <p className="text-sm font-medium">
                                    {version.snapshot?.memoryEnabled ? "Yes" : "No"}
                                </p>
                            </div>
                            {memoryConfig && Object.keys(memoryConfig).length > 0 && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {memoryConfig.lastMessages !== undefined && (
                                        <div className="bg-muted rounded-lg p-2">
                                            <p className="text-muted-foreground text-[10px]">
                                                Last Messages
                                            </p>
                                            <p className="text-sm font-medium">
                                                {String(memoryConfig.lastMessages)}
                                            </p>
                                        </div>
                                    )}
                                    {typeof memoryConfig.semanticRecall === "object" &&
                                        memoryConfig.semanticRecall !== null && (
                                            <div className="bg-muted rounded-lg p-2">
                                                <p className="text-muted-foreground text-[10px]">
                                                    Semantic Recall topK
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {String(
                                                        (
                                                            memoryConfig.semanticRecall as Record<
                                                                string,
                                                                unknown
                                                            >
                                                        )?.topK ?? "-"
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    {typeof memoryConfig.workingMemory === "object" &&
                                        memoryConfig.workingMemory !== null && (
                                            <div className="bg-muted rounded-lg p-2">
                                                <p className="text-muted-foreground text-[10px]">
                                                    Working Memory
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {(
                                                        memoryConfig.workingMemory as Record<
                                                            string,
                                                            unknown
                                                        >
                                                    )?.enabled
                                                        ? "Enabled"
                                                        : "Disabled"}
                                                </p>
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tools Tab */}
                    <TabsContent value="tools" className="mt-4 space-y-3">
                        {version.snapshot?.tools && version.snapshot.tools.length > 0 ? (
                            <>
                                {/* Show add/remove vs previous */}
                                {previousVersion?.snapshot?.tools && (
                                    <ToolDiffSummary
                                        currentTools={version.snapshot.tools}
                                        previousTools={previousVersion.snapshot.tools}
                                    />
                                )}
                                <div className="space-y-1">
                                    {version.snapshot.tools.map((tool, i) => {
                                        const wasInPrevious =
                                            previousVersion?.snapshot?.tools?.some(
                                                (t) => t.toolId === tool.toolId
                                            );
                                        const isNew =
                                            previousVersion?.snapshot?.tools && !wasInPrevious;
                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center justify-between rounded-lg p-2 ${
                                                    isNew
                                                        ? "border border-green-500/30 bg-green-500/10"
                                                        : "bg-muted"
                                                }`}
                                            >
                                                <span className="font-mono text-xs">
                                                    {tool.toolId}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {isNew && (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-green-500 text-[10px] text-green-500"
                                                        >
                                                            New
                                                        </Badge>
                                                    )}
                                                    {tool.config &&
                                                        Object.keys(tool.config).length > 0 && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px]"
                                                            >
                                                                Configured
                                                            </Badge>
                                                        )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Show removed tools */}
                                {previousVersion?.snapshot?.tools && (
                                    <RemovedToolsList
                                        currentTools={version.snapshot.tools}
                                        previousTools={previousVersion.snapshot.tools}
                                    />
                                )}
                            </>
                        ) : (
                            <p className="text-muted-foreground text-sm">No tools configured</p>
                        )}
                    </TabsContent>

                    {/* Scorers + Skills Tab */}
                    <TabsContent value="scorers" className="mt-4 space-y-4">
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Scorers</h4>
                            {version.snapshot?.scorers && version.snapshot.scorers.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {version.snapshot.scorers.map((scorer, i) => (
                                        <Badge key={i} variant="outline">
                                            {scorer}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">No scorers</p>
                            )}
                        </div>
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Skills</h4>
                            {version.snapshot?.skills && version.snapshot.skills.length > 0 ? (
                                <div className="space-y-1">
                                    {version.snapshot.skills.map((skill, i) => (
                                        <div
                                            key={i}
                                            className="bg-muted flex items-center justify-between rounded-lg p-2"
                                        >
                                            <span className="font-mono text-xs">
                                                {skill.skillId}
                                            </span>
                                            {skill.pinned && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    Pinned
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">No skills attached</p>
                            )}
                        </div>
                    </TabsContent>

                    {/* Changes Tab */}
                    <TabsContent value="changes" className="mt-4 space-y-4">
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Description</h4>
                            <p className="text-muted-foreground bg-muted rounded-lg p-3 text-sm">
                                {version.description || "No description"}
                            </p>
                        </div>
                        {version.changes.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">Changelog</h4>
                                <ul className="space-y-1 text-sm">
                                    {version.changes.map((change, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                            <span className="text-primary">•</span>
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Provenance</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Created By</p>
                                    <p className="text-sm font-medium">{version.createdBy}</p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <p className="text-muted-foreground text-[10px]">Created At</p>
                                    <p className="text-sm font-medium">
                                        {new Date(version.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                {version.isRollback && (
                                    <div className="bg-muted col-span-2 rounded-lg p-2">
                                        <p className="text-muted-foreground text-[10px]">Type</p>
                                        <p className="text-sm font-medium">
                                            Rollback from a previous version
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {version.experimentResult && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">Experiment Result</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-muted rounded-lg p-2">
                                        <p className="text-muted-foreground text-[10px]">
                                            Win Rate
                                        </p>
                                        <p className="text-sm font-medium">
                                            {version.experimentResult.winRate !== null
                                                ? `${Math.round(version.experimentResult.winRate * 100)}%`
                                                : "Pending"}
                                        </p>
                                    </div>
                                    <div className="bg-muted rounded-lg p-2">
                                        <p className="text-muted-foreground text-[10px]">
                                            Gating Result
                                        </p>
                                        <p
                                            className={`text-sm font-medium ${
                                                version.experimentResult.gatingResult === "passed"
                                                    ? "text-green-500"
                                                    : version.experimentResult.gatingResult ===
                                                        "failed"
                                                      ? "text-red-500"
                                                      : ""
                                            }`}
                                        >
                                            {version.experimentResult.gatingResult ?? "Pending"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Raw JSON Tab */}
                    <TabsContent value="raw" className="mt-4">
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 z-10 text-xs"
                                onClick={handleCopyConfig}
                            >
                                Copy
                            </Button>
                            <pre className="bg-muted max-h-[500px] overflow-auto rounded-lg p-3 text-xs">
                                {JSON.stringify(version.snapshot, null, 2)}
                            </pre>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Footer Actions */}
                <SheetFooter className="mt-6 flex gap-2 border-t pt-4">
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
                    {!version.isActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCompareWithActive(version)}
                        >
                            Compare with Active
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            window.open(
                                `/agent/agents/${agentSlug}/runs?versionId=${version.id}`,
                                "_self"
                            )
                        }
                    >
                        View Runs
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopyConfig}>
                        Copy Config JSON
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

/* Helper: Tool diff summary */
function ToolDiffSummary({
    currentTools,
    previousTools
}: {
    currentTools: Array<{ toolId: string }>;
    previousTools: Array<{ toolId: string }>;
}) {
    const currentIds = new Set(currentTools.map((t) => t.toolId));
    const previousIds = new Set(previousTools.map((t) => t.toolId));
    const added = currentTools.filter((t) => !previousIds.has(t.toolId));
    const removed = previousTools.filter((t) => !currentIds.has(t.toolId));

    if (added.length === 0 && removed.length === 0) return null;

    return (
        <div className="flex gap-3 text-xs">
            {added.length > 0 && <span className="text-green-500">+{added.length} added</span>}
            {removed.length > 0 && <span className="text-red-500">-{removed.length} removed</span>}
        </div>
    );
}

/* Helper: Show removed tools from previous version */
function RemovedToolsList({
    currentTools,
    previousTools
}: {
    currentTools: Array<{ toolId: string }>;
    previousTools: Array<{ toolId: string }>;
}) {
    const currentIds = new Set(currentTools.map((t) => t.toolId));
    const removed = previousTools.filter((t) => !currentIds.has(t.toolId));

    if (removed.length === 0) return null;

    return (
        <div>
            <p className="text-muted-foreground mb-1 text-xs">Removed from previous version:</p>
            <div className="space-y-1">
                {removed.map((tool, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-2"
                    >
                        <span className="font-mono text-xs line-through">{tool.toolId}</span>
                        <Badge
                            variant="outline"
                            className="border-red-500 text-[10px] text-red-500"
                        >
                            Removed
                        </Badge>
                    </div>
                ))}
            </div>
        </div>
    );
}
