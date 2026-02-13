import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

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

    // Get all flags and this tenant's overrides
    const flags = await prisma.featureFlag.findMany({
        where: { isActive: true },
        include: {
            overrides: {
                where: { organizationId: org.id }
            }
        },
        orderBy: { key: "asc" }
    });

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Feature Flag Overrides</h2>
            <p className="text-muted-foreground text-sm">
                Shows global flags with any tenant-specific overrides for this organization.
            </p>
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Flag</th>
                            <th className="px-4 py-2 text-left font-medium">Default</th>
                            <th className="px-4 py-2 text-left font-medium">Override</th>
                            <th className="px-4 py-2 text-left font-medium">Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flags.map((flag) => {
                            const override = flag.overrides[0];
                            return (
                                <tr key={flag.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">
                                        <div className="font-medium">{flag.name}</div>
                                        <div className="text-muted-foreground font-mono text-xs">
                                            {flag.key}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {flag.defaultValue}
                                    </td>
                                    <td className="px-4 py-2">
                                        {override ? (
                                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-500">
                                                {override.value}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                (default)
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {override?.reason || "—"}
                                    </td>
                                </tr>
                            );
                        })}
                        {flags.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No feature flags defined
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
