"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { UploadDocumentDialog } from "./components/upload-document-dialog";
import {
    Badge,
    Button,
    Card,
    CardContent,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DatabaseIcon,
    FileTextIcon,
    AlertTriangleIcon,
    SearchIcon
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentSummary {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    contentType: string;
    chunkCount: number;
    embeddedAt: string | null;
    category: string | null;
    tags: string[];
    type: string;
    version: number;
    workspaceId: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

interface VectorGroup {
    documentId: string;
    sourceName: string;
    chunkCount: number;
    firstIngestedAt: string;
    lastIngestedAt: string;
    hasDocumentRecord: boolean;
    sampleText: string;
}

interface Stats {
    documents: number;
    totalVectors: number;
    vectorGroups: number;
    orphanGroups: number;
    ragChunks: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "unknown";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function truncateText(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function KnowledgePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("documents");
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Stats
    const [stats, setStats] = useState<Stats | null>(null);

    // Documents tab
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [docsTotal, setDocsTotal] = useState(0);
    const [docsLoading, setDocsLoading] = useState(true);
    const [docsPage, setDocsPage] = useState(1);
    const [docsSearch, setDocsSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const DOCS_PAGE_SIZE = 25;

    // Vectors tab
    const [vectorGroups, setVectorGroups] = useState<VectorGroup[]>([]);
    const [vectorsTotal, setVectorsTotal] = useState(0);
    const [vectorsTotalPages, setVectorsTotalPages] = useState(0);
    const [vectorsLoading, setVectorsLoading] = useState(false);
    const [vectorsPage, setVectorsPage] = useState(1);
    const [vectorsSearch, setVectorsSearch] = useState("");
    const [vectorsOrphansOnly, setVectorsOrphansOnly] = useState(false);
    const [vectorsLoaded, setVectorsLoaded] = useState(false);
    const VECTORS_PAGE_SIZE = 25;

    const handleUploadSuccess = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // Fetch stats
    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch(`${getApiBase()}/api/vectors/stats`);
                const data = await res.json();
                if (!res.ok) return;
                setStats(data);
            } catch {
                // Stats are non-critical
            }
        }
        fetchStats();
    }, [refreshKey]);

    // Fetch documents
    useEffect(() => {
        async function fetchDocuments() {
            try {
                setDocsLoading(true);
                const params = new URLSearchParams();
                if (categoryFilter !== "all") params.set("category", categoryFilter);
                if (typeFilter !== "all") params.set("type", typeFilter);
                params.set("skip", String((docsPage - 1) * DOCS_PAGE_SIZE));
                params.set("take", String(DOCS_PAGE_SIZE));

                const res = await fetch(`${getApiBase()}/api/documents?${params.toString()}`);
                const data = await res.json();

                if (data.documents) {
                    setDocuments(data.documents);
                    setDocsTotal(data.total);
                }
            } catch (error) {
                console.error("Failed to fetch documents:", error);
            } finally {
                setDocsLoading(false);
            }
        }
        fetchDocuments();
    }, [categoryFilter, typeFilter, docsPage, refreshKey]);

    // Fetch vector groups (lazy - only when tab selected)
    const fetchVectors = useCallback(async () => {
        try {
            setVectorsLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(vectorsPage));
            params.set("pageSize", String(VECTORS_PAGE_SIZE));
            if (vectorsSearch) params.set("search", vectorsSearch);
            if (vectorsOrphansOnly) params.set("orphansOnly", "true");

            const res = await fetch(`${getApiBase()}/api/vectors?${params.toString()}`);
            const data = await res.json();

            if (data.groups) {
                setVectorGroups(data.groups);
                setVectorsTotal(data.total);
                setVectorsTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch vectors:", error);
        } finally {
            setVectorsLoading(false);
            setVectorsLoaded(true);
        }
    }, [vectorsPage, vectorsSearch, vectorsOrphansOnly]);

    useEffect(() => {
        if (activeTab === "vectors") {
            fetchVectors();
        }
    }, [activeTab, fetchVectors, refreshKey]);

    // Client-side search for documents
    const filteredDocs = docsSearch
        ? documents.filter(
              (d) =>
                  d.name.toLowerCase().includes(docsSearch.toLowerCase()) ||
                  d.slug.toLowerCase().includes(docsSearch.toLowerCase()) ||
                  (d.description || "").toLowerCase().includes(docsSearch.toLowerCase())
          )
        : documents;

    const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))] as string[];

    const docsTotalPages = Math.ceil(docsTotal / DOCS_PAGE_SIZE);

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
                {/* Header with stats */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Knowledge Base</h1>
                        {stats ? (
                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span>
                                    <strong>{docsTotal}</strong> document
                                    {docsTotal !== 1 ? "s" : ""}
                                </span>
                                <span className="text-muted-foreground/30">|</span>
                                <span>
                                    <strong>{stats.totalVectors.toLocaleString()}</strong> vector
                                    embeddings across <strong>{stats.vectorGroups}</strong> groups
                                </span>
                                {stats.orphanGroups > 0 && (
                                    <>
                                        <span className="text-muted-foreground/30">|</span>
                                        <span className="text-amber-500">
                                            <strong>{stats.orphanGroups}</strong> orphaned group
                                            {stats.orphanGroups !== 1 ? "s" : ""}
                                        </span>
                                    </>
                                )}
                            </div>
                        ) : (
                            <Skeleton className="mt-1 h-5 w-96" />
                        )}
                    </div>
                    <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                        Add Document
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="documents" className="gap-1.5">
                            <FileTextIcon className="size-3.5" />
                            Documents
                            {!docsLoading && (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                    {docsTotal}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="vectors" className="gap-1.5">
                            <DatabaseIcon className="size-3.5" />
                            Vector Store
                            {vectorsLoaded ? (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                    {vectorsTotal} groups
                                </Badge>
                            ) : stats ? (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                    {stats.vectorGroups} groups
                                </Badge>
                            ) : null}
                        </TabsTrigger>
                    </TabsList>

                    {/* ═══════════ Documents Tab ═══════════ */}
                    <TabsContent value="documents" className="mt-4 space-y-4">
                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <div className="relative max-w-xs flex-1">
                                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search documents..."
                                    value={docsSearch}
                                    onChange={(e) => setDocsSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {categories.length > 0 && (
                                <Select
                                    value={categoryFilter}
                                    onValueChange={(v) => {
                                        v && setCategoryFilter(v);
                                        setDocsPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select
                                value={typeFilter}
                                onValueChange={(v) => {
                                    v && setTypeFilter(v);
                                    setDocsPage(1);
                                }}
                            >
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="USER">User</SelectItem>
                                    <SelectItem value="SYSTEM">System</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Documents table */}
                        {docsLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : filteredDocs.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <p className="text-muted-foreground text-lg">
                                        No documents found
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {docsTotal === 0
                                            ? 'Click "Add Document" to upload a file or paste content.'
                                            : "Try adjusting your search or filters."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="overflow-hidden rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="px-4 py-2.5 text-left font-medium">
                                                    Name
                                                </th>
                                                <th className="px-4 py-2.5 text-left font-medium">
                                                    Type
                                                </th>
                                                <th className="px-4 py-2.5 text-right font-medium">
                                                    Chunks
                                                </th>
                                                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                                                    Category
                                                </th>
                                                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                                                    Embedded
                                                </th>
                                                <th className="px-4 py-2.5 text-right font-medium">
                                                    Version
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDocs.map((doc) => (
                                                <tr
                                                    key={doc.id}
                                                    className="hover:bg-muted/30 cursor-pointer border-b transition-colors last:border-b-0"
                                                    onClick={() =>
                                                        router.push(`/knowledge/${doc.id}`)
                                                    }
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">
                                                                {doc.name}
                                                            </p>
                                                            <p className="text-muted-foreground truncate font-mono text-xs">
                                                                {doc.slug}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge
                                                            variant={
                                                                doc.type === "SYSTEM"
                                                                    ? "outline"
                                                                    : "secondary"
                                                            }
                                                            className="text-[10px]"
                                                        >
                                                            {doc.type}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        <span className="flex items-center justify-end gap-1.5">
                                                            <span
                                                                className={`size-1.5 rounded-full ${doc.chunkCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                                                            />
                                                            {doc.chunkCount}
                                                        </span>
                                                    </td>
                                                    <td className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                                                        {doc.category || "—"}
                                                    </td>
                                                    <td className="text-muted-foreground hidden px-4 py-3 lg:table-cell">
                                                        {formatRelativeTime(doc.embeddedAt)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            v{doc.version}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {docsTotalPages > 1 && (
                                    <Pagination
                                        page={docsPage}
                                        totalPages={docsTotalPages}
                                        total={docsTotal}
                                        pageSize={DOCS_PAGE_SIZE}
                                        onPageChange={setDocsPage}
                                    />
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* ═══════════ Vector Store Tab ═══════════ */}
                    <TabsContent value="vectors" className="mt-4 space-y-4">
                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <div className="relative max-w-xs flex-1">
                                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search by document ID or source..."
                                    value={vectorsSearch}
                                    onChange={(e) => {
                                        setVectorsSearch(e.target.value);
                                        setVectorsPage(1);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") fetchVectors();
                                    }}
                                    className="pl-9"
                                />
                            </div>
                            <Button
                                variant={vectorsOrphansOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setVectorsOrphansOnly(!vectorsOrphansOnly);
                                    setVectorsPage(1);
                                }}
                                className="gap-1.5"
                            >
                                <AlertTriangleIcon className="size-3.5" />
                                Orphaned Only
                                {stats && stats.orphanGroups > 0 && (
                                    <Badge
                                        variant={vectorsOrphansOnly ? "secondary" : "outline"}
                                        className="ml-0.5 text-[10px]"
                                    >
                                        {stats.orphanGroups}
                                    </Badge>
                                )}
                            </Button>
                        </div>

                        {/* Vector groups table */}
                        {vectorsLoading && !vectorsLoaded ? (
                            <div className="space-y-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : vectorGroups.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <p className="text-muted-foreground text-lg">
                                        {vectorsOrphansOnly
                                            ? "No orphaned vector groups found"
                                            : "No vectors in the store"}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {vectorsOrphansOnly
                                            ? "All vector groups have a corresponding managed document."
                                            : "Ingest documents to populate the vector store."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="overflow-hidden rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="px-4 py-2.5 text-left font-medium">
                                                    Document ID
                                                </th>
                                                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                                                    Source
                                                </th>
                                                <th className="px-4 py-2.5 text-right font-medium">
                                                    Chunks
                                                </th>
                                                <th className="px-4 py-2.5 text-center font-medium">
                                                    Managed
                                                </th>
                                                <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                                                    Ingested
                                                </th>
                                                <th className="hidden px-4 py-2.5 text-left font-medium xl:table-cell">
                                                    Preview
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vectorGroups.map((group) => (
                                                <tr
                                                    key={group.documentId}
                                                    className="hover:bg-muted/30 cursor-pointer border-b transition-colors last:border-b-0"
                                                    onClick={() =>
                                                        router.push(
                                                            `/knowledge/vectors/${encodeURIComponent(group.documentId)}`
                                                        )
                                                    }
                                                >
                                                    <td className="max-w-[240px] px-4 py-3">
                                                        <p className="truncate font-mono text-xs font-medium">
                                                            {group.documentId}
                                                        </p>
                                                    </td>
                                                    <td className="text-muted-foreground hidden max-w-[200px] px-4 py-3 md:table-cell">
                                                        <p className="truncate text-xs">
                                                            {group.sourceName}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        {group.chunkCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {group.hasDocumentRecord ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-[10px]"
                                                            >
                                                                Yes
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-amber-500/50 text-[10px] text-amber-500"
                                                            >
                                                                Orphan
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="text-muted-foreground hidden px-4 py-3 lg:table-cell">
                                                        {formatRelativeTime(group.lastIngestedAt)}
                                                    </td>
                                                    <td className="text-muted-foreground hidden max-w-[300px] px-4 py-3 xl:table-cell">
                                                        <p className="truncate text-xs">
                                                            {truncateText(
                                                                group.sampleText || "",
                                                                120
                                                            )}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {vectorsTotalPages > 1 && (
                                    <Pagination
                                        page={vectorsPage}
                                        totalPages={vectorsTotalPages}
                                        total={vectorsTotal}
                                        pageSize={VECTORS_PAGE_SIZE}
                                        onPageChange={setVectorsPage}
                                    />
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>

                <UploadDocumentDialog
                    open={uploadDialogOpen}
                    onOpenChange={setUploadDialogOpen}
                    onSuccess={handleUploadSuccess}
                />
            </div>
        </div>
    );
}

// ── Pagination Component ──────────────────────────────────────────────────────

function Pagination({
    page,
    totalPages,
    total,
    pageSize,
    onPageChange
}: {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}) {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    return (
        <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
                Showing {start}–{end} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="text-muted-foreground px-3 text-sm tabular-nums">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRightIcon className="size-4" />
                </Button>
            </div>
        </div>
    );
}
