-- CreateTable
CREATE TABLE IF NOT EXISTS "rag_chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sourceName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rag_chunk_organizationId_idx" ON "rag_chunk"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rag_chunk_documentId_idx" ON "rag_chunk"("documentId");

-- Add tsvector column with GIN index for full-text search
-- (Prisma doesn't support tsvector natively, so this must be raw SQL)
ALTER TABLE "rag_chunk" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED;

CREATE INDEX IF NOT EXISTS "rag_chunk_search_idx" ON "rag_chunk" USING GIN ("search_vector");
