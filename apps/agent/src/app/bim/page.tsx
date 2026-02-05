"use client";

import { useState, useEffect, useCallback } from "react";
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
    Alert,
    AlertDescription,
    AlertTitle,
    Loader,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { UploadIcon, RefreshCwIcon, LayersIcon, BoxIcon } from "lucide-react";

interface BimModel {
    id: string;
    name: string;
    organizationId: string;
    workspaceId: string | null;
    createdAt: string;
    updatedAt: string;
    _count?: {
        versions: number;
    };
}

interface IngestResult {
    modelId?: string;
    versionId?: string;
    elementCount?: number;
    status?: string;
    message?: string;
    error?: string;
}

export default function BimPage() {
    const [models, setModels] = useState<BimModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModel, setSelectedModel] = useState<BimModel | null>(null);

    // Upload state
    const [file, setFile] = useState<File | null>(null);
    const [modelName, setModelName] = useState("");
    const [sourceFormat, setSourceFormat] = useState("ifc");
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<IngestResult | null>(null);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            // Auto-set model name from file name if not already set
            if (!modelName) {
                setModelName(selectedFile.name.replace(/\.[^/.]+$/, ""));
            }
            // Auto-detect format from extension
            const ext = selectedFile.name.split(".").pop()?.toLowerCase();
            if (ext === "ifc") setSourceFormat("ifc");
            else if (ext === "nwd") setSourceFormat("nwd");
            else if (ext === "json") setSourceFormat("json");
            else if (ext === "csv") setSourceFormat("csv");
        }
    };

    const handleUpload = async () => {
        if (!file || !modelName) return;

        setUploading(true);
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("modelName", modelName);
            formData.append("sourceFormat", sourceFormat);

            const res = await fetch(`${getApiBase()}/api/bim/ingest`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            setUploadResult(data);

            if (!data.error) {
                // Refresh models list
                await loadModels();
                // Reset form
                setFile(null);
                setModelName("");
            }
        } catch {
            setUploadResult({ error: "Failed to upload BIM model" });
        } finally {
            setUploading(false);
        }
    };

    const handleSelectModel = (model: BimModel) => {
        setSelectedModel(model);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">BIM Models</h1>
                <p className="text-muted-foreground max-w-3xl">
                    Manage Building Information Models (BIM). Upload IFC, CSV, or JSON files to
                    enable automated takeoffs, clash detection, and version comparisons.
                </p>
            </div>

            <Tabs defaultValue="models" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="models">Models</TabsTrigger>
                    <TabsTrigger value="upload">Upload New</TabsTrigger>
                </TabsList>

                {/* Models Tab */}
                <TabsContent value="models" className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="text-muted-foreground text-sm">
                            {models.length} model{models.length !== 1 ? "s" : ""} found
                        </div>
                        <Button variant="outline" size="sm" onClick={loadModels} disabled={loading}>
                            <RefreshCwIcon className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader size={32} />
                        </div>
                    ) : models.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <BoxIcon className="text-muted-foreground mb-4 h-16 w-16" />
                                <h3 className="mb-2 text-lg font-semibold">No BIM Models</h3>
                                <p className="text-muted-foreground mb-4 text-center">
                                    Upload your first BIM model to get started with takeoffs and
                                    analysis.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {models.map((model) => (
                                <Card
                                    key={model.id}
                                    className="cursor-pointer transition-shadow hover:shadow-md"
                                    onClick={() => handleSelectModel(model)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <LayersIcon className="text-primary h-5 w-5" />
                                                <CardTitle className="text-base">
                                                    {model.name}
                                                </CardTitle>
                                            </div>
                                            <Badge variant="outline">
                                                {model._count?.versions ?? 0} version
                                                {(model._count?.versions ?? 0) !== 1 ? "s" : ""}
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Created {formatDate(model.createdAt)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-muted-foreground text-xs">
                                            ID: <code className="text-xs">{model.id}</code>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Model Details Modal/Panel could go here */}
                    {selectedModel && (
                        <Card className="border-primary">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{selectedModel.name}</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedModel(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                                <CardDescription>Model Details</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Model ID:</span>
                                        <code className="ml-2 text-xs">{selectedModel.id}</code>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Versions:</span>
                                        <span className="ml-2">
                                            {selectedModel._count?.versions ?? 0}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Created:</span>
                                        <span className="ml-2">
                                            {formatDate(selectedModel.createdAt)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Updated:</span>
                                        <span className="ml-2">
                                            {formatDate(selectedModel.updatedAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            (window.location.href = `/bim/takeoffs?modelId=${selectedModel.id}`)
                                        }
                                    >
                                        Run Takeoff
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            (window.location.href = `/bim/clashes?modelId=${selectedModel.id}`)
                                        }
                                    >
                                        Clash Detection
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Upload Tab */}
                <TabsContent value="upload" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload BIM Model</CardTitle>
                            <CardDescription>
                                Upload an IFC, CSV, or JSON file to create a new BIM model
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="file">File</Label>
                                    <div className="mt-2">
                                        <Input
                                            id="file"
                                            type="file"
                                            accept=".ifc,.nwd,.json,.csv"
                                            onChange={handleFileChange}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                    {file && (
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Selected: {file.name} ({(file.size / 1024).toFixed(1)}{" "}
                                            KB)
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="modelName">Model Name</Label>
                                    <Input
                                        id="modelName"
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                        placeholder="Enter a name for this model"
                                        className="mt-2"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="format">Source Format</Label>
                                    <Select
                                        value={sourceFormat}
                                        onValueChange={(value) => value && setSourceFormat(value)}
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ifc">
                                                IFC (Industry Foundation Classes)
                                            </SelectItem>
                                            <SelectItem value="nwd">NWD (Navisworks)</SelectItem>
                                            <SelectItem value="json">
                                                JSON (Pre-converted)
                                            </SelectItem>
                                            <SelectItem value="csv">CSV (Tabular Data)</SelectItem>
                                            <SelectItem value="speckle">Speckle (URL)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleUpload}
                                    disabled={uploading || !file || !modelName}
                                    className="w-full"
                                    size="lg"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader size={16} className="mr-2" />
                                            Uploading & Processing...
                                        </>
                                    ) : (
                                        <>
                                            <UploadIcon className="mr-2 h-4 w-4" />
                                            Upload Model
                                        </>
                                    )}
                                </Button>

                                {uploadResult && (
                                    <Alert variant={uploadResult.error ? "destructive" : "default"}>
                                        <AlertTitle>
                                            {uploadResult.error
                                                ? "Upload Failed"
                                                : uploadResult.status === "QUEUED"
                                                  ? "File Queued for Processing"
                                                  : "Upload Successful"}
                                        </AlertTitle>
                                        <AlertDescription>
                                            {uploadResult.error ? (
                                                uploadResult.error
                                            ) : (
                                                <div className="mt-2 space-y-2">
                                                    {uploadResult.message && (
                                                        <p className="text-muted-foreground text-sm">
                                                            {uploadResult.message}
                                                        </p>
                                                    )}
                                                    <div className="space-y-1">
                                                        <p>
                                                            <strong>Model ID:</strong>{" "}
                                                            <code className="text-xs">
                                                                {uploadResult.modelId}
                                                            </code>
                                                        </p>
                                                        <p>
                                                            <strong>Version ID:</strong>{" "}
                                                            <code className="text-xs">
                                                                {uploadResult.versionId}
                                                            </code>
                                                        </p>
                                                        {uploadResult.status && (
                                                            <p>
                                                                <strong>Status:</strong>{" "}
                                                                <Badge
                                                                    variant={
                                                                        uploadResult.status ===
                                                                        "QUEUED"
                                                                            ? "secondary"
                                                                            : "default"
                                                                    }
                                                                >
                                                                    {uploadResult.status}
                                                                </Badge>
                                                            </p>
                                                        )}
                                                        {uploadResult.elementCount !== undefined &&
                                                            uploadResult.elementCount > 0 && (
                                                                <p>
                                                                    <strong>
                                                                        Elements Imported:
                                                                    </strong>{" "}
                                                                    {uploadResult.elementCount}
                                                                </p>
                                                            )}
                                                    </div>
                                                </div>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
