/**
 * Document Service
 *
 * Manages Document CRUD with automatic RAG embedding.
 * Wraps the existing RAG pipeline (ingestDocument, queryRag, deleteDocument)
 * with a Prisma model layer for versioning, metadata, and workspace ownership.
 */

import { prisma, Prisma } from "@repo/database";
import {
    ingestDocument as ragIngest,
    queryRag,
    deleteDocument as ragDelete,
    type DocumentType,
    type ChunkOptions
} from "../rag/pipeline";

export interface CreateDocumentInput {
    slug: string;
    name: string;
    description?: string;
    content: string;
    contentType?: DocumentType;
    category?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    workspaceId?: string;
    organizationId?: string;
    type?: "USER" | "SYSTEM";
    createdBy?: string;
    chunkOptions?: ChunkOptions;
    /** Behavior when a document with the same slug already exists. */
    onConflict?: "error" | "skip" | "update";
}

export interface UpdateDocumentInput {
    name?: string;
    description?: string;
    content?: string;
    contentType?: DocumentType;
    category?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    changeSummary?: string;
    createdBy?: string;
    chunkOptions?: ChunkOptions;
}

export interface ListDocumentsInput {
    workspaceId?: string;
    organizationId?: string;
    category?: string;
    tags?: string[];
    type?: "USER" | "SYSTEM";
    skip?: number;
    take?: number;
}

export interface SearchDocumentsInput {
    query: string;
    documentId?: string;
    organizationId?: string;
    topK?: number;
    minScore?: number;
}

/**
 * Validate and sanitize a slug
 */
function validateSlug(slug: string): string {
    const sanitized = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    if (!sanitized) {
        throw new Error("Slug must contain at least one alphanumeric character");
    }
    return sanitized;
}

/**
 * Embed a document into the RAG vector store and update its DB record.
 * Runs as a background task -- callers should fire-and-forget.
 */
async function embedDocumentAsync(
    documentId: string,
    slug: string,
    content: string,
    options: {
        type: string;
        sourceName: string;
        chunkOptions?: ChunkOptions;
        organizationId?: string;
    }
) {
    const ragResult = await ragIngest(content, {
        organizationId: options.organizationId,
        type: options.type as DocumentType,
        sourceId: slug,
        sourceName: options.sourceName,
        chunkOptions: options.chunkOptions
    });

    // Update the document record with embedding results
    await prisma.document.update({
        where: { id: documentId },
        data: {
            vectorIds: ragResult.vectorIds,
            chunkCount: ragResult.chunksIngested,
            embeddedAt: new Date()
        }
    });

    console.log(
        `[DocumentService] Embedded "${slug}": ${ragResult.chunksIngested} chunks, ${ragResult.vectorIds.length} vectors`
    );
}

/**
 * Create a document with automatic RAG embedding.
 *
 * The DB record is created immediately and returned to the caller.
 * RAG embedding runs asynchronously in the background so the MCP tool
 * (and any other caller) is never blocked by slow OpenAI API calls.
 *
 * Check `embeddedAt` to know whether embedding has completed.
 */
export async function createDocument(input: CreateDocumentInput) {
    const contentType = input.contentType || "markdown";
    const slug = validateSlug(input.slug);
    const onConflict = input.onConflict || "error";

    const existing = await prisma.document.findUnique({ where: { slug } });

    if (existing) {
        if (onConflict === "skip") {
            return existing;
        }
        if (onConflict === "update") {
            return updateDocument(existing.id, {
                name: input.name,
                content: input.content,
                description: input.description,
                contentType: input.contentType,
                category: input.category,
                tags: input.tags,
                metadata: input.metadata,
                chunkOptions: input.chunkOptions
            });
        }
        throw new Error(`Document with slug "${slug}" already exists`);
    }

    const document = await prisma.document.create({
        data: {
            slug,
            name: input.name,
            description: input.description,
            content: input.content,
            contentType,
            vectorIds: [],
            chunkCount: 0,
            category: input.category,
            tags: input.tags || [],
            metadata: (input.metadata || {}) as Prisma.InputJsonValue,
            workspaceId: input.workspaceId,
            organizationId: input.organizationId,
            type: input.type || "USER",
            createdBy: input.createdBy
        }
    });

    // Resolve organizationId: prefer explicit, else derive from workspace
    let resolvedOrgId = input.organizationId;
    if (!resolvedOrgId && input.workspaceId) {
        const ws = await prisma.workspace.findUnique({
            where: { id: input.workspaceId },
            select: { organizationId: true }
        });
        resolvedOrgId = ws?.organizationId || undefined;
    }

    embedDocumentAsync(document.id, slug, input.content, {
        type: contentType,
        sourceName: input.name,
        chunkOptions: input.chunkOptions,
        organizationId: resolvedOrgId
    }).catch((error) => {
        console.error(`[DocumentService] Background embedding failed for "${slug}":`, error);
    });

    return document;
}

/**
 * Resolve a document ID or slug to the internal CUID.
 */
async function resolveDocumentId(idOrSlug: string): Promise<string> {
    const doc = await prisma.document.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        select: { id: true }
    });
    if (!doc) throw new Error(`Document not found: ${idOrSlug}`);
    return doc.id;
}

/**
 * Update a document with automatic re-embedding
 */
export async function updateDocument(idOrSlug: string, input: UpdateDocumentInput) {
    const id = await resolveDocumentId(idOrSlug);
    const existing = await prisma.document.findUniqueOrThrow({
        where: { id }
    });

    const contentChanged = input.content !== undefined && input.content !== existing.content;

    // If content changed, create version and re-embed
    if (contentChanged) {
        // Create version snapshot
        await prisma.documentVersion.create({
            data: {
                documentId: id,
                version: existing.version,
                content: existing.content,
                changeSummary: input.changeSummary,
                createdBy: input.createdBy
            }
        });

        // Delete old vectors
        await ragDelete(existing.slug);

        // Re-ingest with new content
        const ragResult = await ragIngest(input.content!, {
            type: (input.contentType || existing.contentType) as DocumentType,
            sourceId: existing.slug,
            sourceName: input.name || existing.name,
            chunkOptions: input.chunkOptions
        });

        // Update record with new content and vector info
        const document = await prisma.document.update({
            where: { id },
            data: {
                name: input.name,
                description: input.description,
                content: input.content,
                contentType: input.contentType,
                category: input.category,
                tags: input.tags,
                metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
                vectorIds: ragResult.vectorIds,
                chunkCount: ragResult.chunksIngested,
                embeddedAt: new Date(),
                version: existing.version + 1
            }
        });

        return document;
    }

    // Metadata-only update (no re-embedding)
    const document = await prisma.document.update({
        where: { id },
        data: {
            name: input.name,
            description: input.description,
            contentType: input.contentType,
            category: input.category,
            tags: input.tags,
            metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined
        }
    });

    return document;
}

/**
 * Delete a document and its vectors
 */
export async function deleteDocument(idOrSlug: string) {
    const id = await resolveDocumentId(idOrSlug);
    const existing = await prisma.document.findUniqueOrThrow({
        where: { id }
    });

    // Delete vectors from RAG store (resilient -- don't block DB delete if vectors fail)
    try {
        await ragDelete(existing.slug);
    } catch (error) {
        console.warn(`[DocumentService] Failed to delete vectors for "${existing.slug}":`, error);
    }

    // Delete from database (cascades to versions + skill junctions)
    await prisma.document.delete({
        where: { id }
    });
}

/**
 * Get a single document by ID or slug.
 * When organizationId is provided, the query is scoped to that org (query-level isolation).
 */
export async function getDocument(idOrSlug: string, organizationId?: string) {
    const where: Record<string, unknown> = {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    };
    if (organizationId) {
        where.organizationId = organizationId;
    }

    const document = await prisma.document.findFirst({
        where,
        include: {
            skills: {
                include: {
                    skill: {
                        select: { id: true, slug: true, name: true }
                    }
                }
            }
        }
    });

    return document;
}

/**
 * List documents with filtering
 */
export async function listDocuments(input: ListDocumentsInput = {}) {
    const where: Record<string, unknown> = {};

    if (input.organizationId) where.organizationId = input.organizationId;
    if (input.workspaceId) where.workspaceId = input.workspaceId;
    if (input.category) where.category = input.category;
    if (input.type) where.type = input.type;
    if (input.tags && input.tags.length > 0) {
        where.tags = { hasSome: input.tags };
    }

    const [documents, total] = await Promise.all([
        prisma.document.findMany({
            where,
            skip: input.skip || 0,
            take: input.take || 50,
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                contentType: true,
                chunkCount: true,
                embeddedAt: true,
                category: true,
                tags: true,
                type: true,
                version: true,
                workspaceId: true,
                createdAt: true,
                updatedAt: true,
                createdBy: true
            }
        }),
        prisma.document.count({ where })
    ]);

    return { documents, total };
}

/**
 * Semantic search across documents (optionally scoped to a specific document)
 */
export async function searchDocuments(input: SearchDocumentsInput) {
    const filter: Record<string, unknown> = {};

    if (input.documentId) {
        // Scope search to a specific document by its slug (used as documentId in RAG)
        const doc = await prisma.document.findUnique({
            where: { id: input.documentId },
            select: { slug: true }
        });
        if (doc) {
            filter.documentId = doc.slug;
        }
    }

    const results = await queryRag(input.query, {
        organizationId: input.organizationId,
        topK: input.topK ?? 5,
        minScore: input.minScore ?? 0.5,
        filter: Object.keys(filter).length > 0 ? filter : undefined
    });

    return results;
}

/**
 * Force re-embed a document (useful after config changes)
 */
export async function reembedDocument(id: string, chunkOptions?: ChunkOptions) {
    const existing = await prisma.document.findUniqueOrThrow({
        where: { id },
        include: { workspace: { select: { organizationId: true } } }
    });

    // Delete old vectors
    await ragDelete(existing.slug);

    // Resolve org for tenant-scoped vector metadata (prefer document's own field, fall back to workspace)
    const reembedOrgId =
        existing.organizationId ||
        (existing as { workspace?: { organizationId: string } | null }).workspace?.organizationId;

    // Re-ingest
    const ragResult = await ragIngest(existing.content, {
        organizationId: reembedOrgId || undefined,
        type: existing.contentType as DocumentType,
        sourceId: existing.slug,
        sourceName: existing.name,
        chunkOptions
    });

    // Update record
    const document = await prisma.document.update({
        where: { id },
        data: {
            vectorIds: ragResult.vectorIds,
            chunkCount: ragResult.chunksIngested,
            embeddedAt: new Date()
        }
    });

    return document;
}

/**
 * Get version history for a document
 */
export async function getDocumentVersions(documentId: string) {
    const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { version: "desc" }
    });

    return versions;
}
