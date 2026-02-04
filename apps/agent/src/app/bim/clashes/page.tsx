"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
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
import { PlayIcon, AlertTriangleIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";

interface BimModel {
    id: string;
    name: string;
    _count: { versions: number };
}

interface ClashPair {
    elementA: { id: string; guid: string; category: string | null };
    elementB: { id: string; guid: string; category: string | null };
}

interface ClashResult {
    clashCount: number;
    pairs: ClashPair[];
    clashId?: string;
    error?: string;
}

function ClashesPageContent() {
    const searchParams = useSearchParams();
    const preselectedModelId = searchParams.get("modelId");

    const [models, setModels] = useState<BimModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModelId, setSelectedModelId] = useState<string>(preselectedModelId || "");
    const [setCategoryA, setSetCategoryA] = useState<string>("");
    const [setCategoryB, setSetCategoryB] = useState<string>("");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ClashResult | null>(null);

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

    const handleRunClash = async () => {
        if (!selectedModelId) return;

        setRunning(true);
        setResult(null);

        try {
            const body: Record<string, unknown> = {
                modelId: selectedModelId
            };

            if (setCategoryA) {
                body.setA = { category: setCategoryA };
            }
            if (setCategoryB) {
                body.setB = { category: setCategoryB };
            }

            const res = await fetch(`${getApiBase()}/api/bim/clash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            setResult(data);
        } catch {
            setResult({ error: "Failed to run clash detection", clashCount: 0, pairs: [] });
        } finally {
            setRunning(false);
        }
    };

    const exportToCsv = () => {
        if (!result?.pairs) return;

        const headers = [
            "Element A ID",
            "Element A GUID",
            "Element A Category",
            "Element B ID",
            "Element B GUID",
            "Element B Category"
        ];
        const rows = result.pairs.map((p) => [
            p.elementA.id,
            p.elementA.guid,
            p.elementA.category || "",
            p.elementB.id,
            p.elementB.guid,
            p.elementB.category || ""
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clashes-${selectedModelId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getSeverityColor = (count: number) => {
        if (count === 0) return "text-green-600";
        if (count < 10) return "text-yellow-600";
        if (count < 50) return "text-orange-600";
        return "text-red-600";
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
                        <span>Clash Detection</span>
                    </div>
                    <h1 className="mb-2 text-3xl font-bold">Clash Detection</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Detect geometric clashes between BIM elements using bounding box
                        intersection. Optionally filter by element categories to find specific
                        conflicts.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detection Settings</CardTitle>
                        <CardDescription>Configure clash detection parameters</CardDescription>
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

                        <Separator />

                        <div>
                            <Label htmlFor="setCategoryA">Set A Category (optional)</Label>
                            <Input
                                id="setCategoryA"
                                value={setCategoryA}
                                onChange={(e) => setSetCategoryA(e.target.value)}
                                placeholder="e.g., Pipe, Duct"
                                className="mt-2"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                First set of elements to check
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="setCategoryB">Set B Category (optional)</Label>
                            <Input
                                id="setCategoryB"
                                value={setCategoryB}
                                onChange={(e) => setSetCategoryB(e.target.value)}
                                placeholder="e.g., Wall, Beam"
                                className="mt-2"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                Second set of elements to check against
                            </p>
                        </div>

                        <Separator />

                        <Button
                            onClick={handleRunClash}
                            disabled={running || !selectedModelId}
                            className="w-full"
                        >
                            {running ? (
                                <>
                                    <Loader size={16} className="mr-2" />
                                    Detecting Clashes...
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="mr-2 h-4 w-4" />
                                    Run Detection
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
                                    <CardTitle>Detection Results</CardTitle>
                                    <CardDescription>
                                        Identified clashes between elements
                                    </CardDescription>
                                </div>
                                {result && !result.error && result.clashCount > 0 && (
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
                                            Analyzing bounding box intersections...
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
                                        {/* Summary */}
                                        <div className="bg-muted/50 flex items-center gap-4 rounded-lg p-6">
                                            <AlertTriangleIcon
                                                className={`h-12 w-12 ${getSeverityColor(result.clashCount)}`}
                                            />
                                            <div>
                                                <div
                                                    className={`text-4xl font-bold ${getSeverityColor(result.clashCount)}`}
                                                >
                                                    {result.clashCount}
                                                </div>
                                                <div className="text-muted-foreground">
                                                    Clashes Detected
                                                </div>
                                            </div>
                                            {result.clashCount === 0 && (
                                                <Badge variant="default" className="ml-auto">
                                                    No Issues Found
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Clash List */}
                                        {result.pairs.length > 0 && (
                                            <div className="max-h-96 overflow-y-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/30 sticky top-0">
                                                        <tr className="border-b">
                                                            <th className="px-4 py-2 text-left font-medium">
                                                                #
                                                            </th>
                                                            <th className="px-4 py-2 text-left font-medium">
                                                                Element A
                                                            </th>
                                                            <th className="px-4 py-2 text-left font-medium">
                                                                Element B
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {result.pairs.map((pair, i) => (
                                                            <tr
                                                                key={i}
                                                                className="hover:bg-muted/50 border-b"
                                                            >
                                                                <td className="text-muted-foreground px-4 py-2">
                                                                    {i + 1}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div>
                                                                        <code className="text-xs">
                                                                            {pair.elementA.guid}
                                                                        </code>
                                                                    </div>
                                                                    <div className="text-muted-foreground text-xs">
                                                                        {pair.elementA.category ||
                                                                            "Unknown"}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <div>
                                                                        <code className="text-xs">
                                                                            {pair.elementB.guid}
                                                                        </code>
                                                                    </div>
                                                                    <div className="text-muted-foreground text-xs">
                                                                        {pair.elementB.category ||
                                                                            "Unknown"}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {result.clashId && (
                                            <div className="text-muted-foreground text-xs">
                                                Clash Report ID:{" "}
                                                <code className="text-xs">{result.clashId}</code>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="text-muted-foreground text-center">
                                        <div className="mb-2 text-4xl">🔍</div>
                                        <p>Select a model and run detection to find clashes</p>
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

export default function ClashesPage() {
    return (
        <Suspense fallback={<div className="container mx-auto max-w-7xl p-6" />}>
            <ClashesPageContent />
        </Suspense>
    );
}
