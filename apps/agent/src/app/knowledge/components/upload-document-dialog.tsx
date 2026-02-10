"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { UploadIcon, FileTextIcon, ClipboardPasteIcon, XIcon, Loader2Icon } from "lucide-react";

// ==========================================
// Types
// ==========================================

interface UploadDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface UploadResult {
    id: string;
    slug: string;
    name: string;
    chunkCount: number;
}

const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown", ".json", ".html", ".htm", ".csv", ".pdf"];
const ACCEPT_STRING = ACCEPTED_EXTENSIONS.map((e) => e).join(",");

// ==========================================
// Helpers
// ==========================================

function nameToSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function extensionToContentType(filename: string): string {
    const ext = filename.includes(".") ? "." + filename.split(".").pop()!.toLowerCase() : "";
    switch (ext) {
        case ".md":
        case ".markdown":
            return "markdown";
        case ".html":
        case ".htm":
            return "html";
        case ".json":
            return "json";
        default:
            return "text";
    }
}

// ==========================================
// Component
// ==========================================

export function UploadDocumentDialog({ open, onOpenChange, onSuccess }: UploadDocumentDialogProps) {
    const [mode, setMode] = useState<"paste" | "file">("file");

    // Form fields
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState("");
    const [contentType, setContentType] = useState("markdown");

    // Paste mode
    const [pasteContent, setPasteContent] = useState("");

    // File mode
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Submit state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<UploadResult | null>(null);

    // --- Auto-generate slug from name ---
    const handleNameChange = useCallback(
        (value: string) => {
            setName(value);
            if (!slugManuallyEdited) {
                setSlug(nameToSlug(value));
            }
        },
        [slugManuallyEdited]
    );

    const handleSlugChange = useCallback((value: string) => {
        setSlug(value);
        setSlugManuallyEdited(true);
    }, []);

    // --- File handling ---
    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file);
        setError(null);

        // Auto-fill name and slug from filename
        const baseName = file.name.replace(/\.[^.]+$/, "");
        setName(baseName);
        setSlug(nameToSlug(baseName));
        setSlugManuallyEdited(false);
        setContentType(extensionToContentType(file.name));
    }, []);

    const handleDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        },
        [handleFileSelect]
    );

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleFileInputChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
        },
        [handleFileSelect]
    );

    const clearFile = useCallback(() => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    // --- Reset form ---
    const resetForm = useCallback(() => {
        setName("");
        setSlug("");
        setSlugManuallyEdited(false);
        setDescription("");
        setCategory("");
        setTags("");
        setContentType("markdown");
        setPasteContent("");
        setSelectedFile(null);
        setError(null);
        setResult(null);
        setSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    // --- Submit ---
    const handleSubmit = useCallback(async () => {
        setError(null);

        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        if (!slug.trim()) {
            setError("Slug is required");
            return;
        }

        if (mode === "paste" && !pasteContent.trim()) {
            setError("Content is required");
            return;
        }
        if (mode === "file" && !selectedFile) {
            setError("Please select a file");
            return;
        }

        setSubmitting(true);

        try {
            let response: Response;

            if (mode === "paste") {
                // Direct JSON post to /api/documents
                const tagsArray = tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);

                response = await fetch(`${getApiBase()}/api/documents`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        slug: slug.trim(),
                        name: name.trim(),
                        content: pasteContent,
                        contentType,
                        description: description.trim() || undefined,
                        category: category.trim() || undefined,
                        tags: tagsArray.length > 0 ? tagsArray : undefined
                    })
                });
            } else {
                // Multipart upload to /api/documents/upload
                const formData = new FormData();
                formData.append("file", selectedFile!);
                formData.append("name", name.trim());
                formData.append("slug", slug.trim());
                if (description.trim()) formData.append("description", description.trim());
                if (category.trim()) formData.append("category", category.trim());
                if (tags.trim()) formData.append("tags", tags.trim());

                response = await fetch(`${getApiBase()}/api/documents/upload`, {
                    method: "POST",
                    body: formData
                });
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `Upload failed (${response.status})`);
            }

            const data = await response.json();
            setResult({
                id: data.id,
                slug: data.slug,
                name: data.name,
                chunkCount: data.chunkCount
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setSubmitting(false);
        }
    }, [mode, name, slug, description, category, tags, contentType, pasteContent, selectedFile]);

    // --- Close handler ---
    const handleClose = useCallback(
        (open: boolean) => {
            if (!open) {
                resetForm();
                if (result) onSuccess?.();
            }
            onOpenChange(open);
        },
        [resetForm, result, onSuccess, onOpenChange]
    );

    // --- View document ---
    const handleViewDocument = useCallback(() => {
        if (result) {
            onSuccess?.();
            onOpenChange(false);
            // Navigate via window since we're in a dialog
            window.location.href = `/knowledge/${result.id}`;
        }
    }, [result, onSuccess, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle>Add Document</DialogTitle>
                    <DialogDescription>
                        Upload a file or paste content to add to the knowledge base. Documents are
                        automatically chunked and embedded for semantic search.
                    </DialogDescription>
                </DialogHeader>

                {/* Success state */}
                {result ? (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                            <p className="font-medium text-green-400">
                                Document created successfully
                            </p>
                            <div className="mt-2 space-y-1 text-sm">
                                <p>
                                    <span className="text-muted-foreground">Name:</span>{" "}
                                    {result.name}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Slug:</span>{" "}
                                    <code className="text-xs">{result.slug}</code>
                                </p>
                                <p>
                                    <span className="text-muted-foreground">Chunks:</span>{" "}
                                    <Badge variant="secondary">{result.chunkCount}</Badge> vector
                                    embeddings created
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                }}
                            >
                                Add Another
                            </Button>
                            <Button onClick={handleViewDocument}>View Document</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        {/* Mode tabs */}
                        <Tabs
                            defaultValue="file"
                            value={mode}
                            onValueChange={(v) => setMode(v as "paste" | "file")}
                        >
                            <TabsList className="w-full">
                                <TabsTrigger value="file" className="flex-1">
                                    <UploadIcon className="mr-1.5 size-3.5" />
                                    Upload File
                                </TabsTrigger>
                                <TabsTrigger value="paste" className="flex-1">
                                    <ClipboardPasteIcon className="mr-1.5 size-3.5" />
                                    Paste Content
                                </TabsTrigger>
                            </TabsList>

                            {/* File upload tab */}
                            <TabsContent value="file" className="mt-3 space-y-4">
                                {/* Drop zone */}
                                <div
                                    className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                                        isDragOver
                                            ? "border-primary bg-primary/5"
                                            : selectedFile
                                              ? "border-primary/50 bg-primary/5"
                                              : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                    }`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPT_STRING}
                                        onChange={handleFileInputChange}
                                        className="hidden"
                                    />

                                    {selectedFile ? (
                                        <div className="flex items-center gap-3 overflow-hidden p-4">
                                            <FileTextIcon className="text-primary size-8 shrink-0" />
                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                <p className="truncate text-sm font-medium">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="size-8 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearFile();
                                                }}
                                            >
                                                <XIcon className="size-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center">
                                            <UploadIcon className="text-muted-foreground mx-auto mb-2 size-8" />
                                            <p className="text-sm font-medium">
                                                Drop a file here or click to browse
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                Supports: TXT, MD, JSON, HTML, CSV, PDF
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Paste content tab */}
                            <TabsContent value="paste" className="mt-3 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="content-type">Content Type</Label>
                                    <Select
                                        value={contentType}
                                        onValueChange={(v) => v && setContentType(v)}
                                    >
                                        <SelectTrigger id="content-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="markdown">Markdown</SelectItem>
                                            <SelectItem value="text">Plain Text</SelectItem>
                                            <SelectItem value="html">HTML</SelectItem>
                                            <SelectItem value="json">JSON</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="paste-content">Content</Label>
                                    <Textarea
                                        id="paste-content"
                                        placeholder="Paste your document content here..."
                                        value={pasteContent}
                                        onChange={(e) => setPasteContent(e.target.value)}
                                        rows={8}
                                        className="font-mono text-sm"
                                    />
                                    {pasteContent && (
                                        <p className="text-muted-foreground text-xs">
                                            {pasteContent.length.toLocaleString()} characters
                                        </p>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Shared metadata fields */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="doc-name">
                                        Name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="doc-name"
                                        placeholder="My Document"
                                        value={name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="doc-slug">
                                        Slug <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="doc-slug"
                                        placeholder="my-document"
                                        value={slug}
                                        onChange={(e) => handleSlugChange(e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="doc-description">Description</Label>
                                <Input
                                    id="doc-description"
                                    placeholder="Brief description (optional)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="doc-category">Category</Label>
                                    <Input
                                        id="doc-category"
                                        placeholder="e.g. engineering"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="doc-tags">Tags</Label>
                                    <Input
                                        id="doc-tags"
                                        placeholder="tag1, tag2, tag3"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button
                                variant="outline"
                                onClick={() => handleClose(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <UploadIcon className="mr-1.5 size-4" />
                                        Add Document
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
