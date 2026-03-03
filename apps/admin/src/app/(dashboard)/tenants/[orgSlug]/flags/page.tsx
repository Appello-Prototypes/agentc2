import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { TenantFlagOverrideManager } from "@/components/tenant-flag-override-manager";

export const dynamic = "force-dynamic";

export default async function TenantFlagsPage({
    params
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true }
    });
    if (!org) notFound();

    const flags = await prisma.featureFlag.findMany({
        where: { isActive: true },
        include: {
            overrides: {
                where: { organizationId: org.id }
            }
        },
        orderBy: { key: "asc" }
    });

    const flagData = flags.map((flag) => ({
        id: flag.id,
        key: flag.key,
        name: flag.name,
        defaultValue: flag.defaultValue,
        override: flag.overrides[0]
            ? {
                  id: flag.overrides[0].id,
                  value: flag.overrides[0].value,
                  reason: flag.overrides[0].reason
              }
            : null
    }));

    return <TenantFlagOverrideManager orgId={org.id} flags={flagData} />;
}
