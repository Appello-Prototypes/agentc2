"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton
} from "@repo/ui";

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

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "never";
    const date = new Date(dateStr);
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

export default function KnowledgePage() {
    const router = useRouter();
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    useEffect(() => {
        async function fetchDocuments() {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (categoryFilter !== "all") params.set("category", categoryFilter);
                if (typeFilter !== "all") params.set("type", typeFilter);

                const res = await fetch(`${getApiBase()}/api/documents?${params.toString()}`);
                const data = await res.json();

                if (data.documents) {
                    setDocuments(data.documents);
                    setTotal(data.total);
                }
            } catch (error) {
                console.error("Failed to fetch documents:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchDocuments();
    }, [categoryFilter, typeFilter]);

    // Client-side name/slug search filtering
    const filtered = search
        ? documents.filter(
              (d) =>
                  d.name.toLowerCase().includes(search.toLowerCase()) ||
                  d.slug.toLowerCase().includes(search.toLowerCase()) ||
                  (d.description || "").toLowerCase().includes(search.toLowerCase())
          )
        : documents;

    // Extract unique categories for filter
    const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))] as string[];

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Knowledge Base</h1>
                    <p className="text-muted-foreground text-sm">
                        {total} document{total !== 1 ? "s" : ""} with embedded vectors for semantic
                        search
                    </p>
                </div>
                <Button variant="outline" disabled>
                    Add Document
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <Input
                    placeholder="Search documents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                />
                {categories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
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
                <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
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

            {/* Document Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-lg" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground text-lg">No documents found</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {total === 0
                                ? "Create a document via the API or MCP tools to get started."
                                : "Try adjusting your search or filters."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((doc) => (
                        <Card
                            key={doc.id}
                            className="hover:border-primary/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/knowledge/${doc.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base">
                                            {doc.name}
                                        </CardTitle>
                                        <CardDescription className="font-mono text-xs">
                                            {doc.slug}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                                        v{doc.version}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {doc.description && (
                                    <p className="text-muted-foreground line-clamp-2 text-sm">
                                        {doc.description}
                                    </p>
                                )}

                                {/* Embedding Stats */}
                                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                                    <span className="flex items-center gap-1">
                                        <span className="bg-primary size-1.5 rounded-full" />
                                        {doc.chunkCount} chunk{doc.chunkCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="text-muted-foreground/40">|</span>
                                    <span>Embedded {formatRelativeTime(doc.embeddedAt)}</span>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px]">
                                        {doc.contentType}
                                    </Badge>
                                    {doc.type === "SYSTEM" && (
                                        <Badge variant="outline" className="text-[10px]">
                                            System
                                        </Badge>
                                    )}
                                    {doc.category && (
                                        <Badge variant="outline" className="text-[10px]">
                                            {doc.category}
                                        </Badge>
                                    )}
                                    {doc.tags.slice(0, 3).map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="outline"
                                            className="text-muted-foreground text-[10px]"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                    {doc.tags.length > 3 && (
                                        <span className="text-muted-foreground text-[10px]">
                                            +{doc.tags.length - 3}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
