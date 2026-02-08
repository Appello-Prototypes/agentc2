import { prisma, type Prisma } from "@repo/database";

type ResolveIdentityOptions = {
    organizationId: string;
    email?: string | null;
    slackUserId?: string | null;
    hubspotContactId?: string | null;
    hubspotCompanyId?: string | null;
    metadata?: Record<string, unknown>;
};

const getEmailDomain = (email?: string | null) => {
    if (!email) return null;
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    return parts[1]?.toLowerCase() || null;
};

export const resolveIdentity = async (options: ResolveIdentityOptions) => {
    const domain = getEmailDomain(options.email);

    const existing = await prisma.identityMapping.findFirst({
        where: {
            organizationId: options.organizationId,
            OR: [
                ...(options.email ? [{ email: options.email }] : []),
                ...(options.slackUserId ? [{ slackUserId: options.slackUserId }] : [])
            ]
        }
    });

    const orgDomains = domain
        ? await prisma.organizationDomain.findMany({
              where: { organizationId: options.organizationId, domain }
          })
        : [];

    const metadata: Record<string, unknown> = {
        ...(existing?.metadata && typeof existing.metadata === "object"
            ? (existing.metadata as Record<string, unknown>)
            : {}),
        ...(options.metadata || {}),
        ...(domain ? { domain } : {}),
        ...(orgDomains.length > 0 ? { isInternalDomain: true } : {})
    };

    if (existing) {
        return prisma.identityMapping.update({
            where: { id: existing.id },
            data: {
                email: options.email || existing.email,
                domain: domain || existing.domain,
                slackUserId: options.slackUserId || existing.slackUserId,
                hubspotContactId: options.hubspotContactId || existing.hubspotContactId,
                hubspotCompanyId: options.hubspotCompanyId || existing.hubspotCompanyId,
                metadata: metadata as Prisma.InputJsonValue
            }
        });
    }

    return prisma.identityMapping.create({
        data: {
            organizationId: options.organizationId,
            email: options.email || null,
            domain,
            slackUserId: options.slackUserId || null,
            hubspotContactId: options.hubspotContactId || null,
            hubspotCompanyId: options.hubspotCompanyId || null,
            metadata: metadata as Prisma.InputJsonValue
        }
    });
};
