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
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Loader,
    Separator
} from "@repo/ui";
import { PlayIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";

interface BimModel {
    id: string;
    name: string;
    _count: { versions: number };
}

interface TakeoffResult {
    groups: Array<{
        groupKey: string | null;
        elementCount: number;
        totalLength: number | null;
        totalArea: number | null;
        totalVolume: number | null;
    }>;
    summary: {
        totalElements: number;
        totalLength: number | null;
        totalArea: number | null;
        totalVolume: number | null;
    };
    takeoffId?: string;
    error?: string;
}

export default function TakeoffsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-64 items-center justify-center">
                    <Loader size={32} />
                </div>
            }
        >
            <TakeoffsPageContent />
        </Suspense>
    );
}

function TakeoffsPageContent() {
    const searchParams = useSearchParams();
    const preselectedModelId = searchParams.get("modelId");

    const [models, setModels] = useState<BimModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModelId, setSelectedModelId] = useState<string>(preselectedModelId || "");
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [groupBy, setGroupBy] = useState<string>("category");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<TakeoffResult | null>(null);

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

    const handleRunTakeoff = async () => {
        if (!selectedModelId) return;

        setRunning(true);
        setResult(null);

        try {
            const body: Record<string, unknown> = {
                modelId: selectedModelId,
                groupBy: groupBy || undefined
            };

            if (categoryFilter) {
                body.filters = { category: categoryFilter };
            }

            const res = await fetch(`${getApiBase()}/api/bim/takeoff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            setResult(data);
        } catch {
            setResult({
                error: "Failed to run takeoff",
                groups: [],
                summary: { totalElements: 0, totalLength: null, totalArea: null, totalVolume: null }
            });
        } finally {
            setRunning(false);
        }
    };

    const formatNumber = (num: number | null | undefined) => {
        if (num === null || num === undefined) return "-";
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const exportToCsv = () => {
        if (!result?.groups) return;

        const headers = ["Group", "Element Count", "Total Length", "Total Area", "Total Volume"];
        const rows = result.groups.map((g) => [
            g.groupKey || "Ungrouped",
            g.elementCount,
            g.totalLength ?? "",
            g.totalArea ?? "",
            g.totalVolume ?? ""
        ]);

        // Add summary row
        rows.push([
            "TOTAL",
            result.summary.totalElements,
            result.summary.totalLength ?? "",
            result.summary.totalArea ?? "",
            result.summary.totalVolume ?? ""
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `takeoff-${selectedModelId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <Link href="/bim" className="text-muted-foreground hover:text-foreground">
                            BIM
                        </Link>
                        <span className="text-muted-foreground">/</span>
                        <span>Takeoffs</span>
                    </div>
                    <h1 className="mb-2 text-3xl font-bold">Quantity Takeoffs</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Run automated quantity takeoffs on your BIM models. Calculate element
                        counts, lengths, areas, and volumes with optional grouping and filtering.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Takeoff Configuration</CardTitle>
                        <CardDescription>Select a model and configure options</CardDescription>
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
                                                {model.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="groupBy">Group By</Label>
                            <Select
                                value={groupBy}
                                onValueChange={(value) => setGroupBy(value ?? "")}
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="category">Category</SelectItem>
                                    <SelectItem value="type">Type</SelectItem>
                                    <SelectItem value="level">Level</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                    <SelectItem value="">No Grouping</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="categoryFilter">Category Filter (optional)</Label>
                            <Input
                                id="categoryFilter"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                placeholder="e.g., Pipe, Duct, Wall"
                                className="mt-2"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                Filter to specific element categories
                            </p>
                        </div>

                        <Separator />

                        <Button
                            onClick={handleRunTakeoff}
                            disabled={running || !selectedModelId}
                            className="w-full"
                        >
                            {running ? (
                                <>
                                    <Loader size={16} className="mr-2" />
                                    Running Takeoff...
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="mr-2 h-4 w-4" />
                                    Run Takeoff
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
                                    <CardTitle>Results</CardTitle>
                                    <CardDescription>
                                        Quantity summary from the takeoff
                                    </CardDescription>
                                </div>
                                {result && !result.error && (
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
                                            Computing takeoff...
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
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <div className="text-muted-foreground text-sm">
                                                    Elements
                                                </div>
                                                <div className="text-2xl font-bold">
                                                    {formatNumber(result.summary.totalElements)}
                                                </div>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <div className="text-muted-foreground text-sm">
                                                    Total Length
                                                </div>
                                                <div className="text-2xl font-bold">
                                                    {formatNumber(result.summary.totalLength)}
                                                </div>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <div className="text-muted-foreground text-sm">
                                                    Total Area
                                                </div>
                                                <div className="text-2xl font-bold">
                                                    {formatNumber(result.summary.totalArea)}
                                                </div>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                                <div className="text-muted-foreground text-sm">
                                                    Total Volume
                                                </div>
                                                <div className="text-2xl font-bold">
                                                    {formatNumber(result.summary.totalVolume)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Grouped Results Table */}
                                        {result.groups.length > 0 && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b">
                                                            <th className="px-4 py-2 text-left font-medium">
                                                                {groupBy || "Group"}
                                                            </th>
                                                            <th className="px-4 py-2 text-right font-medium">
                                                                Count
                                                            </th>
                                                            <th className="px-4 py-2 text-right font-medium">
                                                                Length
                                                            </th>
                                                            <th className="px-4 py-2 text-right font-medium">
                                                                Area
                                                            </th>
                                                            <th className="px-4 py-2 text-right font-medium">
                                                                Volume
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {result.groups.map((group, i) => (
                                                            <tr
                                                                key={i}
                                                                className="hover:bg-muted/50 border-b"
                                                            >
                                                                <td className="px-4 py-2">
                                                                    {group.groupKey || (
                                                                        <span className="text-muted-foreground italic">
                                                                            Ungrouped
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {formatNumber(
                                                                        group.elementCount
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {formatNumber(
                                                                        group.totalLength
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {formatNumber(group.totalArea)}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {formatNumber(
                                                                        group.totalVolume
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-muted/30 font-medium">
                                                            <td className="px-4 py-2">Total</td>
                                                            <td className="px-4 py-2 text-right">
                                                                {formatNumber(
                                                                    result.summary.totalElements
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                {formatNumber(
                                                                    result.summary.totalLength
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                {formatNumber(
                                                                    result.summary.totalArea
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                {formatNumber(
                                                                    result.summary.totalVolume
                                                                )}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}

                                        {result.takeoffId && (
                                            <div className="text-muted-foreground text-xs">
                                                Takeoff ID:{" "}
                                                <code className="text-xs">{result.takeoffId}</code>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="text-muted-foreground text-center">
                                        <div className="mb-2 text-4xl">📊</div>
                                        <p>Select a model and run a takeoff to see results</p>
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
