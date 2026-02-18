import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

interface Governance {
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
    dataClassification: string;
    allowFileTransfer: boolean;
    requireHumanApproval: boolean;
}

export default async function AgreementDetailPage({
    params
}: {
    params: Promise<{ agreementId: string }>;
}) {
    const { agreementId } = await params;

    const agreement = await prisma.federationAgreement.findUnique({
        where: { id: agreementId },
        include: {
            initiatorOrg: { select: { id: true, name: true, slug: true } },
            responderOrg: { select: { id: true, name: true, slug: true } },
            exposures: {
                include: {
                    ownerOrg: { select: { name: true } },
                    agent: { select: { name: true, slug: true } }
                }
            }
        }
    });

    if (!agreement) notFound();

    const [msgAgg, lastMsg, conversations] = await Promise.all([
        prisma.federationMessage.aggregate({
            where: { agreementId },
            _count: { id: true },
            _sum: { costUsd: true },
            _avg: { latencyMs: true }
        }),

        prisma.federationMessage.findFirst({
            where: { agreementId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        }),

        prisma.federationMessage.groupBy({
            by: ["conversationId"],
            where: { agreementId },
            _count: { id: true },
            _max: { createdAt: true },
            _sum: { costUsd: true },
            orderBy: { _max: { createdAt: "desc" } },
            take: 10
        })
    ]);

    const governance: Governance = {
        maxRequestsPerHour: agreement.maxRequestsPerHour,
        maxRequestsPerDay: agreement.maxRequestsPerDay,
        dataClassification: agreement.dataClassification,
        allowFileTransfer: agreement.allowFileTransfer,
        requireHumanApproval: agreement.requireHumanApproval
    };

    const initiatorExposures = agreement.exposures.filter(
        (e) => e.ownerOrgId === agreement.initiatorOrgId
    );
    const responderExposures = agreement.exposures.filter(
        (e) => e.ownerOrgId === agreement.responderOrgId
    );

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/federation"
                    className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Federation
                </Link>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">
                        {agreement.initiatorOrg.name} ↔ {agreement.responderOrg.name}
                    </h1>
                    <StatusBadge status={agreement.status} />
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-xs">{agreement.id}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Messages" value={msgAgg._count.id} />
                <StatCard label="Total Cost" value={`$${(msgAgg._sum.costUsd ?? 0).toFixed(4)}`} />
                <StatCard
                    label="Avg Latency"
                    value={`${Math.round(msgAgg._avg.latencyMs ?? 0)}ms`}
                />
                <StatCard
                    label="Last Activity"
                    value={lastMsg ? lastMsg.createdAt.toISOString().slice(0, 16) : "—"}
                    small
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-3 text-sm font-semibold">
                        Exposed Agents — {agreement.initiatorOrg.name}
                    </h2>
                    {initiatorExposures.length === 0 ? (
                        <p className="text-muted-foreground text-sm">None exposed.</p>
                    ) : (
                        <ul className="space-y-1">
                            {initiatorExposures.map((e) => (
                                <li
                                    key={e.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span>
                                        <span className="font-medium">{e.agent.name}</span>{" "}
                                        <span className="text-muted-foreground text-xs">
                                            ({e.agent.slug})
                                        </span>
                                    </span>
                                    <span
                                        className={`text-xs ${e.enabled ? "text-green-500" : "text-red-500"}`}
                                    >
                                        {e.enabled ? "enabled" : "disabled"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-3 text-sm font-semibold">
                        Exposed Agents — {agreement.responderOrg.name}
                    </h2>
                    {responderExposures.length === 0 ? (
                        <p className="text-muted-foreground text-sm">None exposed.</p>
                    ) : (
                        <ul className="space-y-1">
                            {responderExposures.map((e) => (
                                <li
                                    key={e.id}
                                    className="flex items-center justify-between text-sm"
                                >
                                    <span>
                                        <span className="font-medium">{e.agent.name}</span>{" "}
                                        <span className="text-muted-foreground text-xs">
                                            ({e.agent.slug})
                                        </span>
                                    </span>
                                    <span
                                        className={`text-xs ${e.enabled ? "text-green-500" : "text-red-500"}`}
                                    >
                                        {e.enabled ? "enabled" : "disabled"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-3 text-sm font-semibold">Governance</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                    <dt className="text-muted-foreground">Max Requests / Hour</dt>
                    <dd className="font-mono text-xs sm:col-span-2">
                        {governance.maxRequestsPerHour}
                    </dd>

                    <dt className="text-muted-foreground">Max Requests / Day</dt>
                    <dd className="font-mono text-xs sm:col-span-2">
                        {governance.maxRequestsPerDay}
                    </dd>

                    <dt className="text-muted-foreground">Data Classification</dt>
                    <dd className="sm:col-span-2">
                        <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                            {governance.dataClassification}
                        </span>
                    </dd>

                    <dt className="text-muted-foreground">File Transfer</dt>
                    <dd className="sm:col-span-2">
                        {governance.allowFileTransfer ? (
                            <span className="text-xs text-green-500">Allowed</span>
                        ) : (
                            <span className="text-muted-foreground text-xs">Disabled</span>
                        )}
                    </dd>

                    <dt className="text-muted-foreground">Human Approval</dt>
                    <dd className="sm:col-span-2">
                        {governance.requireHumanApproval ? (
                            <span className="text-xs text-yellow-500">Required</span>
                        ) : (
                            <span className="text-muted-foreground text-xs">Not required</span>
                        )}
                    </dd>
                </dl>
            </div>

            <div>
                <h2 className="mb-3 text-lg font-semibold">Recent Conversations</h2>
                {conversations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No conversations yet.</p>
                ) : (
                    <div className="bg-card border-border overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border border-b">
                                    <th className="px-4 py-2 text-left font-medium">
                                        Conversation ID
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">Messages</th>
                                    <th className="px-4 py-2 text-right font-medium">Cost</th>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Last Message
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversations.map((conv) => (
                                    <tr
                                        key={conv.conversationId}
                                        className="border-border border-b last:border-0"
                                    >
                                        <td className="px-4 py-2 font-mono text-xs">
                                            {conv.conversationId.slice(0, 12)}…
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs">
                                            {conv._count.id}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs">
                                            ${(conv._sum.costUsd ?? 0).toFixed(4)}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-2 text-xs">
                                            {conv._max.createdAt
                                                ? conv._max.createdAt.toISOString()
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-2">
                                            <Link
                                                href={`/federation/${agreementId}/conversations/${conv.conversationId}`}
                                                className="text-primary text-xs underline"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    small
}: {
    label: string;
    value: string | number;
    small?: boolean;
}) {
    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className={`font-bold ${small ? "text-lg" : "text-3xl"}`}>{value}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        pending: "bg-yellow-500/10 text-yellow-500",
        suspended: "bg-orange-500/10 text-orange-500",
        revoked: "bg-red-500/10 text-red-500"
    };
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground"}`}
        >
            {status}
        </span>
    );
}
