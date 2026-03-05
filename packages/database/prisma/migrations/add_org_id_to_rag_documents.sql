-- Add organizationId column to rag_documents table for database-level tenant isolation.
-- This supplements the existing metadata-based filtering with a proper column index.
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS organization_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rag_documents_organization_id ON rag_documents (organization_id);
