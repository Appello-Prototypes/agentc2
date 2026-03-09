/**
 * @deprecated QUARANTINED - This script encodes pre-multi-tenant assumptions
 * (global slugs, _system workspaces, null workspaceId). Do NOT run in production.
 * Kept for reference only.
 */
throw new Error("QUARANTINED: This migration script is deprecated and must not be run.");

import { PrismaClient } from "@repo/database";

const prisma = new PrismaClient();

interface DuplicateRow {
    slug: string;
    workspaceId: string;
    count: bigint;
}

interface DuplicateOrgRow {
    slug: string;
    organizationId: string;
    count: bigint;
}

const ENTITY_CHECKS: {
    name: string;
    table: string;
    scope: "workspace" | "organization";
}[] = [
    { name: "Agent", table: "agent", scope: "workspace" },
    { name: "Workflow", table: "workflow", scope: "workspace" },
    { name: "Network", table: "network", scope: "workspace" },
    { name: "Skill", table: "skill", scope: "organization" },
    { name: "Document", table: "document", scope: "organization" },
    { name: "Pulse", table: "pulse", scope: "workspace" },
    { name: "Campaign", table: "campaign", scope: "workspace" },
    {
        name: "CampaignTemplate",
        table: "campaign_template",
        scope: "organization"
    },
    {
        name: "CommunityBoard",
        table: "community_board",
        scope: "organization"
    }
];

async function main() {
    console.log("=== Migration: Check for duplicate slugs within scope ===\n");

    let totalDuplicates = 0;

    for (const entity of ENTITY_CHECKS) {
        if (entity.scope === "workspace") {
            const duplicates = await prisma.$queryRawUnsafe<DuplicateRow[]>(
                `SELECT slug, "workspaceId", COUNT(*) as count
                 FROM "${entity.table}"
                 WHERE "workspaceId" IS NOT NULL
                 GROUP BY slug, "workspaceId"
                 HAVING COUNT(*) > 1
                 ORDER BY count DESC`
            );

            if (duplicates.length > 0) {
                console.log(
                    `WARNING: ${entity.name} has ${duplicates.length} duplicate slug groups (workspace-scoped):`
                );
                for (const dup of duplicates) {
                    console.log(
                        `  slug="${dup.slug}" workspaceId="${dup.workspaceId}" count=${dup.count}`
                    );

                    const rows = await prisma.$queryRawUnsafe<
                        { id: string; slug: string; name: string }[]
                    >(
                        `SELECT id, slug, name FROM "${entity.table}"
                         WHERE slug = $1 AND "workspaceId" = $2
                         ORDER BY "createdAt" ASC`,
                        dup.slug,
                        dup.workspaceId
                    );
                    for (const row of rows) {
                        console.log(`    - id=${row.id} name="${row.name}"`);
                    }
                }
                totalDuplicates += duplicates.length;
            } else {
                console.log(`OK: ${entity.name} has no duplicate slugs within workspace scope`);
            }
        } else {
            const duplicates = await prisma.$queryRawUnsafe<DuplicateOrgRow[]>(
                `SELECT slug, "organizationId", COUNT(*) as count
                 FROM "${entity.table}"
                 WHERE "organizationId" IS NOT NULL
                 GROUP BY slug, "organizationId"
                 HAVING COUNT(*) > 1
                 ORDER BY count DESC`
            );

            if (duplicates.length > 0) {
                console.log(
                    `WARNING: ${entity.name} has ${duplicates.length} duplicate slug groups (org-scoped):`
                );
                for (const dup of duplicates) {
                    console.log(
                        `  slug="${dup.slug}" organizationId="${dup.organizationId}" count=${dup.count}`
                    );

                    const rows = await prisma.$queryRawUnsafe<
                        { id: string; slug: string; name: string }[]
                    >(
                        `SELECT id, slug, name FROM "${entity.table}"
                         WHERE slug = $1 AND "organizationId" = $2
                         ORDER BY "createdAt" ASC`,
                        dup.slug,
                        dup.organizationId
                    );
                    for (const row of rows) {
                        console.log(`    - id=${row.id} name="${row.name}"`);
                    }
                }
                totalDuplicates += duplicates.length;
            } else {
                console.log(`OK: ${entity.name} has no duplicate slugs within organization scope`);
            }
        }
    }

    // Also check for null workspaceId/organizationId that would block unique constraint creation
    console.log("\n--- Null scope check (would block constraint creation) ---");

    const nullChecks: { name: string; table: string; field: string }[] = [
        { name: "Agent", table: "agent", field: "workspaceId" },
        { name: "Workflow", table: "workflow", field: "workspaceId" },
        { name: "Network", table: "network", field: "workspaceId" },
        { name: "Skill", table: "skill", field: "organizationId" },
        { name: "Document", table: "document", field: "organizationId" },
        { name: "Pulse", table: "pulse", field: "workspaceId" },
        { name: "Campaign", table: "campaign", field: "workspaceId" },
        {
            name: "CampaignTemplate",
            table: "campaign_template",
            field: "organizationId"
        },
        {
            name: "CommunityBoard",
            table: "community_board",
            field: "organizationId"
        }
    ];

    for (const check of nullChecks) {
        const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM "${check.table}" WHERE "${check.field}" IS NULL`
        );
        const count = Number(result[0]?.count ?? 0);
        if (count > 0) {
            console.log(`WARNING: ${check.name} has ${count} rows with NULL ${check.field}`);
            totalDuplicates++;
        } else {
            console.log(`OK: ${check.name} has no NULL ${check.field}`);
        }
    }

    console.log(`\n${"=".repeat(60)}`);
    if (totalDuplicates > 0) {
        console.log(
            `RESULT: Found ${totalDuplicates} issues that need manual resolution before adding unique constraints.`
        );
        console.log(
            `Action: Review duplicates above and either rename or delete the extra records.`
        );
        process.exit(1);
    } else {
        console.log(`RESULT: No duplicates found. Safe to add scoped unique constraints.`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
