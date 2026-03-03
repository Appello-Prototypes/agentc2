#!/usr/bin/env bun
/**
 * One-time migration: makes all entity slugs globally unique by appending
 * the owning organization's slug as a suffix.
 *
 * Applies to models with formerly compound-unique slugs:
 *   - Agent        (was @@unique([workspaceId, slug]))
 *   - Workflow      (was @@unique([workspaceId, slug]))
 *   - Skill         (was @@unique([workspaceId, slug]))
 *   - Workspace     (was @@unique([organizationId, slug]))
 *   - AgentInstance  (was @@unique([organizationId, slug]))
 *
 * System entities (null workspaceId/organizationId) are left unchanged.
 *
 * After renaming, cascading updates are applied to all cross-references:
 *   - Direct columns (ChannelSession.agentSlug, etc.)
 *   - String arrays (Agent.subAgents, ThreadSkillState.skillSlugs)
 *   - JSON fields (AgentRun.skillsJson, PlaybookVersion.manifest, etc.)
 *
 * Usage:
 *   bun run scripts/migrate-global-slugs.ts          # dry-run (default)
 *   bun run scripts/migrate-global-slugs.ts --apply  # actually rename slugs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = !process.argv.includes("--apply");

type SlugRenameMap = Map<string, Map<string, string>>; // modelType -> oldSlug -> newSlug

interface RenameEntry {
    modelType: string;
    id: string;
    oldSlug: string;
    newSlug: string;
    orgSlug: string;
}

// ─── Step 1: Build the rename map ────────────────────────────────────────────

async function buildRenameMap(): Promise<RenameEntry[]> {
    const entries: RenameEntry[] = [];

    // Agents: join through workspace -> organization
    const agents = await prisma.agent.findMany({
        where: { workspaceId: { not: null } },
        select: {
            id: true,
            slug: true,
            workspace: {
                select: {
                    organization: { select: { slug: true } }
                }
            }
        }
    });
    for (const a of agents) {
        const orgSlug = a.workspace?.organization?.slug;
        if (!orgSlug) continue;
        const newSlug = `${a.slug}-${orgSlug}`;
        if (newSlug !== a.slug) {
            entries.push({ modelType: "agent", id: a.id, oldSlug: a.slug, newSlug, orgSlug });
        }
    }

    // Workflows: join through workspace -> organization
    const workflows = await prisma.workflow.findMany({
        where: { workspaceId: { not: null } },
        select: {
            id: true,
            slug: true,
            workspace: {
                select: {
                    organization: { select: { slug: true } }
                }
            }
        }
    });
    for (const w of workflows) {
        const orgSlug = w.workspace?.organization?.slug;
        if (!orgSlug) continue;
        const newSlug = `${w.slug}-${orgSlug}`;
        if (newSlug !== w.slug) {
            entries.push({ modelType: "workflow", id: w.id, oldSlug: w.slug, newSlug, orgSlug });
        }
    }

    // Skills: join through workspace -> organization
    const skills = await prisma.skill.findMany({
        where: { workspaceId: { not: null } },
        select: {
            id: true,
            slug: true,
            workspace: {
                select: {
                    organization: { select: { slug: true } }
                }
            }
        }
    });
    for (const s of skills) {
        const orgSlug = s.workspace?.organization?.slug;
        if (!orgSlug) continue;
        const newSlug = `${s.slug}-${orgSlug}`;
        if (newSlug !== s.slug) {
            entries.push({ modelType: "skill", id: s.id, oldSlug: s.slug, newSlug, orgSlug });
        }
    }

    // Workspaces: join through organization
    const workspaces = await prisma.workspace.findMany({
        select: {
            id: true,
            slug: true,
            organization: { select: { slug: true } }
        }
    });
    for (const ws of workspaces) {
        const orgSlug = ws.organization?.slug;
        if (!orgSlug) continue;
        const newSlug = `${ws.slug}-${orgSlug}`;
        if (newSlug !== ws.slug) {
            entries.push({ modelType: "workspace", id: ws.id, oldSlug: ws.slug, newSlug, orgSlug });
        }
    }

    // AgentInstances: join through organization
    const instances = await prisma.agentInstance.findMany({
        select: {
            id: true,
            slug: true,
            organization: { select: { slug: true } }
        }
    });
    for (const inst of instances) {
        const orgSlug = inst.organization?.slug;
        if (!orgSlug) continue;
        const newSlug = `${inst.slug}-${orgSlug}`;
        if (newSlug !== inst.slug) {
            entries.push({
                modelType: "agentInstance",
                id: inst.id,
                oldSlug: inst.slug,
                newSlug,
                orgSlug
            });
        }
    }

    return entries;
}

// ─── Step 2: Check for collisions ────────────────────────────────────────────

function checkCollisions(entries: RenameEntry[]): boolean {
    const byModel = new Map<string, Set<string>>();
    let hasCollision = false;

    for (const e of entries) {
        if (!byModel.has(e.modelType)) byModel.set(e.modelType, new Set());
        const slugs = byModel.get(e.modelType)!;
        if (slugs.has(e.newSlug)) {
            console.error(`  COLLISION: ${e.modelType} slug "${e.newSlug}" would be created twice`);
            hasCollision = true;
        }
        slugs.add(e.newSlug);
    }

    return hasCollision;
}

// ─── Step 3: Apply primary slug renames ──────────────────────────────────────

async function applyPrimaryRenames(entries: RenameEntry[]): Promise<void> {
    for (const e of entries) {
        switch (e.modelType) {
            case "agent":
                await prisma.agent.update({ where: { id: e.id }, data: { slug: e.newSlug } });
                break;
            case "workflow":
                await prisma.workflow.update({ where: { id: e.id }, data: { slug: e.newSlug } });
                break;
            case "skill":
                await prisma.skill.update({ where: { id: e.id }, data: { slug: e.newSlug } });
                break;
            case "workspace":
                await prisma.workspace.update({ where: { id: e.id }, data: { slug: e.newSlug } });
                break;
            case "agentInstance":
                await prisma.agentInstance.update({
                    where: { id: e.id },
                    data: { slug: e.newSlug }
                });
                break;
        }
    }
}

// ─── Step 4: Cascading reference updates ─────────────────────────────────────

function buildSlugLookup(entries: RenameEntry[], modelType: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const e of entries) {
        if (e.modelType === modelType) {
            map.set(e.oldSlug, e.newSlug);
        }
    }
    return map;
}

async function updateDirectColumns(entries: RenameEntry[]): Promise<number> {
    const agentMap = buildSlugLookup(entries, "agent");
    let updated = 0;

    // ChannelSession.agentSlug
    const channelSessions = await prisma.channelSession.findMany({
        where: { agentSlug: { in: Array.from(agentMap.keys()) } },
        select: { id: true, agentSlug: true }
    });
    for (const cs of channelSessions) {
        const newSlug = agentMap.get(cs.agentSlug);
        if (newSlug) {
            await prisma.channelSession.update({
                where: { id: cs.id },
                data: { agentSlug: newSlug }
            });
            updated++;
        }
    }

    // VoiceCallLog.agentSlug
    const voiceLogs = await prisma.voiceCallLog.findMany({
        where: { agentSlug: { in: Array.from(agentMap.keys()) } },
        select: { id: true, agentSlug: true }
    });
    for (const vl of voiceLogs) {
        const newSlug = agentMap.get(vl.agentSlug!);
        if (newSlug) {
            await prisma.voiceCallLog.update({
                where: { id: vl.id },
                data: { agentSlug: newSlug }
            });
            updated++;
        }
    }

    // FederationMessage.sourceAgentSlug / targetAgentSlug
    const fedMsgs = await prisma.federationMessage.findMany({
        where: {
            OR: [
                { sourceAgentSlug: { in: Array.from(agentMap.keys()) } },
                { targetAgentSlug: { in: Array.from(agentMap.keys()) } }
            ]
        },
        select: { id: true, sourceAgentSlug: true, targetAgentSlug: true }
    });
    for (const fm of fedMsgs) {
        const data: Record<string, string> = {};
        if (agentMap.has(fm.sourceAgentSlug))
            data.sourceAgentSlug = agentMap.get(fm.sourceAgentSlug)!;
        if (agentMap.has(fm.targetAgentSlug))
            data.targetAgentSlug = agentMap.get(fm.targetAgentSlug)!;
        if (Object.keys(data).length > 0) {
            await prisma.federationMessage.update({ where: { id: fm.id }, data });
            updated++;
        }
    }

    // ActivityEvent.agentSlug
    const activities = await prisma.activityEvent.findMany({
        where: { agentSlug: { in: Array.from(agentMap.keys()) } },
        select: { id: true, agentSlug: true }
    });
    for (const ae of activities) {
        const newSlug = agentMap.get(ae.agentSlug!);
        if (newSlug) {
            await prisma.activityEvent.update({
                where: { id: ae.id },
                data: { agentSlug: newSlug }
            });
            updated++;
        }
    }

    // SessionParticipant.agentSlug
    const participants = await prisma.sessionParticipant.findMany({
        where: { agentSlug: { in: Array.from(agentMap.keys()) } },
        select: { id: true, agentSlug: true }
    });
    for (const sp of participants) {
        const newSlug = agentMap.get(sp.agentSlug);
        if (newSlug) {
            await prisma.sessionParticipant.update({
                where: { id: sp.id },
                data: { agentSlug: newSlug }
            });
            updated++;
        }
    }

    // PlaybookComponent.sourceSlug (can be agent, skill, workflow, network, document slug)
    const allMaps = new Map<string, string>();
    for (const e of entries) {
        allMaps.set(e.oldSlug, e.newSlug);
    }
    const pbComponents = await prisma.playbookComponent.findMany({
        where: { sourceSlug: { in: Array.from(allMaps.keys()) } },
        select: { id: true, sourceSlug: true }
    });
    for (const pc of pbComponents) {
        const newSlug = allMaps.get(pc.sourceSlug);
        if (newSlug) {
            await prisma.playbookComponent.update({
                where: { id: pc.id },
                data: { sourceSlug: newSlug }
            });
            updated++;
        }
    }

    // ChangeLog.entitySlug
    const changeLogs = await prisma.changeLog.findMany({
        where: { entitySlug: { in: Array.from(allMaps.keys()) } },
        select: { id: true, entitySlug: true }
    });
    for (const cl of changeLogs) {
        const newSlug = allMaps.get(cl.entitySlug!);
        if (newSlug) {
            await prisma.changeLog.update({ where: { id: cl.id }, data: { entitySlug: newSlug } });
            updated++;
        }
    }

    // RepositoryConfig.codingAgentSlug
    const repoCfgs = await prisma.repositoryConfig.findMany({
        where: { codingAgentSlug: { in: Array.from(agentMap.keys()) } },
        select: { id: true, codingAgentSlug: true }
    });
    for (const rc of repoCfgs) {
        const newSlug = agentMap.get(rc.codingAgentSlug!);
        if (newSlug) {
            await prisma.repositoryConfig.update({
                where: { id: rc.id },
                data: { codingAgentSlug: newSlug }
            });
            updated++;
        }
    }

    return updated;
}

async function updateStringArrays(entries: RenameEntry[]): Promise<number> {
    const agentMap = buildSlugLookup(entries, "agent");
    const skillMap = buildSlugLookup(entries, "skill");
    let updated = 0;

    // Agent.subAgents (String[] of agent slugs)
    if (agentMap.size > 0) {
        const agents = await prisma.agent.findMany({
            where: { subAgents: { isEmpty: false } },
            select: { id: true, subAgents: true }
        });
        for (const a of agents) {
            let changed = false;
            const newArr = a.subAgents.map((s) => {
                if (agentMap.has(s)) {
                    changed = true;
                    return agentMap.get(s)!;
                }
                return s;
            });
            if (changed) {
                await prisma.agent.update({ where: { id: a.id }, data: { subAgents: newArr } });
                updated++;
            }
        }
    }

    // ThreadSkillState.skillSlugs (String[] of skill slugs)
    if (skillMap.size > 0) {
        const states = await prisma.threadSkillState.findMany({
            where: { skillSlugs: { isEmpty: false } },
            select: { id: true, skillSlugs: true }
        });
        for (const ts of states) {
            let changed = false;
            const newArr = ts.skillSlugs.map((s) => {
                if (skillMap.has(s)) {
                    changed = true;
                    return skillMap.get(s)!;
                }
                return s;
            });
            if (changed) {
                await prisma.threadSkillState.update({
                    where: { id: ts.id },
                    data: { skillSlugs: newArr }
                });
                updated++;
            }
        }
    }

    return updated;
}

function replaceSlugInJson(obj: unknown, slugMap: Map<string, string>): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") return slugMap.get(obj) ?? obj;
    if (Array.isArray(obj)) return obj.map((item) => replaceSlugInJson(item, slugMap));
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const newKey = slugMap.get(key) ?? key;
            result[newKey] = replaceSlugInJson(value, slugMap);
        }
        return result;
    }
    return obj;
}

async function updateJsonFields(entries: RenameEntry[]): Promise<number> {
    const allMaps = new Map<string, string>();
    for (const e of entries) {
        allMaps.set(e.oldSlug, e.newSlug);
    }
    if (allMaps.size === 0) return 0;

    let updated = 0;

    // AgentRun.skillsJson - array of {skillId, skillSlug, skillVersion}
    const runs = await prisma.agentRun.findMany({
        where: { skillsJson: { not: { equals: null } } },
        select: { id: true, skillsJson: true }
    });
    for (const r of runs) {
        if (!r.skillsJson) continue;
        const original = JSON.stringify(r.skillsJson);
        const replaced = replaceSlugInJson(r.skillsJson, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.agentRun.update({
                where: { id: r.id },
                data: { skillsJson: replaced as any }
            });
            updated++;
        }
    }

    // AgentEvaluation.skillAttributions - keys are skill slugs
    const evals = await prisma.agentEvaluation.findMany({
        where: { skillAttributions: { not: { equals: null } } },
        select: { id: true, skillAttributions: true }
    });
    for (const ev of evals) {
        if (!ev.skillAttributions) continue;
        const original = JSON.stringify(ev.skillAttributions);
        const replaced = replaceSlugInJson(ev.skillAttributions, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.agentEvaluation.update({
                where: { id: ev.id },
                data: { skillAttributions: replaced as any }
            });
            updated++;
        }
    }

    // LearningSession.agentScores - keys are agent slugs
    const sessions = await prisma.learningSession.findMany({
        where: { agentScores: { not: { equals: null } } },
        select: { id: true, agentScores: true }
    });
    for (const ls of sessions) {
        if (!ls.agentScores) continue;
        const original = JSON.stringify(ls.agentScores);
        const replaced = replaceSlugInJson(ls.agentScores, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.learningSession.update({
                where: { id: ls.id },
                data: { agentScores: replaced as any }
            });
            updated++;
        }
    }

    // Campaign.generatedResources - {agents: [{slug, ...}], skills: [{slug, ...}], ...}
    const campaigns = await prisma.campaign.findMany({
        where: { generatedResources: { not: { equals: null } } },
        select: { id: true, generatedResources: true }
    });
    for (const c of campaigns) {
        if (!c.generatedResources) continue;
        const original = JSON.stringify(c.generatedResources);
        const replaced = replaceSlugInJson(c.generatedResources, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.campaign.update({
                where: { id: c.id },
                data: { generatedResources: replaced as any }
            });
            updated++;
        }
    }

    // PlaybookVersion.manifest - deep JSON with many slug references
    const versions = await prisma.playbookVersion.findMany({
        select: { id: true, manifest: true }
    });
    for (const v of versions) {
        if (!v.manifest) continue;
        const original = JSON.stringify(v.manifest);
        const replaced = replaceSlugInJson(v.manifest, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.playbookVersion.update({
                where: { id: v.id },
                data: { manifest: replaced as any }
            });
            updated++;
        }
    }

    // Network.topologyJson - node data may contain agentSlug, workflowSlug
    const networks = await prisma.network.findMany({
        where: { topologyJson: { not: { equals: null } } },
        select: { id: true, topologyJson: true }
    });
    for (const n of networks) {
        if (!n.topologyJson) continue;
        const original = JSON.stringify(n.topologyJson);
        const replaced = replaceSlugInJson(n.topologyJson, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.network.update({
                where: { id: n.id },
                data: { topologyJson: replaced as any }
            });
            updated++;
        }
    }

    // NetworkVersion.topologyJson
    const netVersions = await prisma.networkVersion.findMany({
        where: { topologyJson: { not: { equals: null } } },
        select: { id: true, topologyJson: true }
    });
    for (const nv of netVersions) {
        if (!nv.topologyJson) continue;
        const original = JSON.stringify(nv.topologyJson);
        const replaced = replaceSlugInJson(nv.topologyJson, allMaps);
        if (JSON.stringify(replaced) !== original) {
            await prisma.networkVersion.update({
                where: { id: nv.id },
                data: { topologyJson: replaced as any }
            });
            updated++;
        }
    }

    return updated;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔧 Global Slug Migration ${dryRun ? "(DRY RUN)" : "(APPLYING)"}\n`);

    // Step 1: Build rename map
    console.log("Step 1: Building rename map...");
    const entries = await buildRenameMap();

    const byModel = new Map<string, RenameEntry[]>();
    for (const e of entries) {
        if (!byModel.has(e.modelType)) byModel.set(e.modelType, []);
        byModel.get(e.modelType)!.push(e);
    }

    for (const [model, items] of byModel) {
        console.log(`  ${model}: ${items.length} slugs to rename`);
        for (const item of items.slice(0, 5)) {
            console.log(`    ${item.oldSlug} → ${item.newSlug}`);
        }
        if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
    }

    if (entries.length === 0) {
        console.log("  No slugs need renaming. All done!");
        return;
    }

    // Step 2: Check for collisions
    console.log("\nStep 2: Checking for collisions...");
    const hasCollisions = checkCollisions(entries);
    if (hasCollisions) {
        console.error("\n❌ Collisions detected! Aborting.");
        console.error(
            "   Resolve manually: two entities in the same org would produce the same slug."
        );
        process.exit(1);
    }
    console.log("  No collisions detected.");

    if (dryRun) {
        console.log("\n📋 DRY RUN - No changes applied.");
        console.log(`   Total renames: ${entries.length}`);
        console.log("   Run with --apply to execute.");
        return;
    }

    // Step 3: Apply primary renames
    console.log("\nStep 3: Applying primary slug renames...");
    await applyPrimaryRenames(entries);
    console.log(`  ✓ Renamed ${entries.length} slugs`);

    // Step 4: Cascading updates
    console.log("\nStep 4: Updating direct column references...");
    const directUpdates = await updateDirectColumns(entries);
    console.log(`  ✓ Updated ${directUpdates} direct column references`);

    console.log("\nStep 5: Updating string array references...");
    const arrayUpdates = await updateStringArrays(entries);
    console.log(`  ✓ Updated ${arrayUpdates} array references`);

    console.log("\nStep 6: Updating JSON field references...");
    const jsonUpdates = await updateJsonFields(entries);
    console.log(`  ✓ Updated ${jsonUpdates} JSON field references`);

    console.log(`\n✅ Migration complete!`);
    console.log(`   Primary renames: ${entries.length}`);
    console.log(`   Direct column updates: ${directUpdates}`);
    console.log(`   Array updates: ${arrayUpdates}`);
    console.log(`   JSON updates: ${jsonUpdates}`);
}

main()
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
