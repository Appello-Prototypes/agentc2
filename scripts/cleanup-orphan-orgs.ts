// @ts-ignore - Prisma client resolved via relative path
const { prisma } = await import("../packages/database/src/index");

const DRY_RUN = process.argv.includes("--dry-run");
const ORPHAN_ORG_SLUGS = [
    "corey-shelson-s-organization",
    "corey-shelson-s-organization-2",
    "claude-test-s-organization",
    "e2e-test-user-s-organization",
    "e2e-test-user-s-organization-2",
    "travis-s-organization",
    "starter-kit-test-1771995322141"
];

async function main() {
    console.log(`\n=== Orphan Organization Cleanup ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ===\n`);

    const orgs = await prisma.organization.findMany({
        where: { slug: { in: ORPHAN_ORG_SLUGS } },
        select: { id: true, slug: true, name: true }
    });

    console.log(`Found ${orgs.length} of ${ORPHAN_ORG_SLUGS.length} orphan organizations:\n`);
    for (const org of orgs) {
        console.log(`  - ${org.name} (${org.slug}) [${org.id}]`);
    }
    console.log();

    if (orgs.length === 0) {
        console.log("Nothing to clean up.");
        return;
    }

    const orgIds = orgs.map((o) => o.id);

    const workspaces = await prisma.workspace.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true, slug: true, organizationId: true }
    });
    const workspaceIds = workspaces.map((w) => w.id);

    console.log(`Workspaces to delete: ${workspaces.length}`);
    for (const ws of workspaces) {
        console.log(`  - ${ws.slug} [${ws.id}]`);
    }

    // Capture memberships BEFORE org deletion (cascade will remove them)
    const memberships = await prisma.membership.findMany({
        where: { organizationId: { in: orgIds } },
        select: { userId: true }
    });
    const potentialOrphanUserIds = [...new Set(memberships.map((m) => m.userId))];
    console.log(
        `Memberships found: ${memberships.length} (${potentialOrphanUserIds.length} unique users)`
    );

    if (DRY_RUN) {
        if (workspaceIds.length > 0) {
            const agents = await prisma.agent.findMany({
                where: { workspaceId: { in: workspaceIds } },
                select: { id: true, slug: true }
            });
            console.log(`Agents to delete: ${agents.length}`);
            for (const a of agents) console.log(`  - ${a.slug} [${a.id}]`);
        }
        console.log("\nDRY RUN complete. No changes were made.");
        console.log("Run without --dry-run to execute deletion.\n");
        return;
    }

    console.log("\nExecuting deletion in correct dependency order...\n");

    // ========================================================================
    // ORG-LEVEL RESTRICT RELATIONS (always run, regardless of workspace count)
    // ========================================================================

    const channelSessionsDel = await prisma.channelSession.deleteMany({
        where: { organizationId: { in: orgIds } }
    });
    console.log(`  Deleted ${channelSessionsDel.count} ChannelSession records`);

    const channelCredsDel = await prisma.channelCredentials.deleteMany({
        where: { organizationId: { in: orgIds } }
    });
    console.log(`  Deleted ${channelCredsDel.count} ChannelCredentials records`);

    const voiceCallDel = await prisma.voiceCallLog.deleteMany({
        where: { organizationId: { in: orgIds } }
    });
    console.log(`  Deleted ${voiceCallDel.count} VoiceCallLog records`);

    const impersonationDel = await prisma.impersonationSession.deleteMany({
        where: { targetOrgId: { in: orgIds } }
    });
    console.log(`  Deleted ${impersonationDel.count} ImpersonationSession records`);

    const supportTicketDel = await prisma.supportTicket.deleteMany({
        where: { organizationId: { in: orgIds } }
    });
    console.log(`  Deleted ${supportTicketDel.count} SupportTicket records`);

    const fedAuditDel = await prisma.federationAuditLog.deleteMany({
        where: { organizationId: { in: orgIds } }
    });
    console.log(`  Deleted ${fedAuditDel.count} FederationAuditLog records`);

    const fedExposureOrgDel = await prisma.federationExposure.deleteMany({
        where: { ownerOrgId: { in: orgIds } }
    });
    console.log(`  Deleted ${fedExposureOrgDel.count} FederationExposure (by org) records`);

    // FederationAgreement (initiatorOrgId / responderOrgId are Restrict)
    const fedAgreements = await prisma.federationAgreement.findMany({
        where: {
            OR: [{ initiatorOrgId: { in: orgIds } }, { responderOrgId: { in: orgIds } }]
        },
        select: { id: true }
    });
    if (fedAgreements.length > 0) {
        const agreementIds = fedAgreements.map((a: { id: string }) => a.id);
        const fedExpByAgreement = await prisma.federationExposure.deleteMany({
            where: { agreementId: { in: agreementIds } }
        });
        console.log(
            `  Deleted ${fedExpByAgreement.count} FederationExposure (by agreement) records`
        );
    }
    const fedAgreementDel = await prisma.federationAgreement.deleteMany({
        where: {
            OR: [{ initiatorOrgId: { in: orgIds } }, { responderOrgId: { in: orgIds } }]
        }
    });
    console.log(`  Deleted ${fedAgreementDel.count} FederationAgreement records`);

    const playbookInstDel = await prisma.playbookInstallation.deleteMany({
        where: {
            OR: [
                { targetOrgId: { in: orgIds } },
                ...(workspaceIds.length > 0 ? [{ targetWorkspaceId: { in: workspaceIds } }] : [])
            ]
        }
    });
    console.log(`  Deleted ${playbookInstDel.count} PlaybookInstallation records`);

    const playbookReviewDel = await prisma.playbookReview.deleteMany({
        where: { reviewerOrgId: { in: orgIds } }
    });
    console.log(`  Deleted ${playbookReviewDel.count} PlaybookReview records`);

    // Playbook children before deleting Playbooks (publisherOrgId FK is Restrict)
    const publishedPlaybooks = await prisma.playbook.findMany({
        where: { publisherOrgId: { in: orgIds } },
        select: { id: true }
    });
    const publishedPlaybookIds = publishedPlaybooks.map((p: { id: string }) => p.id);
    if (publishedPlaybookIds.length > 0) {
        const instByPlaybook = await prisma.playbookInstallation.deleteMany({
            where: { playbookId: { in: publishedPlaybookIds } }
        });
        console.log(`  Deleted ${instByPlaybook.count} PlaybookInstallation (by playbook) records`);
        const purchaseDel = await prisma.playbookPurchase.deleteMany({
            where: { playbookId: { in: publishedPlaybookIds } }
        });
        console.log(`  Deleted ${purchaseDel.count} PlaybookPurchase records`);
    }
    const purchaseBuyerDel = await prisma.playbookPurchase.deleteMany({
        where: { buyerOrgId: { in: orgIds } }
    });
    console.log(`  Deleted ${purchaseBuyerDel.count} PlaybookPurchase (buyer) records`);

    const playbookDel = await prisma.playbook.deleteMany({
        where: { publisherOrgId: { in: orgIds } }
    });
    console.log(`  Deleted ${playbookDel.count} Playbook records`);

    console.log();

    // ========================================================================
    // WORKSPACE-LEVEL RESTRICT RELATIONS (only if workspaces still exist)
    // ========================================================================

    if (workspaceIds.length > 0) {
        const agents = await prisma.agent.findMany({
            where: { workspaceId: { in: workspaceIds } },
            select: { id: true, slug: true }
        });
        const agentIds = agents.map((a) => a.id);

        const approvalDel = await prisma.approvalRequest.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${approvalDel.count} ApprovalRequest records`);

        if (agentIds.length > 0) {
            const fedExpAgentDel = await prisma.federationExposure.deleteMany({
                where: { agentId: { in: agentIds } }
            });
            console.log(`  Deleted ${fedExpAgentDel.count} FederationExposure (by agent) records`);
        }

        const agentScheduleDel = await prisma.agentSchedule.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${agentScheduleDel.count} AgentSchedule records`);

        const agentTriggerDel = await prisma.agentTrigger.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${agentTriggerDel.count} AgentTrigger records`);

        const gmailIntDel = await prisma.gmailIntegration.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${gmailIntDel.count} GmailIntegration records`);

        const agentSessionDel = await prisma.agentSession.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${agentSessionDel.count} AgentSession records`);

        const backlogDel = await prisma.backlog.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${backlogDel.count} Backlog records`);

        const communityDel = await prisma.communityBoard.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${communityDel.count} CommunityBoard records`);

        const deploymentDel = await prisma.deployment.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${deploymentDel.count} Deployment records`);

        const bimDel = await prisma.bimModel.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${bimDel.count} BimModel records`);

        const campaignScheduleDel = await prisma.campaignSchedule.deleteMany({
            where: { organizationId: { in: orgIds } }
        });
        console.log(`  Deleted ${campaignScheduleDel.count} CampaignSchedule records`);

        const campaignTemplateDel = await prisma.campaignTemplate.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${campaignTemplateDel.count} CampaignTemplate records`);

        const campaignDel = await prisma.campaign.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${campaignDel.count} Campaign records`);

        const pulseMemberDel = await prisma.pulseMember.deleteMany({
            where: { pulse: { workspaceId: { in: workspaceIds } } }
        });
        console.log(`  Deleted ${pulseMemberDel.count} PulseMember records`);

        const pulseDel = await prisma.pulse.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${pulseDel.count} Pulse records`);

        const skillDel = await prisma.skill.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${skillDel.count} Skill records`);

        const docDel = await prisma.document.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${docDel.count} Document records`);

        console.log();

        const networkDel = await prisma.network.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${networkDel.count} Network records (children cascade)`);

        const workflowDel = await prisma.workflow.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${workflowDel.count} Workflow records (children cascade)`);

        const agentDel = await prisma.agent.deleteMany({
            where: { workspaceId: { in: workspaceIds } }
        });
        console.log(`  Deleted ${agentDel.count} Agent records (children cascade)`);

        console.log();

        const wsDel = await prisma.workspace.deleteMany({
            where: { id: { in: workspaceIds } }
        });
        console.log(`  Deleted ${wsDel.count} Workspace records`);
    }

    // ========================================================================
    // DELETE ORGANIZATIONS (cascades Membership, IntegrationConnection, etc.)
    // ========================================================================

    const orgDel = await prisma.organization.deleteMany({
        where: { id: { in: orgIds } }
    });
    console.log(`  Deleted ${orgDel.count} Organization records (cascades memberships, etc.)`);

    // ========================================================================
    // DELETE ORPHAN USERS (no remaining memberships in any org)
    // ========================================================================

    if (potentialOrphanUserIds.length > 0) {
        const usersWithRemainingMemberships = await prisma.membership.findMany({
            where: {
                userId: { in: potentialOrphanUserIds }
            },
            select: { userId: true }
        });
        const usersToKeep = new Set(usersWithRemainingMemberships.map((m) => m.userId));
        const orphanUserIds = potentialOrphanUserIds.filter((id) => !usersToKeep.has(id));

        if (orphanUserIds.length > 0) {
            const orphanUsers = await prisma.user.findMany({
                where: { id: { in: orphanUserIds } },
                select: { id: true, name: true, email: true }
            });
            console.log(`\n  Orphan users to delete (no remaining memberships):`);
            for (const u of orphanUsers) {
                console.log(`    - ${u.name} (${u.email}) [${u.id}]`);
            }

            await prisma.session.deleteMany({ where: { userId: { in: orphanUserIds } } });
            await prisma.account.deleteMany({ where: { userId: { in: orphanUserIds } } });
            const userDel = await prisma.user.deleteMany({
                where: { id: { in: orphanUserIds } }
            });
            console.log(`  Deleted ${userDel.count} orphan User records`);
        } else {
            console.log(`\n  No orphan users to delete (all have remaining memberships)`);
        }
    }

    console.log(`\n=== Cleanup complete ===\n`);
}

main()
    .catch((e) => {
        console.error("Cleanup failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
