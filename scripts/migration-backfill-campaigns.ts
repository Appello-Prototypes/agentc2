import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = !process.argv.includes("--apply");

interface RawRow {
    id: string;
    [key: string]: unknown;
}

async function getDefaultWorkspace(orgId: string) {
    let ws = await prisma.workspace.findFirst({
        where: { organizationId: orgId, isDefault: true }
    });
    if (!ws) {
        if (dryRun) return null;
        ws = await prisma.workspace.create({
            data: { organizationId: orgId, name: "Default", slug: "default", isDefault: true }
        });
    }
    return ws;
}

async function deriveOrgFromAgent(agentId: string): Promise<string | null> {
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { workspace: { select: { organizationId: true } } }
    });
    return agent?.workspace?.organizationId ?? null;
}

async function deriveOrgFromTemplate(templateId: string): Promise<string | null> {
    const template = await prisma.campaignTemplate.findUnique({
        where: { id: templateId },
        select: { organizationId: true }
    });
    return template?.organizationId ?? null;
}

async function deriveOrgFromUser(userId: string): Promise<string | null> {
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { organizationId: true }
    });
    if (memberships.length === 1) {
        return memberships[0]!.organizationId;
    }
    if (memberships.length > 1) {
        return null;
    }
    return null;
}

async function main() {
    console.log("=== Migration: Backfill Campaign entities with org+workspace context ===");
    console.log(`Mode: ${dryRun ? "DRY RUN (pass --apply to execute)" : "APPLYING CHANGES"}\n`);

    // --- Campaigns ---
    const campaignsWithoutOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT id, "createdBy", "organizationId", "workspaceId", "ownerId", "templateId"
        FROM campaign
        WHERE "organizationId" IS NULL OR "workspaceId" IS NULL
    `;
    console.log(`Found ${campaignsWithoutOrg.length} campaigns missing org/workspace context`);

    let campaignUpdated = 0;
    let campaignSkipped = 0;
    for (const campaign of campaignsWithoutOrg) {
        let orgId = campaign.organizationId as string | null;

        if (!orgId && campaign.ownerId) {
            orgId = await deriveOrgFromAgent(campaign.ownerId as string);
        }

        if (!orgId && campaign.templateId) {
            orgId = await deriveOrgFromTemplate(campaign.templateId as string);
        }

        if (!orgId && campaign.createdBy) {
            orgId = await deriveOrgFromUser(campaign.createdBy as string);
            if (!orgId) {
                console.warn(
                    `  SKIP campaign ${campaign.id}: createdBy user has 0 or >1 memberships (ambiguous)`
                );
                campaignSkipped++;
                continue;
            }
        }

        if (!orgId) {
            console.warn(
                `  SKIP campaign ${campaign.id}: no ownerId, templateId, or unambiguous createdBy`
            );
            campaignSkipped++;
            continue;
        }

        const defaultWs = await getDefaultWorkspace(orgId);
        if (!defaultWs) {
            console.log(`  [DRY RUN] Would update campaign ${campaign.id} -> org ${orgId}`);
            campaignUpdated++;
            continue;
        }

        if (!dryRun) {
            await prisma.$executeRaw`
                UPDATE campaign
                SET "organizationId" = ${orgId},
                    "workspaceId" = COALESCE("workspaceId", ${defaultWs.id})
                WHERE id = ${campaign.id}
            `;
        }
        campaignUpdated++;
    }
    console.log(`  Updated ${campaignUpdated} campaigns, skipped ${campaignSkipped}\n`);

    // --- Campaign Templates ---
    const templatesWithoutOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT id, "createdBy", "organizationId", "workspaceId"
        FROM campaign_template
        WHERE "organizationId" IS NULL OR "workspaceId" IS NULL
    `;
    console.log(
        `Found ${templatesWithoutOrg.length} campaign templates missing org/workspace context`
    );

    let templateUpdated = 0;
    let templateSkipped = 0;
    for (const template of templatesWithoutOrg) {
        let orgId = template.organizationId as string | null;

        if (!orgId && template.createdBy) {
            orgId = await deriveOrgFromUser(template.createdBy as string);
            if (!orgId) {
                console.warn(
                    `  SKIP template ${template.id}: createdBy user has 0 or >1 memberships (ambiguous)`
                );
                templateSkipped++;
                continue;
            }
        }

        if (!orgId) {
            console.warn(`  SKIP template ${template.id}: no createdBy or user has no membership`);
            templateSkipped++;
            continue;
        }

        const defaultWs = await getDefaultWorkspace(orgId);
        if (!defaultWs) {
            console.log(`  [DRY RUN] Would update template ${template.id} -> org ${orgId}`);
            templateUpdated++;
            continue;
        }

        if (!dryRun) {
            await prisma.$executeRaw`
                UPDATE campaign_template
                SET "organizationId" = ${orgId},
                    "workspaceId" = COALESCE("workspaceId", ${defaultWs.id})
                WHERE id = ${template.id}
            `;
        }
        templateUpdated++;
    }
    console.log(`  Updated ${templateUpdated} templates, skipped ${templateSkipped}\n`);

    // --- Campaign Schedules (derive org from template) ---
    const schedulesWithoutOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT cs.id, cs."templateId", cs."organizationId"
        FROM campaign_schedule cs
        WHERE cs."organizationId" IS NULL
    `;
    console.log(`Found ${schedulesWithoutOrg.length} campaign schedules missing org context`);

    let scheduleUpdated = 0;
    let scheduleSkipped = 0;
    for (const schedule of schedulesWithoutOrg) {
        const template = await prisma.campaignTemplate.findUnique({
            where: { id: schedule.templateId as string },
            select: { organizationId: true }
        });

        if (!template?.organizationId) {
            console.warn(
                `  SKIP schedule ${schedule.id}: template ${schedule.templateId} has no org`
            );
            scheduleSkipped++;
            continue;
        }

        if (!dryRun) {
            await prisma.$executeRaw`
                UPDATE campaign_schedule
                SET "organizationId" = ${template.organizationId}
                WHERE id = ${schedule.id}
            `;
        }
        scheduleUpdated++;
    }
    console.log(`  Updated ${scheduleUpdated} schedules, skipped ${scheduleSkipped}\n`);

    // --- Campaign Triggers (derive org from template) ---
    const triggersWithoutOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT ct.id, ct."templateId", ct."organizationId"
        FROM campaign_trigger ct
        WHERE ct."organizationId" IS NULL
    `;
    console.log(`Found ${triggersWithoutOrg.length} campaign triggers missing org context`);

    let triggerUpdated = 0;
    let triggerSkipped = 0;
    for (const trigger of triggersWithoutOrg) {
        const template = await prisma.campaignTemplate.findUnique({
            where: { id: trigger.templateId as string },
            select: { organizationId: true }
        });

        if (!template?.organizationId) {
            console.warn(`  SKIP trigger ${trigger.id}: template ${trigger.templateId} has no org`);
            triggerSkipped++;
            continue;
        }

        if (!dryRun) {
            await prisma.$executeRaw`
                UPDATE campaign_trigger
                SET "organizationId" = ${template.organizationId}
                WHERE id = ${trigger.id}
            `;
        }
        triggerUpdated++;
    }
    console.log(`  Updated ${triggerUpdated} triggers, skipped ${triggerSkipped}\n`);

    if (dryRun) {
        console.log("[DRY RUN] No changes applied. Run with --apply to execute.");
    } else {
        console.log("Campaign backfill complete!");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
