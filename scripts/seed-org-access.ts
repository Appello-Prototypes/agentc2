import { randomBytes } from "crypto";
import { prisma } from "../packages/database/src";

type CredentialSeed = {
    toolId: string;
    name: string;
    credentials: Record<string, string> | null;
};

function buildCredentials(): CredentialSeed[] {
    const env = process.env;
    return [
        {
            toolId: "firecrawl",
            name: "Firecrawl",
            credentials: env.FIRECRAWL_API_KEY ? { FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY } : null
        },
        {
            toolId: "hubspot",
            name: "HubSpot",
            credentials: env.HUBSPOT_ACCESS_TOKEN
                ? { PRIVATE_APP_ACCESS_TOKEN: env.HUBSPOT_ACCESS_TOKEN }
                : null
        },
        {
            toolId: "jira",
            name: "Jira",
            credentials:
                env.JIRA_URL && env.JIRA_USERNAME && env.JIRA_API_TOKEN
                    ? {
                          JIRA_URL: env.JIRA_URL,
                          JIRA_USERNAME: env.JIRA_USERNAME,
                          JIRA_API_TOKEN: env.JIRA_API_TOKEN,
                          ...(env.JIRA_PROJECTS_FILTER
                              ? { JIRA_PROJECTS_FILTER: env.JIRA_PROJECTS_FILTER }
                              : {})
                      }
                    : null
        },
        {
            toolId: "justcall",
            name: "JustCall",
            credentials: env.JUSTCALL_AUTH_TOKEN
                ? { JUSTCALL_AUTH_TOKEN: env.JUSTCALL_AUTH_TOKEN }
                : null
        },
        {
            toolId: "atlas",
            name: "ATLAS",
            credentials: env.ATLAS_N8N_SSE_URL ? { ATLAS_N8N_SSE_URL: env.ATLAS_N8N_SSE_URL } : null
        },
        {
            toolId: "fathom",
            name: "Fathom",
            credentials: env.FATHOM_API_KEY ? { FATHOM_API_KEY: env.FATHOM_API_KEY } : null
        },
        {
            toolId: "slack",
            name: "Slack",
            credentials:
                env.SLACK_BOT_TOKEN && env.SLACK_TEAM_ID
                    ? { SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN, SLACK_TEAM_ID: env.SLACK_TEAM_ID }
                    : null
        },
        {
            toolId: "gdrive",
            name: "Google Drive",
            credentials: env.GDRIVE_CREDENTIALS_PATH
                ? {
                      GDRIVE_CREDENTIALS_PATH: env.GDRIVE_CREDENTIALS_PATH,
                      ...(env.GDRIVE_OAUTH_PATH ? { GDRIVE_OAUTH_PATH: env.GDRIVE_OAUTH_PATH } : {})
                  }
                : null
        },
        {
            toolId: "github",
            name: "GitHub",
            credentials: env.GITHUB_PERSONAL_ACCESS_TOKEN
                ? { GITHUB_PERSONAL_ACCESS_TOKEN: env.GITHUB_PERSONAL_ACCESS_TOKEN }
                : null
        }
    ];
}

function getEmailDomain(email?: string | null): string | null {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    return parts[1]?.toLowerCase() || null;
}

async function generateUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
        const code = `INV-${randomBytes(5).toString("hex").toUpperCase()}`;
        const existing = await prisma.organizationInvite.findUnique({
            where: { code }
        });
        if (!existing) {
            return code;
        }
    }
    throw new Error("Failed to generate unique invite code");
}

async function ensureOrganizationDomains(organizationId: string) {
    const existingDomains = await prisma.organizationDomain.findMany({
        where: { organizationId }
    });
    if (existingDomains.length > 0) {
        return { created: null };
    }

    const membership = await prisma.membership.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" }
    });
    if (!membership) {
        return { created: null };
    }

    const user = await prisma.user.findUnique({
        where: { id: membership.userId }
    });
    const domain = getEmailDomain(user?.email);
    if (!domain) {
        return { created: null };
    }

    const created = await prisma.organizationDomain.create({
        data: {
            organizationId,
            domain,
            isPrimary: true
        }
    });

    return { created };
}

async function ensureOrganizationInvite(organizationId: string) {
    const existingInvite = await prisma.organizationInvite.findFirst({
        where: { organizationId, isActive: true },
        orderBy: { createdAt: "desc" }
    });
    if (existingInvite) {
        return { invite: existingInvite, created: false };
    }

    const code = await generateUniqueInviteCode();
    const invite = await prisma.organizationInvite.create({
        data: {
            organizationId,
            code,
            isActive: true
        }
    });

    return { invite, created: true };
}

async function seedToolCredentials(organizationId: string, seeds: CredentialSeed[]) {
    let created = 0;
    let skipped = 0;

    for (const seed of seeds) {
        if (!seed.credentials) {
            skipped += 1;
            continue;
        }

        const existing = await prisma.toolCredential.findUnique({
            where: {
                organizationId_toolId: {
                    organizationId,
                    toolId: seed.toolId
                }
            }
        });

        if (existing && existing.credentials) {
            skipped += 1;
            continue;
        }

        await prisma.toolCredential.upsert({
            where: {
                organizationId_toolId: {
                    organizationId,
                    toolId: seed.toolId
                }
            },
            update: {
                name: seed.name,
                credentials: seed.credentials,
                isActive: true,
                updatedAt: new Date()
            },
            create: {
                organizationId,
                toolId: seed.toolId,
                name: seed.name,
                credentials: seed.credentials,
                isActive: true,
                createdBy: "seed-org-access"
            }
        });

        created += 1;
    }

    return { created, skipped };
}

async function main() {
    const organizations = await prisma.organization.findMany({
        orderBy: { createdAt: "asc" }
    });

    if (organizations.length === 0) {
        console.log("No organizations found. Nothing to seed.");
        return;
    }

    const seeds = buildCredentials();
    const inviteSummary: Array<{ orgId: string; orgSlug: string; code: string; created: boolean }> =
        [];

    for (const org of organizations) {
        const domainResult = await ensureOrganizationDomains(org.id);
        if (domainResult.created) {
            console.log(
                `Created domain ${domainResult.created.domain} for organization ${org.slug}`
            );
        }

        const inviteResult = await ensureOrganizationInvite(org.id);
        inviteSummary.push({
            orgId: org.id,
            orgSlug: org.slug,
            code: inviteResult.invite.code,
            created: inviteResult.created
        });

        const toolResult = await seedToolCredentials(org.id, seeds);
        console.log(
            `Seeded credentials for org ${org.slug}: created=${toolResult.created}, skipped=${toolResult.skipped}`
        );
    }

    console.log("Invite codes:");
    inviteSummary.forEach((invite) => {
        console.log(
            `- ${invite.orgSlug} (${invite.orgId}): ${invite.code}${invite.created ? "" : " (existing)"}`
        );
    });
}

main()
    .catch((error) => {
        console.error("Failed to seed org access:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
