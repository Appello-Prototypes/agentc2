"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Loader,
    Separator,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { PlayIcon, DownloadIcon, PlusIcon, MinusIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";

interface BimModel {
    id: string;
    name: string;
    _count: { versions: number };
}

interface DiffElement {
    guid: string;
    category: string | null;
    changedKeys?: string[];
}

interface DiffResult {
    added: DiffElement[];
    removed: DiffElement[];
    changed: DiffElement[];
    unchanged: number;
    diffSummaryId?: string;
    error?: string;
}

export default function DiffsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-64 items-center justify-center">
                    <Loader size={32} />
                </div>
            }
        >
            <DiffsPageContent />
        </Suspense>
    );
}

function DiffsPageContent() {
    const searchParams = useSearchParams();
    const preselectedModelId = searchParams.get("modelId");

    const [models, setModels] = useState<BimModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModelId, setSelectedModelId] = useState<string>(preselectedModelId || "");
    const [versionA, setVersionA] = useState<string>("");
    const [versionB, setVersionB] = useState<string>("");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<DiffResult | null>(null);

    // Mock version list - in real implementation, this would be fetched from API
    const [versions] = useState<Array<{ id: string; version: number }>>([
        { id: "v1", version: 1 },
        { id: "v2", version: 2 }
    ]);

    const loadModels = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/bim/models`);
            if (res.ok) {
                const data = await res.json();
                setModels(data.models || []);
            }
        } catch (error) {
            console.error("Failed to load BIM models:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    const handleRunDiff = async () => {
        if (!selectedModelId || !versionA || !versionB) return;

        setRunning(true);
        setResult(null);

        try {
            const res = await fetch(`${getApiBase()}/api/bim/diff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modelId: selectedModelId,
                    versionIdA: versionA,
                    versionIdB: versionB
                })
            });

            const data = await res.json();
            setResult(data);
        } catch {
            setResult({
                error: "Failed to compute diff",
                added: [],
                removed: [],
                changed: [],
                unchanged: 0
            });
        } finally {
            setRunning(false);
        }
    };

    const exportToCsv = () => {
        if (!result) return;

        const headers = ["Change Type", "Element GUID", "Category", "Changed Properties"];
        const rows: string[][] = [];

        result.added.forEach((e) => {
            rows.push(["ADDED", e.guid, e.category || "", ""]);
        });
        result.removed.forEach((e) => {
            rows.push(["REMOVED", e.guid, e.category || "", ""]);
        });
        result.changed.forEach((e) => {
            rows.push(["CHANGED", e.guid, e.category || "", e.changedKeys?.join("; ") || ""]);
        });

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `diff-${selectedModelId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const totalChanges = result
        ? result.added.length + result.removed.length + result.changed.length
        : 0;

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <Link href="/bim" className="text-muted-foreground hover:text-foreground">
                            BIM
                        </Link>
                        <span className="text-muted-foreground">/</span>
                        <span>Version Diffs</span>
                    </div>
                    <h1 className="mb-2 text-3xl font-bold">Version Comparison</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Compare two versions of a BIM model to identify added, removed, and modified
                        elements. Track changes across model revisions.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Comparison Settings</CardTitle>
                        <CardDescription>Select versions to compare</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="model">Model</Label>
                            {loading ? (
                                <div className="mt-2 flex items-center gap-2">
                                    <Loader size={16} />
                                    <span className="text-muted-foreground text-sm">
                                        Loading models...
                                    </span>
                                </div>
                            ) : (
                                <Select
                                    value={selectedModelId}
                                    onValueChange={(value) => value && setSelectedModelId(value)}
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue placeholder="Select a model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.name} ({model._count.versions} versions)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <Separator />

                        <div>
                            <Label htmlFor="versionA">Base Version (older)</Label>
                            <Select
                                value={versionA}
                                onValueChange={(value) => value && setVersionA(value)}
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select base version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {versions.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            Version {v.version}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="versionB">Compare Version (newer)</Label>
                            <Select
                                value={versionB}
                                onValueChange={(value) => value && setVersionB(value)}
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select compare version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {versions.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            Version {v.version}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        <Button
                            onClick={handleRunDiff}
                            disabled={running || !selectedModelId || !versionA || !versionB}
                            className="w-full"
                        >
                            {running ? (
                                <>
                                    <Loader size={16} className="mr-2" />
                                    Comparing Versions...
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="mr-2 h-4 w-4" />
                                    Compare Versions
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Results */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Comparison Results</CardTitle>
                                    <CardDescription>
                                        Changes between selected versions
                                    </CardDescription>
                                </div>
                                {result && !result.error && totalChanges > 0 && (
                                    <Button variant="outline" size="sm" onClick={exportToCsv}>
                                        <DownloadIcon className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {running ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <Loader size={32} />
                                        <p className="text-muted-foreground mt-2">
                                            Analyzing changes...
                                        </p>
                                    </div>
                                </div>
                            ) : result ? (
                                result.error ? (
                                    <div className="bg-destructive/10 text-destructive rounded-md p-4">
                                        {result.error}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                            <div className="rounded-lg bg-green-500/10 p-4 text-center">
                                                <PlusIcon className="mx-auto mb-1 h-5 w-5 text-green-600" />
                                                <div className="text-2xl font-bold text-green-600">
                                                    {result.added.length}
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    Added
                                                </div>
                                            </div>
                                            <div className="rounded-lg bg-red-500/10 p-4 text-center">
                                                <MinusIcon className="mx-auto mb-1 h-5 w-5 text-red-600" />
                                                <div className="text-2xl font-bold text-red-600">
                                                    {result.removed.length}
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    Removed
                                                </div>
                                            </div>
                                            <div className="rounded-lg bg-yellow-500/10 p-4 text-center">
                                                <RefreshCwIcon className="mx-auto mb-1 h-5 w-5 text-yellow-600" />
                                                <div className="text-2xl font-bold text-yellow-600">
                                                    {result.changed.length}
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    Modified
                                                </div>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <div className="text-muted-foreground mb-1 text-sm">
                                                    Unchanged
                                                </div>
                                                <div className="text-2xl font-bold">
                                                    {result.unchanged}
                                                </div>
                                                <div className="text-muted-foreground text-sm">
                                                    elements
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detailed Changes */}
                                        {totalChanges > 0 && (
                                            <Tabs defaultValue="added">
                                                <TabsList>
                                                    <TabsTrigger value="added">
                                                        Added ({result.added.length})
                                                    </TabsTrigger>
                                                    <TabsTrigger value="removed">
                                                        Removed ({result.removed.length})
                                                    </TabsTrigger>
                                                    <TabsTrigger value="changed">
                                                        Modified ({result.changed.length})
                                                    </TabsTrigger>
                                                </TabsList>

                                                <TabsContent value="added" className="mt-4">
                                                    {result.added.length > 0 ? (
                                                        <div className="max-h-64 space-y-2 overflow-y-auto">
                                                            {result.added.map((el, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 p-2"
                                                                >
                                                                    <PlusIcon className="h-4 w-4 text-green-600" />
                                                                    <code className="text-xs">
                                                                        {el.guid}
                                                                    </code>
                                                                    {el.category && (
                                                                        <Badge variant="outline">
                                                                            {el.category}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No elements added
                                                        </p>
                                                    )}
                                                </TabsContent>

                                                <TabsContent value="removed" className="mt-4">
                                                    {result.removed.length > 0 ? (
                                                        <div className="max-h-64 space-y-2 overflow-y-auto">
                                                            {result.removed.map((el, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2"
                                                                >
                                                                    <MinusIcon className="h-4 w-4 text-red-600" />
                                                                    <code className="text-xs">
                                                                        {el.guid}
                                                                    </code>
                                                                    {el.category && (
                                                                        <Badge variant="outline">
                                                                            {el.category}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No elements removed
                                                        </p>
                                                    )}
                                                </TabsContent>

                                                <TabsContent value="changed" className="mt-4">
                                                    {result.changed.length > 0 ? (
                                                        <div className="max-h-64 space-y-2 overflow-y-auto">
                                                            {result.changed.map((el, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2"
                                                                >
                                                                    <RefreshCwIcon className="h-4 w-4 text-yellow-600" />
                                                                    <code className="text-xs">
                                                                        {el.guid}
                                                                    </code>
                                                                    {el.category && (
                                                                        <Badge variant="outline">
                                                                            {el.category}
                                                                        </Badge>
                                                                    )}
                                                                    {el.changedKeys &&
                                                                        el.changedKeys.length >
                                                                            0 && (
                                                                            <span className="text-muted-foreground text-xs">
                                                                                (
                                                                                {el.changedKeys.join(
                                                                                    ", "
                                                                                )}
                                                                                )
                                                                            </span>
                                                                        )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No elements modified
                                                        </p>
                                                    )}
                                                </TabsContent>
                                            </Tabs>
                                        )}

                                        {result.diffSummaryId && (
                                            <div className="text-muted-foreground text-xs">
                                                Diff Summary ID:{" "}
                                                <code className="text-xs">
                                                    {result.diffSummaryId}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="text-muted-foreground text-center">
                                        <div className="mb-2 text-4xl">🔄</div>
                                        <p>Select two versions to compare</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
