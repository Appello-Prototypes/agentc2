#!/usr/bin/env bun
/**
 * One-time migration: moves agent workspace files from the legacy flat layout
 *   {WORKSPACE_ROOT}/{agentSlug}/
 * to the org-prefixed layout
 *   {WORKSPACE_ROOT}/{organizationId}/{agentSlug}/
 *
 * Agents without a workspace/org are placed under _system/.
 *
 * Usage:
 *   bun run scripts/migrate-workspace-paths.ts          # dry-run (default)
 *   bun run scripts/migrate-workspace-paths.ts --apply  # actually move files
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, renameSync, readdirSync } from "fs";
import { join } from "path";

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || "/var/lib/agentc2/workspaces";
const SYSTEM_NAMESPACE = "_system";
const dryRun = !process.argv.includes("--apply");

function countFiles(dir: string): number {
    let count = 0;
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile()) {
                count++;
            } else if (entry.isDirectory()) {
                count += countFiles(join(dir, entry.name));
            }
        }
    } catch {
        // Ignore read errors
    }
    return count;
}

async function main() {
    const prisma = new PrismaClient();

    console.log(`Workspace root: ${WORKSPACE_ROOT}`);
    console.log(`Mode: ${dryRun ? "DRY RUN (pass --apply to execute)" : "APPLYING CHANGES"}\n`);

    if (!existsSync(WORKSPACE_ROOT)) {
        console.log("Workspace root does not exist. Nothing to migrate.");
        await prisma.$disconnect();
        return;
    }

    const agents = await prisma.agent.findMany({
        select: {
            id: true,
            slug: true,
            tenantId: true,
            workspace: { select: { organizationId: true } }
        }
    });

    const agentOrgMap = new Map<string, string>();
    for (const agent of agents) {
        const orgId = agent.workspace?.organizationId || agent.tenantId || SYSTEM_NAMESPACE;
        agentOrgMap.set(agent.slug, orgId);
    }

    const entries = readdirSync(WORKSPACE_ROOT, { withFileTypes: true });
    let moved = 0;
    let skipped = 0;

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirName = entry.name;
        const legacyPath = join(WORKSPACE_ROOT, dirName);

        // Skip if this directory is already an org-prefix directory
        const isOrgDir = agents.some(
            (a) => a.workspace?.organizationId === dirName || a.tenantId === dirName
        );
        if (isOrgDir || dirName === SYSTEM_NAMESPACE) {
            console.log(`  SKIP (org dir): ${dirName}/`);
            skipped++;
            continue;
        }

        const orgId = agentOrgMap.get(dirName) || SYSTEM_NAMESPACE;
        const newPath = join(WORKSPACE_ROOT, orgId, dirName);

        const fileCount = countFiles(legacyPath);
        if (fileCount === 0) {
            console.log(`  SKIP (empty): ${dirName}/`);
            skipped++;
            continue;
        }

        console.log(`  MOVE: ${dirName}/ -> ${orgId}/${dirName}/ (${fileCount} files)`);

        if (!dryRun) {
            mkdirSync(join(WORKSPACE_ROOT, orgId), { recursive: true });
            renameSync(legacyPath, newPath);
        }

        moved++;
    }

    console.log(`\nSummary: ${moved} moved, ${skipped} skipped`);
    if (dryRun && moved > 0) {
        console.log("Run with --apply to execute the migration.");
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
