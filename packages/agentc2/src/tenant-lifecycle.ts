/**
 * Tenant Lifecycle Hooks
 *
 * Handles cleanup of vector data and Mastra tables when an organization
 * is deleted. Prisma cascades handle relational data, but vectors stored
 * in PgVector tables are outside the cascade graph.
 */

import { vector } from "./vector";

const RAG_INDEX_NAME = "rag_documents";
const MEMORY_INDEX_NAME = "memory_messages";

/**
 * Purge all vector data associated with a deleted organization.
 *
 * Removes:
 * - RAG document vectors (metadata.organizationId = orgId)
 * - Memory message vectors (metadata.resource_id starts with orgId:)
 *
 * Should be called before or after Prisma cascade delete.
 * Idempotent -- safe to retry on failure.
 */
export async function cleanupOrgVectors(organizationId: string): Promise<{
    ragDeleted: boolean;
    memoryDeleted: boolean;
    errors: string[];
}> {
    const errors: string[] = [];
    let ragDeleted = false;
    let memoryDeleted = false;

    // 1. Delete RAG document vectors
    try {
        const indexes = await vector.listIndexes();
        if (indexes.includes(RAG_INDEX_NAME)) {
            await vector.deleteVectors({
                indexName: RAG_INDEX_NAME,
                filter: { organizationId }
            });
            ragDeleted = true;
        }
    } catch (error) {
        const msg = `Failed to delete RAG vectors for org ${organizationId}: ${error instanceof Error ? error.message : error}`;
        console.error(`[TenantLifecycle] ${msg}`);
        errors.push(msg);
    }

    // 2. Delete memory message vectors
    // Memory vectors use org-prefixed resource_id (e.g. "orgId:userId").
    // PgVector's filter API doesn't support $startsWith, so we use the
    // organizationId that is now embedded in chunk metadata.
    try {
        const indexes = await vector.listIndexes();
        if (indexes.includes(MEMORY_INDEX_NAME)) {
            await vector.deleteVectors({
                indexName: MEMORY_INDEX_NAME,
                filter: { organizationId }
            });
            memoryDeleted = true;
        }
    } catch (error) {
        const msg = `Failed to delete memory vectors for org ${organizationId}: ${error instanceof Error ? error.message : error}`;
        console.error(`[TenantLifecycle] ${msg}`);
        errors.push(msg);
    }

    // 3. Clean up Mastra thread/message storage via direct SQL
    // Mastra's PostgresStore doesn't expose thread cleanup by resource prefix,
    // so we use the underlying connection to delete threads whose resourceId
    // starts with the org prefix.
    try {
        const { prisma } = await import("@repo/database");
        const deleteResult = await prisma.$executeRawUnsafe(
            `DELETE FROM mastra_threads WHERE "resourceId" LIKE $1`,
            `${organizationId}:%`
        );
        console.log(
            `[TenantLifecycle] Cleaned ${deleteResult} Mastra threads for org ${organizationId}`
        );
    } catch (error) {
        const msg = `Failed to clean Mastra threads for org ${organizationId}: ${error instanceof Error ? error.message : error}`;
        console.error(`[TenantLifecycle] ${msg}`);
        errors.push(msg);
    }

    console.log(
        `[TenantLifecycle] Org ${organizationId} cleanup: RAG=${ragDeleted}, Memory=${memoryDeleted}, errors=${errors.length}`
    );

    return { ragDeleted, memoryDeleted, errors };
}
