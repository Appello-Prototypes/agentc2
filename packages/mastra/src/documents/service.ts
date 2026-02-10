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
    type?: "USER" | "SYSTEM";
    createdBy?: string;
    chunkOptions?: ChunkOptions;
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
    category?: string;
    tags?: string[];
    type?: "USER" | "SYSTEM";
    skip?: number;
    take?: number;
}

export interface SearchDocumentsInput {
    query: string;
    documentId?: string;
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
 * Create a document with automatic RAG embedding
 */
export async function createDocument(input: CreateDocumentInput) {
    const contentType = input.contentType || "markdown";
    const slug = validateSlug(input.slug);

    // Check for duplicate slug
    const existing = await prisma.document.findUnique({ where: { slug } });
    if (existing) {
        throw new Error(`Document with slug "${slug}" already exists`);
    }

    // Ingest into RAG vector store
    const ragResult = await ragIngest(input.content, {
        type: contentType,
        sourceId: slug,
        sourceName: input.name,
        chunkOptions: input.chunkOptions
    });

    // Create Prisma record -- if this fails, clean up vectors
    try {
        const document = await prisma.document.create({
            data: {
                slug,
                name: input.name,
                description: input.description,
                content: input.content,
                contentType,
                vectorIds: ragResult.vectorIds,
                chunkCount: ragResult.chunksIngested,
                embeddedAt: new Date(),
                category: input.category,
                tags: input.tags || [],
                metadata: (input.metadata || {}) as Prisma.InputJsonValue,
                workspaceId: input.workspaceId,
                type: input.type || "USER",
                createdBy: input.createdBy
            }
        });

        return document;
    } catch (dbError) {
        // Clean up orphaned vectors if DB insert failed
        try {
            await ragDelete(slug);
        } catch {
            // Best effort cleanup
        }
        throw dbError;
    }
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
 * Get a single document by ID or slug
 */
export async function getDocument(idOrSlug: string) {
    // Try by ID first, then by slug
    const document = await prisma.document.findFirst({
        where: {
            OR: [{ id: idOrSlug }, { slug: idOrSlug }]
        },
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
        where: { id }
    });

    // Delete old vectors
    await ragDelete(existing.slug);

    // Re-ingest
    const ragResult = await ragIngest(existing.content, {
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
