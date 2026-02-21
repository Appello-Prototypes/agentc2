#!/usr/bin/env bun
/**
 * Security Hardening Migration
 *
 * Comprehensive migration script for the memory/vector tenant isolation changes.
 * Handles:
 *   1. Backfill organizationId on existing Document rows (from workspace)
 *   2. Re-embed documents with org metadata in RAG vectors
 *   3. Audit Mastra threads/memory for legacy unscoped data
 *
 * Prerequisites:
 *   - Schema must already be pushed (bun run db:push)
 *   - OPENAI_API_KEY must be set (for re-embedding)
 *
 * Usage:
 *   bun run scripts/migrations/security-hardening-migration.ts [--dry-run] [--skip-reembed]
 *
 * Safe to run multiple times (all operations are idempotent).
 */

import { prisma } from "../../packages/database/src";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_REEMBED = process.argv.includes("--skip-reembed");

function hr() {
    console.log("=".repeat(70));
}

async function main() {
    console.log();
    hr();
    console.log(`  Security Hardening Migration ${DRY_RUN ? "(DRY RUN)" : ""}`);
    hr();
    console.log();

    // ──────────────────────────────────────────────────────────────────────
    // Phase 1: Backfill Document.organizationId from workspace
    // ──────────────────────────────────────────────────────────────────────
    console.log("[Phase 1] Backfilling Document.organizationId from workspace\n");

    const documents = await prisma.document.findMany({
        include: {
            workspace: {
                select: { organizationId: true }
            }
        },
        orderBy: { createdAt: "asc" }
    });

    console.log(`  Total documents: ${documents.length}`);

    const needsBackfill = documents.filter((d) => !d.organizationId && d.workspace?.organizationId);
    const alreadySet = documents.filter((d) => d.organizationId);
    const orphans = documents.filter((d) => !d.organizationId && !d.workspace?.organizationId);

    console.log(`  Already have organizationId: ${alreadySet.length}`);
    console.log(`  Need backfill (have workspace): ${needsBackfill.length}`);
    console.log(`  Orphans (no workspace/org): ${orphans.length}`);

    if (orphans.length > 0) {
        console.log("\n  Orphan documents (will remain without org):");
        for (const doc of orphans) {
            console.log(
                `    - ${doc.slug} (id: ${doc.id}, workspaceId: ${doc.workspaceId || "null"}, created: ${doc.createdAt.toISOString().split("T")[0]})`
            );
        }
    }

    if (needsBackfill.length > 0) {
        if (DRY_RUN) {
            console.log(`\n  [DRY RUN] Would update ${needsBackfill.length} documents`);
        } else {
            let backfilled = 0;
            for (const doc of needsBackfill) {
                await prisma.document.update({
                    where: { id: doc.id },
                    data: { organizationId: doc.workspace!.organizationId }
                });
                backfilled++;
            }
            console.log(`\n  Backfilled ${backfilled} documents with organizationId`);
        }
    } else {
        console.log("\n  No documents need backfilling.");
    }

    console.log();
    hr();

    // ──────────────────────────────────────────────────────────────────────
    // Phase 2: Re-embed documents with org metadata in vectors
    // ──────────────────────────────────────────────────────────────────────
    console.log("[Phase 2] Re-embedding documents with org metadata in RAG vectors\n");

    if (SKIP_REEMBED) {
        console.log("  SKIPPED (--skip-reembed flag set)");
        console.log("  Run without --skip-reembed to re-embed documents.");
    } else {
        // Re-read documents after backfill
        const docsToReembed = await prisma.document.findMany({
            where: {
                organizationId: { not: null },
                embeddedAt: { not: null }
            },
            include: {
                workspace: { select: { organizationId: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        console.log(`  Documents eligible for re-embedding: ${docsToReembed.length}`);

        if (docsToReembed.length === 0) {
            console.log("  No documents to re-embed.");
        } else if (DRY_RUN) {
            console.log(`  [DRY RUN] Would re-embed ${docsToReembed.length} documents`);
            for (const doc of docsToReembed.slice(0, 10)) {
                console.log(
                    `    - ${doc.slug} (org: ${doc.organizationId}, chunks: ${doc.chunkCount})`
                );
            }
            if (docsToReembed.length > 10) {
                console.log(`    ... and ${docsToReembed.length - 10} more`);
            }
        } else {
            const { reembedDocument } =
                await import("../../packages/agentc2/src/documents/service");

            let reembedSuccess = 0;
            let reembedFailed = 0;

            for (const doc of docsToReembed) {
                try {
                    process.stdout.write(
                        `  Re-embedding "${doc.slug}" (${doc.chunkCount} chunks)...`
                    );
                    await reembedDocument(doc.id);
                    reembedSuccess++;
                    console.log(" done");
                } catch (error) {
                    reembedFailed++;
                    console.log(` FAILED: ${error instanceof Error ? error.message : error}`);
                }
            }

            console.log(`\n  Re-embed results: ${reembedSuccess} success, ${reembedFailed} failed`);
        }
    }

    console.log();
    hr();

    // ──────────────────────────────────────────────────────────────────────
    // Phase 3: Audit Mastra threads for legacy unscoped resourceIds
    // ──────────────────────────────────────────────────────────────────────
    console.log("[Phase 3] Auditing Mastra threads for legacy unscoped data\n");

    try {
        const threadStats = await prisma.$queryRawUnsafe<
            Array<{
                total: bigint;
                scoped: bigint;
                unscoped: bigint;
            }>
        >(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN "resourceId" LIKE '%:%' THEN 1 END) as scoped,
                COUNT(CASE WHEN "resourceId" NOT LIKE '%:%' OR "resourceId" IS NULL THEN 1 END) as unscoped
            FROM mastra_threads
        `);

        if (threadStats.length > 0) {
            const stats = threadStats[0]!;
            console.log(`  Total Mastra threads: ${stats.total}`);
            console.log(`  Org-scoped (contain ':'): ${stats.scoped}`);
            console.log(`  Unscoped (legacy): ${stats.unscoped}`);

            if (Number(stats.unscoped) > 0) {
                // Sample some unscoped threads
                const unscopedSample = await prisma.$queryRawUnsafe<
                    Array<{
                        id: string;
                        resourceId: string | null;
                        title: string | null;
                        createdAt: Date;
                    }>
                >(`
                    SELECT id, "resourceId", title, "createdAt" 
                    FROM mastra_threads 
                    WHERE "resourceId" NOT LIKE '%:%' OR "resourceId" IS NULL
                    ORDER BY "createdAt" DESC
                    LIMIT 10
                `);

                console.log(`\n  Sample unscoped threads (newest first):`);
                for (const t of unscopedSample) {
                    console.log(
                        `    - resourceId=${t.resourceId || "null"}, title="${(t.title || "").substring(0, 50)}", created=${t.createdAt}`
                    );
                }

                console.log(
                    `\n  NOTE: These legacy threads will not appear in new org-scoped queries.`
                );
                console.log(
                    `  This is expected behavior -- new conversations will create fresh org-scoped threads.`
                );
                console.log(
                    `  Legacy threads remain accessible only if queried with the exact old resourceId.`
                );
            } else {
                console.log("  All threads are org-scoped. No legacy data found.");
            }
        }
    } catch (error) {
        if (
            error instanceof Error &&
            (error.message.includes("does not exist") || error.message.includes("relation"))
        ) {
            console.log("  mastra_threads table does not exist yet. No legacy data to audit.");
        } else {
            console.error(
                "  Error querying Mastra threads:",
                error instanceof Error ? error.message : error
            );
        }
    }

    // Check memory_messages vector index
    try {
        const memoryStats = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(`
            SELECT COUNT(*) as total FROM memory_messages
        `);

        if (memoryStats.length > 0) {
            console.log(`\n  Memory messages vectors: ${memoryStats[0]!.total}`);
        }
    } catch {
        console.log("\n  memory_messages table does not exist yet.");
    }

    // Check rag_documents vector index
    try {
        const ragStats = await prisma.$queryRawUnsafe<
            Array<{ total: bigint; with_org: bigint; without_org: bigint }>
        >(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN metadata->>'organizationId' IS NOT NULL THEN 1 END) as with_org,
                COUNT(CASE WHEN metadata->>'organizationId' IS NULL THEN 1 END) as without_org
            FROM rag_documents
        `);

        if (ragStats.length > 0) {
            const rs = ragStats[0]!;
            console.log(`\n  RAG document vectors: ${rs.total}`);
            console.log(`  With organizationId in metadata: ${rs.with_org}`);
            console.log(`  Without organizationId (legacy): ${rs.without_org}`);

            if (Number(rs.without_org) > 0 && SKIP_REEMBED) {
                console.log(
                    `\n  WARNING: ${rs.without_org} vectors lack org metadata. Run without --skip-reembed to fix.`
                );
            }
        }
    } catch {
        console.log("\n  rag_documents table does not exist yet.");
    }

    console.log();
    hr();

    // ──────────────────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────────────────
    console.log("[Summary]\n");

    if (DRY_RUN) {
        console.log("  DRY RUN complete. No changes were made. Re-run without --dry-run to apply.");
    } else {
        console.log("  Migration complete.");
        console.log("  - Document.organizationId backfilled from workspace");
        if (!SKIP_REEMBED) {
            console.log("  - RAG vectors re-embedded with org metadata");
        }
        console.log("  - Mastra thread audit complete");
        console.log("\n  New conversations will automatically use org-scoped identifiers.");
        console.log(
            "  Legacy unscoped threads are naturally isolated (new queries won't match them)."
        );
    }

    console.log();
    await prisma.$disconnect();
}

main().catch((error) => {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
});
