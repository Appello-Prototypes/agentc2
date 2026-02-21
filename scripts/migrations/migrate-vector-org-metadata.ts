#!/usr/bin/env bun
/**
 * Migration: Add organizationId metadata to existing RAG vectors.
 *
 * This script:
 * 1. Reads all Document records that have a workspace (and therefore an org).
 * 2. For each document, re-upserts its RAG vector chunks with the
 *    organizationId included in the metadata.
 * 3. Reports on documents without a workspace (orphans) that need manual review.
 *
 * Usage:
 *   bun run scripts/migrations/migrate-vector-org-metadata.ts [--dry-run]
 *
 * Safe to run multiple times (upsert is idempotent).
 */

import { prisma } from "@repo/database";
import { reembedDocument } from "../../packages/agentc2/src/documents/service";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
    console.log(`[Migration] Vector org metadata migration ${DRY_RUN ? "(DRY RUN)" : ""}`);
    console.log("=".repeat(60));

    const documents = await prisma.document.findMany({
        include: {
            workspace: {
                select: { organizationId: true }
            }
        },
        orderBy: { createdAt: "asc" }
    });

    console.log(`[Migration] Found ${documents.length} documents total`);

    const withOrg = documents.filter((d) => d.workspace?.organizationId);
    const orphans = documents.filter((d) => !d.workspace?.organizationId);

    console.log(`[Migration] ${withOrg.length} documents with workspace/org`);
    console.log(`[Migration] ${orphans.length} orphan documents (no org -- need manual review)`);

    if (orphans.length > 0) {
        console.log("\n[Migration] Orphan documents:");
        for (const doc of orphans) {
            console.log(
                `  - ${doc.slug} (id: ${doc.id}, workspaceId: ${doc.workspaceId || "null"})`
            );
        }
    }

    if (DRY_RUN) {
        console.log("\n[Migration] DRY RUN -- no changes made.");
        console.log(`[Migration] Would re-embed ${withOrg.length} documents with org metadata.`);
        await prisma.$disconnect();
        process.exit(0);
    }

    let success = 0;
    let failed = 0;

    for (const doc of withOrg) {
        try {
            console.log(
                `[Migration] Re-embedding "${doc.slug}" (org: ${doc.workspace!.organizationId})...`
            );
            await reembedDocument(doc.id);
            success++;
        } catch (error) {
            console.error(
                `[Migration] FAILED to re-embed "${doc.slug}":`,
                error instanceof Error ? error.message : error
            );
            failed++;
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log(
        `[Migration] Complete: ${success} success, ${failed} failed, ${orphans.length} orphans`
    );

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
});
