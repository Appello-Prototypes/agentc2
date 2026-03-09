import { PrismaClient } from "@repo/database";

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

async function resolveAgentBySlug(
    slug: string,
    scopeOrgId?: string | null
): Promise<{ workspaceId: string; organizationId: string } | null> {
    const where: Record<string, unknown> = { slug };
    if (scopeOrgId) {
        where.workspace = { organizationId: scopeOrgId };
    }
    const agents = await prisma.agent.findMany({
        where,
        select: {
            workspaceId: true,
            workspace: { select: { organizationId: true } }
        }
    });
    if (agents.length === 1) {
        return {
            workspaceId: agents[0]!.workspaceId,
            organizationId: agents[0]!.workspace.organizationId
        };
    }
    if (agents.length > 1 && scopeOrgId) {
        const scoped = agents.filter((a) => a.workspace.organizationId === scopeOrgId);
        if (scoped.length === 1) {
            return {
                workspaceId: scoped[0]!.workspaceId,
                organizationId: scoped[0]!.workspace.organizationId
            };
        }
    }
    return null;
}

async function main() {
    console.log("=== Migration: Backfill workspaceId on child entities from parents ===");
    console.log(`Mode: ${dryRun ? "DRY RUN (pass --apply to execute)" : "APPLYING CHANGES"}\n`);

    // --- AgentSchedule: derive workspaceId from parent agent ---
    if (!dryRun) {
        const scheduleResult = await prisma.$executeRaw`
            UPDATE agent_schedule AS s
            SET "workspaceId" = a."workspaceId"
            FROM agent a
            WHERE s."agentId" = a.id
            AND (s."workspaceId" IS NULL OR s."workspaceId" = '')
            AND a."workspaceId" IS NOT NULL
        `;
        console.log(`AgentSchedule: updated ${scheduleResult} rows from parent agent`);
    } else {
        const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM agent_schedule s
            JOIN agent a ON s."agentId" = a.id
            WHERE (s."workspaceId" IS NULL OR s."workspaceId" = '')
            AND a."workspaceId" IS NOT NULL
        `;
        console.log(`AgentSchedule: ${count} rows would be updated from parent agent`);
    }

    // --- AgentTrigger: derive workspaceId from parent agent/workflow/network ---
    if (!dryRun) {
        const triggerAgentResult = await prisma.$executeRaw`
            UPDATE agent_trigger AS t
            SET "workspaceId" = a."workspaceId"
            FROM agent a
            WHERE t."agentId" = a.id
            AND (t."workspaceId" IS NULL OR t."workspaceId" = '')
            AND a."workspaceId" IS NOT NULL
        `;
        const triggerWorkflowResult = await prisma.$executeRaw`
            UPDATE agent_trigger AS t
            SET "workspaceId" = w."workspaceId"
            FROM workflow w
            WHERE t."workflowId" = w.id
            AND (t."workspaceId" IS NULL OR t."workspaceId" = '')
            AND w."workspaceId" IS NOT NULL
        `;
        const triggerNetworkResult = await prisma.$executeRaw`
            UPDATE agent_trigger AS t
            SET "workspaceId" = n."workspaceId"
            FROM network n
            WHERE t."networkId" = n.id
            AND (t."workspaceId" IS NULL OR t."workspaceId" = '')
            AND n."workspaceId" IS NOT NULL
        `;
        console.log(
            `AgentTrigger: updated ${triggerAgentResult} from agent, ${triggerWorkflowResult} from workflow, ${triggerNetworkResult} from network`
        );
    } else {
        console.log(`AgentTrigger: [DRY RUN] would update from parent agent/workflow/network`);
    }

    // --- AgentSession: derive workspaceId from initiator (scoped lookup) ---
    const sessionsToUpdate = await prisma.$queryRaw<RawRow[]>`
        SELECT s.id, s."initiatorType", s."initiatorId", s."workspaceId"
        FROM agent_session s
        WHERE s."workspaceId" IS NULL OR s."workspaceId" = ''
    `;
    console.log(`AgentSession: found ${sessionsToUpdate.length} sessions missing workspaceId`);

    let sessionUpdated = 0;
    let sessionSkipped = 0;
    for (const session of sessionsToUpdate) {
        let workspaceId: string | null = null;

        if (session.initiatorType === "agent") {
            const resolved = await resolveAgentBySlug(session.initiatorId as string);
            if (resolved) {
                workspaceId = resolved.workspaceId;
            } else {
                console.warn(
                    `  SKIP session ${session.id}: agent slug "${session.initiatorId}" resolves to 0 or >1 agents`
                );
                sessionSkipped++;
                continue;
            }
        } else if (session.initiatorType === "network") {
            const network = await prisma.network.findUnique({
                where: { id: session.initiatorId as string },
                select: { workspaceId: true }
            });
            workspaceId = network?.workspaceId ?? null;
        } else if (session.initiatorType === "user") {
            const memberships = await prisma.membership.findMany({
                where: { userId: session.initiatorId as string },
                select: { organizationId: true }
            });
            if (memberships.length === 1) {
                const ws = await getDefaultWorkspace(memberships[0]!.organizationId);
                workspaceId = ws?.id ?? null;
            } else {
                console.warn(
                    `  SKIP session ${session.id}: user "${session.initiatorId}" has ${memberships.length} memberships (ambiguous)`
                );
                sessionSkipped++;
                continue;
            }
        }

        if (workspaceId) {
            if (!dryRun) {
                await prisma.$executeRaw`
                    UPDATE agent_session SET "workspaceId" = ${workspaceId} WHERE id = ${session.id}
                `;
            }
            sessionUpdated++;
        } else {
            console.warn(`  SKIP session ${session.id}: could not resolve workspaceId`);
            sessionSkipped++;
        }
    }
    console.log(`AgentSession: updated ${sessionUpdated}, skipped ${sessionSkipped}`);

    // --- Backlog: derive workspaceId from parent agent ---
    if (!dryRun) {
        const backlogResult = await prisma.$executeRaw`
            UPDATE backlog AS b
            SET "workspaceId" = a."workspaceId"
            FROM agent a
            WHERE b."agentId" = a.id
            AND (b."workspaceId" IS NULL OR b."workspaceId" = '')
            AND a."workspaceId" IS NOT NULL
        `;
        console.log(`Backlog: updated ${backlogResult} rows from parent agent`);
    } else {
        console.log(`Backlog: [DRY RUN] would update from parent agent`);
    }

    // --- GmailIntegration: derive workspaceId from parent agent ---
    if (!dryRun) {
        const gmailResult = await prisma.$executeRaw`
            UPDATE gmail_integration AS g
            SET "workspaceId" = a."workspaceId"
            FROM agent a
            WHERE g."agentId" = a.id
            AND (g."workspaceId" IS NULL OR g."workspaceId" = '')
            AND a."workspaceId" IS NOT NULL
        `;
        console.log(`GmailIntegration: updated ${gmailResult} rows from parent agent`);
    } else {
        console.log(`GmailIntegration: [DRY RUN] would update from parent agent`);
    }

    // --- ApprovalRequest: backfill workspaceId from org's default workspace ---
    const approvalsToUpdate = await prisma.$queryRaw<RawRow[]>`
        SELECT ar.id, ar."organizationId"
        FROM approval_request ar
        WHERE ar."workspaceId" IS NULL OR ar."workspaceId" = ''
    `;
    console.log(`ApprovalRequest: found ${approvalsToUpdate.length} rows missing workspaceId`);

    let approvalUpdated = 0;
    for (const ar of approvalsToUpdate) {
        if (!ar.organizationId) continue;
        const defaultWs = await getDefaultWorkspace(ar.organizationId as string);
        if (defaultWs && !dryRun) {
            await prisma.$executeRaw`
                UPDATE approval_request SET "workspaceId" = ${defaultWs.id} WHERE id = ${ar.id}
            `;
        }
        approvalUpdated++;
    }
    console.log(`ApprovalRequest: updated ${approvalUpdated} rows`);

    // --- ChannelSession: derive workspaceId from agent slug SCOPED by organizationId ---
    const channelSessionsToUpdate = await prisma.$queryRaw<RawRow[]>`
        SELECT cs.id, cs."agentSlug", cs."organizationId", cs."workspaceId"
        FROM channel_session cs
        WHERE cs."workspaceId" IS NULL OR cs."workspaceId" = ''
    `;
    console.log(`ChannelSession: found ${channelSessionsToUpdate.length} rows missing workspaceId`);

    let channelSessionUpdated = 0;
    let channelSessionSkipped = 0;
    for (const cs of channelSessionsToUpdate) {
        const orgId = cs.organizationId as string | null;
        const resolved = await resolveAgentBySlug(cs.agentSlug as string, orgId);

        if (resolved) {
            const finalOrgId = orgId || resolved.organizationId;
            if (!dryRun) {
                await prisma.$executeRaw`
                    UPDATE channel_session
                    SET "workspaceId" = ${resolved.workspaceId},
                        "organizationId" = ${finalOrgId}
                    WHERE id = ${cs.id}
                `;
            }
            channelSessionUpdated++;
        } else {
            console.warn(
                `  SKIP channel_session ${cs.id}: agent slug "${cs.agentSlug}" could not be uniquely resolved within org ${orgId ?? "NULL"}`
            );
            channelSessionSkipped++;
        }
    }
    console.log(
        `ChannelSession: updated ${channelSessionUpdated}, skipped ${channelSessionSkipped}`
    );

    // --- ChannelCredentials: derive org from related channel sessions ---
    const channelCredsNoOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT id, channel FROM channel_credentials
        WHERE "organizationId" IS NULL OR "organizationId" = ''
    `;
    if (channelCredsNoOrg.length > 0) {
        console.log(
            `ChannelCredentials: found ${channelCredsNoOrg.length} rows missing organizationId`
        );
        let credUpdated = 0;
        for (const cred of channelCredsNoOrg) {
            const sessions = await prisma.$queryRaw<{ organizationId: string }[]>`
                SELECT DISTINCT "organizationId" FROM channel_session
                WHERE channel = ${cred.channel as string}
                AND "organizationId" IS NOT NULL
            `;
            if (sessions.length === 1) {
                if (!dryRun) {
                    await prisma.$executeRaw`
                        UPDATE channel_credentials
                        SET "organizationId" = ${sessions[0]!.organizationId}
                        WHERE id = ${cred.id}
                    `;
                }
                credUpdated++;
            } else {
                console.warn(
                    `  SKIP channel_credentials ${cred.id} (${cred.channel}): ` +
                        (sessions.length === 0
                            ? "no channel sessions to derive org from"
                            : `${sessions.length} distinct orgs use this channel (ambiguous)`)
                );
            }
        }
        console.log(`ChannelCredentials: updated ${credUpdated} rows`);
    } else {
        console.log(`ChannelCredentials: no rows missing organizationId`);
    }

    // --- VoiceCallLog: derive org from agent slug (scoped) ---
    const voiceLogsNoOrg = await prisma.$queryRaw<RawRow[]>`
        SELECT id, "agentSlug" FROM voice_call_log
        WHERE "organizationId" IS NULL OR "organizationId" = ''
    `;
    if (voiceLogsNoOrg.length > 0) {
        console.log(`VoiceCallLog: found ${voiceLogsNoOrg.length} rows missing organizationId`);
        let voiceUpdated = 0;
        let voiceSkipped = 0;
        for (const vl of voiceLogsNoOrg) {
            if (!vl.agentSlug) {
                console.warn(`  SKIP voice_call_log ${vl.id}: no agentSlug to derive org from`);
                voiceSkipped++;
                continue;
            }
            const resolved = await resolveAgentBySlug(vl.agentSlug as string);
            if (resolved) {
                if (!dryRun) {
                    await prisma.$executeRaw`
                        UPDATE voice_call_log
                        SET "organizationId" = ${resolved.organizationId}
                        WHERE id = ${vl.id}
                    `;
                }
                voiceUpdated++;
            } else {
                console.warn(
                    `  SKIP voice_call_log ${vl.id}: agent slug "${vl.agentSlug}" resolves to 0 or >1 agents`
                );
                voiceSkipped++;
            }
        }
        console.log(`VoiceCallLog: updated ${voiceUpdated}, skipped ${voiceSkipped}`);
    } else {
        console.log(`VoiceCallLog: no rows missing organizationId`);
    }

    // --- Deployment: backfill organizationId/workspaceId from referenced entity ---
    const deploymentsToUpdate = await prisma.$queryRaw<RawRow[]>`
        SELECT id, "entityType", "entityId", "organizationId", "workspaceId"
        FROM deployment
        WHERE "organizationId" IS NULL OR "organizationId" = ''
           OR "workspaceId" IS NULL OR "workspaceId" = ''
    `;
    console.log(`Deployment: found ${deploymentsToUpdate.length} rows missing org/workspace`);

    let deploymentUpdated = 0;
    for (const dep of deploymentsToUpdate) {
        let orgId: string | null = (dep.organizationId as string) || null;
        let wsId: string | null = (dep.workspaceId as string) || null;

        const entityType = dep.entityType as string;
        const entityId = dep.entityId as string;

        if (entityType === "agent") {
            const agent = await prisma.agent.findUnique({
                where: { id: entityId },
                select: {
                    workspaceId: true,
                    workspace: { select: { organizationId: true } }
                }
            });
            if (agent) {
                wsId = wsId || agent.workspaceId;
                orgId = orgId || agent.workspace.organizationId;
            }
        } else if (entityType === "workflow") {
            const workflow = await prisma.workflow.findUnique({
                where: { id: entityId },
                select: {
                    workspaceId: true,
                    workspace: { select: { organizationId: true } }
                }
            });
            if (workflow) {
                wsId = wsId || workflow.workspaceId;
                orgId = orgId || workflow.workspace.organizationId;
            }
        } else if (entityType === "network") {
            const network = await prisma.network.findUnique({
                where: { id: entityId },
                select: {
                    workspaceId: true,
                    workspace: { select: { organizationId: true } }
                }
            });
            if (network) {
                wsId = wsId || network.workspaceId;
                orgId = orgId || network.workspace.organizationId;
            }
        }

        if (orgId && wsId) {
            if (!dryRun) {
                await prisma.$executeRaw`
                    UPDATE deployment
                    SET "organizationId" = ${orgId}, "workspaceId" = ${wsId}
                    WHERE id = ${dep.id}
                `;
            }
            deploymentUpdated++;
        } else {
            console.warn(
                `  SKIP deployment ${dep.id}: could not resolve org/workspace from ${entityType}:${entityId}`
            );
        }
    }
    console.log(`Deployment: updated ${deploymentUpdated} rows`);

    // --- Skill: backfill organizationId where null from workspace's org ---
    if (!dryRun) {
        const skillResult = await prisma.$executeRaw`
            UPDATE skill AS s
            SET "organizationId" = w."organizationId"
            FROM workspace w
            WHERE s."workspaceId" = w.id
            AND (s."organizationId" IS NULL OR s."organizationId" = '')
            AND w."organizationId" IS NOT NULL
        `;
        console.log(`Skill: updated ${skillResult} rows with organizationId from workspace`);
    } else {
        console.log(`Skill: [DRY RUN] would update organizationId from workspace`);
    }

    // --- Document: backfill organizationId where null from workspace's org ---
    if (!dryRun) {
        const docResult = await prisma.$executeRaw`
            UPDATE document AS d
            SET "organizationId" = w."organizationId"
            FROM workspace w
            WHERE d."workspaceId" = w.id
            AND (d."organizationId" IS NULL OR d."organizationId" = '')
            AND w."organizationId" IS NOT NULL
        `;
        console.log(`Document: updated ${docResult} rows with organizationId from workspace`);
    } else {
        console.log(`Document: [DRY RUN] would update organizationId from workspace`);
    }

    if (dryRun) {
        console.log("\n[DRY RUN] No changes applied. Run with --apply to execute.");
    } else {
        console.log("\nContext backfill complete!");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
