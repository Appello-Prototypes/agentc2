import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { TenantEditForm } from "@/components/tenant-edit-form";
import { TenantDeleteButton } from "@/components/tenant-delete-button";

export const dynamic = "force-dynamic";

export default async function TenantOverviewPage({
    params
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        include: {
            _count: {
                select: {
                    workspaces: true,
                    memberships: true,
                    integrationConnections: true
                }
            }
        }
    });

    if (!org) notFound();

    // Count agents across all workspaces
    const agentCount = await prisma.agent.count({
        where: { workspace: { organizationId: org.id } }
    });

    return (
        <div className="space-y-6">
            {/* Info grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard label="Workspaces" value={org._count.workspaces} />
                <InfoCard label="Members" value={org._count.memberships} />
                <InfoCard label="Agents" value={agentCount} />
                <InfoCard label="Integrations" value={org._count.integrationConnections} />
            </div>

            {/* Details */}
            <div className="bg-card border-border rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Details</h2>
                    <TenantEditForm
                        tenant={{
                            id: org.id,
                            name: org.name,
                            slug: org.slug,
                            description: org.description,
                            timezone: org.timezone,
                            maxAgents: org.maxAgents,
                            maxWorkspaces: org.maxWorkspaces,
                            maxRunsPerMonth: org.maxRunsPerMonth,
                            maxSeats: org.maxSeats
                        }}
                    />
                </div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">ID</dt>
                    <dd className="font-mono text-xs">{org.id}</dd>

                    <dt className="text-muted-foreground">Slug</dt>
                    <dd>{org.slug}</dd>

                    <dt className="text-muted-foreground">Description</dt>
                    <dd>{org.description || "—"}</dd>

                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{org.status}</dd>

                    <dt className="text-muted-foreground">Timezone</dt>
                    <dd>{org.timezone || "—"}</dd>

                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{org.createdAt.toISOString()}</dd>

                    <dt className="text-muted-foreground">Stripe Customer</dt>
                    <dd>{org.stripeCustomerId || "—"}</dd>

                    <dt className="text-muted-foreground">Risk Score</dt>
                    <dd>{org.riskScore !== null ? `${(org.riskScore * 100).toFixed(0)}%` : "—"}</dd>

                    <dt className="text-muted-foreground">Max Agents</dt>
                    <dd>{org.maxAgents ?? "Unlimited"}</dd>

                    <dt className="text-muted-foreground">Max Workspaces</dt>
                    <dd>{org.maxWorkspaces ?? "Unlimited"}</dd>

                    <dt className="text-muted-foreground">Max Seats</dt>
                    <dd>{org.maxSeats ?? "Unlimited"}</dd>

                    <dt className="text-muted-foreground">Max Runs/Month</dt>
                    <dd>{org.maxRunsPerMonth ?? "Unlimited"}</dd>

                    <dt className="text-muted-foreground">Trial Ends</dt>
                    <dd>{org.trialEndsAt ? org.trialEndsAt.toISOString() : "—"}</dd>

                    {org.suspendedAt && (
                        <>
                            <dt className="text-muted-foreground">Suspended At</dt>
                            <dd className="text-red-500">{org.suspendedAt.toISOString()}</dd>
                            <dt className="text-muted-foreground">Suspend Reason</dt>
                            <dd className="text-red-500">{org.suspendedReason || "—"}</dd>
                        </>
                    )}
                </dl>
            </div>

            {/* Danger zone */}
            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-3 text-sm font-semibold">Danger Zone</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Delete this tenant</p>
                        <p className="text-muted-foreground text-xs">
                            Deactivates the tenant and marks it for deletion after 30 days
                        </p>
                    </div>
                    <TenantDeleteButton orgId={org.id} orgName={org.name} status={org.status} />
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}
