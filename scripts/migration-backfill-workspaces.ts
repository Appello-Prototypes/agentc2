import { PrismaClient } from "@repo/database";

const prisma = new PrismaClient();
const dryRun = !process.argv.includes("--apply");

interface CountRow {
    count: bigint;
}

async function ensureDefaultWorkspace(orgId: string, orgSlug: string) {
    let ws = await prisma.workspace.findFirst({
        where: { organizationId: orgId, isDefault: true }
    });
    if (!ws) {
        if (dryRun) {
            console.log(`  [DRY RUN] Would create default workspace for org "${orgSlug}"`);
            return null;
        }
        ws = await prisma.workspace.create({
            data: { organizationId: orgId, name: "Default", slug: "default", isDefault: true }
        });
        console.log(`  Created default workspace: ${ws.id}`);
    }
    return ws;
}

async function backfillWithOrgColumn(
    entityName: string,
    table: string,
    orgId: string,
    defaultWsId: string
) {
    const [{ count }] = await prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*) as count FROM "${table}"
         WHERE "organizationId" = $1
         AND ("workspaceId" IS NULL OR "workspaceId" = '')`,
        orgId
    );
    const n = Number(count);
    if (n === 0) {
        console.log(`  ${entityName}: 0 rows`);
        return;
    }
    console.log(`  ${entityName}: ${n} rows scoped to this org need workspaceId`);
    if (!dryRun) {
        const updated = await prisma.$executeRawUnsafe(
            `UPDATE "${table}"
             SET "workspaceId" = $1
             WHERE "organizationId" = $2
             AND ("workspaceId" IS NULL OR "workspaceId" = '')`,
            defaultWsId,
            orgId
        );
        console.log(`    -> Updated ${updated} rows`);
    }
}

async function backfillViaOwner(
    entityName: string,
    table: string,
    ownerCol: string,
    orgId: string,
    defaultWsId: string,
    extraSetClauses?: string
) {
    const [{ count }] = await prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*) as count FROM "${table}" t
         WHERE (t."workspaceId" IS NULL OR t."workspaceId" = '')
         AND t."${ownerCol}" IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM membership m
             WHERE m."userId" = t."${ownerCol}"
             AND m."organizationId" = $1
         )`,
        orgId
    );
    const n = Number(count);
    if (n === 0) {
        console.log(`  ${entityName}: 0 rows (via ${ownerCol} -> membership)`);
        return;
    }
    console.log(`  ${entityName}: ${n} rows matched via ${ownerCol} -> membership`);
    if (!dryRun) {
        const setClauses = extraSetClauses
            ? `"workspaceId" = $1, ${extraSetClauses}`
            : `"workspaceId" = $1`;
        const updated = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" t
             SET ${setClauses}
             WHERE (t."workspaceId" IS NULL OR t."workspaceId" = '')
             AND t."${ownerCol}" IS NOT NULL
             AND EXISTS (
                 SELECT 1 FROM membership m
                 WHERE m."userId" = t."${ownerCol}"
                 AND m."organizationId" = $2
             )`,
            defaultWsId,
            orgId
        );
        console.log(`    -> Updated ${updated} rows`);
    }
}

async function reportOrphans(entityName: string, table: string, ownerCol: string) {
    const [{ count }] = await prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*) as count FROM "${table}"
         WHERE ("workspaceId" IS NULL OR "workspaceId" = '')
         AND ("${ownerCol}" IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM membership m WHERE m."userId" = "${table}"."${ownerCol}"
              ))`
    );
    const n = Number(count);
    if (n > 0) {
        console.log(
            `  WARNING: ${entityName} has ${n} orphan rows (NULL/unmapped ${ownerCol}). Requires manual review.`
        );
    }
}

async function main() {
    console.log("=== Migration: Backfill NULL workspaceId into org default workspaces ===");
    console.log(`Mode: ${dryRun ? "DRY RUN (pass --apply to execute)" : "APPLYING CHANGES"}\n`);

    const orgs = await prisma.organization.findMany({ select: { id: true, slug: true } });
    console.log(`Found ${orgs.length} organizations to process\n`);

    for (const org of orgs) {
        console.log(`\n── Org: ${org.slug} (${org.id}) ──`);

        const defaultWs = await ensureDefaultWorkspace(org.id, org.slug);
        const wsId = defaultWs?.id ?? "";

        if (!wsId && dryRun) {
            console.log(`  [DRY RUN] Counts below assume a new default workspace would be created`);
        }

        // Entities WITH organizationId column — scope directly
        if (wsId || dryRun) {
            await backfillWithOrgColumn("Skill", "skill", org.id, wsId);
            await backfillWithOrgColumn("Document", "document", org.id, wsId);
        }

        // Entities WITHOUT organizationId — scope via ownerId/createdBy -> membership
        if (wsId || dryRun) {
            await backfillViaOwner("Agent", "agent", "ownerId", org.id, wsId, `"type" = 'USER'`);
            await backfillViaOwner("Workflow", "workflow", "ownerId", org.id, wsId);
            await backfillViaOwner("Network", "network", "ownerId", org.id, wsId);
            await backfillViaOwner("Pulse", "pulse", "createdBy", org.id, wsId);
            await backfillViaOwner("BimModel", "bim_model", "ownerId", org.id, wsId);
        }
    }

    // Report any orphans that couldn't be assigned
    console.log("\n── Orphan Report (rows that could not be auto-assigned) ──");
    await reportOrphans("Agent", "agent", "ownerId");
    await reportOrphans("Workflow", "workflow", "ownerId");
    await reportOrphans("Network", "network", "ownerId");
    await reportOrphans("Pulse", "pulse", "createdBy");
    await reportOrphans("BimModel", "bim_model", "ownerId");

    if (dryRun) {
        console.log("\n[DRY RUN] No changes applied. Run with --apply to execute.");
    } else {
        console.log("\nBackfill complete!");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
