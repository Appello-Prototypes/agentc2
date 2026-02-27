/**
 * Backfill script: Set workspaceId and visibility on existing Pulse records.
 *
 * This script:
 * 1. Finds all pulses with null workspaceId
 * 2. Resolves the createdBy user's default workspace
 * 3. Sets workspaceId and visibility (ORGANIZATION) on each pulse
 * 4. Reports any pulses that could not be resolved (null createdBy or no workspace)
 *
 * Idempotent: safe to re-run. Skips pulses that already have a workspaceId.
 *
 * Usage: bun run scripts/backfill-pulse-workspace.ts
 */

import { prisma } from "../packages/database/src/index";

async function main() {
    console.log("=== Backfill Pulse Workspace & Visibility ===\n");

    const pulses = await prisma.pulse.findMany({
        where: { workspaceId: null },
        select: { id: true, slug: true, createdBy: true }
    });

    if (pulses.length === 0) {
        console.log("No pulses need backfilling. All pulses already have a workspaceId.");
        return;
    }

    console.log(`Found ${pulses.length} pulse(s) with null workspaceId.\n`);

    let updated = 0;
    let skipped = 0;
    const unresolved: Array<{ id: string; slug: string; reason: string }> = [];

    for (const pulse of pulses) {
        if (!pulse.createdBy) {
            unresolved.push({ id: pulse.id, slug: pulse.slug, reason: "no createdBy user" });
            skipped++;
            continue;
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: pulse.createdBy },
            orderBy: { createdAt: "asc" }
        });

        if (!membership) {
            unresolved.push({
                id: pulse.id,
                slug: pulse.slug,
                reason: `no membership for user ${pulse.createdBy}`
            });
            skipped++;
            continue;
        }

        const workspace = await prisma.workspace.findFirst({
            where: { organizationId: membership.organizationId, isDefault: true },
            orderBy: { createdAt: "asc" }
        });

        if (!workspace) {
            unresolved.push({
                id: pulse.id,
                slug: pulse.slug,
                reason: `no default workspace for org ${membership.organizationId}`
            });
            skipped++;
            continue;
        }

        await prisma.pulse.update({
            where: { id: pulse.id },
            data: {
                workspaceId: workspace.id,
                visibility: "ORGANIZATION"
            }
        });

        console.log(`  ✓ ${pulse.slug} → workspace ${workspace.id}`);
        updated++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    if (unresolved.length > 0) {
        console.log(`\nUnresolved pulses (need manual assignment):`);
        for (const u of unresolved) {
            console.log(`  - ${u.slug} (${u.id}): ${u.reason}`);
        }
    }

    console.log("\nDone.");
}

main()
    .catch((err) => {
        console.error("Backfill failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
