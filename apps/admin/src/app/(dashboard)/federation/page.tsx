import Link from "next/link";
import { Globe2 } from "lucide-react";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function FederationDashboardPage() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
        activeAgreements,
        messages24h,
        costAgg,
        policyViolations,
        latencyAgg,
        agreements,
        recentMessages
    ] = await Promise.all([
        prisma.federationAgreement.count({ where: { status: "active" } }),

        prisma.federationMessage.count({
            where: { createdAt: { gte: oneDayAgo } }
        }),

        prisma.federationMessage.aggregate({
            where: { createdAt: { gte: oneDayAgo } },
            _sum: { costUsd: true }
        }),

        prisma.federationMessage.count({
            where: {
                createdAt: { gte: oneDayAgo },
                policyResult: { not: "approved" }
            }
        }),

        prisma.federationMessage.aggregate({
            where: {
                createdAt: { gte: oneDayAgo },
                latencyMs: { not: null }
            },
            _avg: { latencyMs: true }
        }),

        prisma.federationAgreement.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                initiatorOrg: { select: { name: true } },
                responderOrg: { select: { name: true } },
                _count: { select: { messages: true } }
            }
        }),

        prisma.federationMessage.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
                agreement: {
                    include: {
                        initiatorOrg: { select: { name: true } },
                        responderOrg: { select: { name: true } }
                    }
                }
            }
        })
    ]);

    const agreementCosts = await prisma.federationMessage.groupBy({
        by: ["agreementId"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { costUsd: true }
    });
    const costByAgreement: Record<string, number> = {};
    for (const row of agreementCosts) {
        costByAgreement[row.agreementId] = row._sum.costUsd ?? 0;
    }

    const lastActivity = await prisma.federationMessage.groupBy({
        by: ["agreementId"],
        _max: { createdAt: true }
    });
    const lastActivityByAgreement: Record<string, Date | null> = {};
    for (const row of lastActivity) {
        lastActivityByAgreement[row.agreementId] = row._max.createdAt ?? null;
    }

    const totalCost24h = costAgg._sum.costUsd ?? 0;
    const avgLatency = latencyAgg._avg.latencyMs ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Globe2 className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Federation</h1>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard label="Active Agreements" value={activeAgreements} />
                <KpiCard label="Total Messages (24h)" value={messages24h} />
                <KpiCard label="Total Cost (24h)" value={`$${totalCost24h.toFixed(4)}`} />
                <KpiCard
                    label="Policy Violations (24h)"
                    value={policyViolations}
                    accent={policyViolations > 0 ? "red" : undefined}
                />
                <KpiCard label="Avg Latency" value={`${Math.round(avgLatency)}ms`} />
            </div>

            <div>
                <h2 className="mb-3 text-lg font-semibold">Agreements</h2>
                {agreements.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No federation agreements yet.</p>
                ) : (
                    <div className="bg-card border-border overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border border-b">
                                    <th className="px-4 py-2 text-left font-medium">
                                        Initiator Org → Responder Org
                                    </th>
                                    <th className="px-4 py-2 text-left font-medium">Status</th>
                                    <th className="px-4 py-2 text-right font-medium">Messages</th>
                                    <th className="px-4 py-2 text-left font-medium">
                                        Last Activity
                                    </th>
                                    <th className="px-4 py-2 text-right font-medium">Cost (30d)</th>
                                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agreements.map((a) => (
                                    <tr key={a.id} className="border-border border-b last:border-0">
                                        <td className="px-4 py-2">
                                            {a.initiatorOrg.name} → {a.responderOrg.name}
                                        </td>
                                        <td className="px-4 py-2">
                                            <StatusBadge status={a.status} />
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs">
                                            {a._count.messages}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-2 text-xs">
                                            {lastActivityByAgreement[a.id]
                                                ? lastActivityByAgreement[a.id]!.toISOString()
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs">
                                            ${(costByAgreement[a.id] ?? 0).toFixed(4)}
                                        </td>
                                        <td className="px-4 py-2">
                                            <Link
                                                href={`/federation/${a.id}`}
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

            <div>
                <h2 className="mb-3 text-lg font-semibold">Global Message Feed</h2>
                {recentMessages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No federation messages yet.</p>
                ) : (
                    <div className="bg-card border-border overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border border-b">
                                    <th className="px-4 py-2 text-left font-medium">Time</th>
                                    <th className="px-4 py-2 text-left font-medium">Source</th>
                                    <th className="px-4 py-2 text-left font-medium">Target</th>
                                    <th className="px-4 py-2 text-left font-medium">Agreement</th>
                                    <th className="px-4 py-2 text-left font-medium">Policy</th>
                                    <th className="px-4 py-2 text-right font-medium">Cost</th>
                                    <th className="px-4 py-2 text-right font-medium">Latency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentMessages.map((msg) => {
                                    const sourceOrg =
                                        msg.sourceOrgId === msg.agreement.initiatorOrgId
                                            ? msg.agreement.initiatorOrg.name
                                            : msg.agreement.responderOrg.name;
                                    const targetOrg =
                                        msg.targetOrgId === msg.agreement.initiatorOrgId
                                            ? msg.agreement.initiatorOrg.name
                                            : msg.agreement.responderOrg.name;

                                    return (
                                        <tr
                                            key={msg.id}
                                            className="border-border border-b last:border-0"
                                        >
                                            <td className="text-muted-foreground px-4 py-2 text-xs">
                                                {msg.createdAt.toISOString()}
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="font-medium">{sourceOrg}</span> /{" "}
                                                <span className="text-muted-foreground">
                                                    {msg.sourceAgentSlug}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="font-medium">{targetOrg}</span> /{" "}
                                                <span className="text-muted-foreground">
                                                    {msg.targetAgentSlug}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <Link
                                                    href={`/federation/${msg.agreementId}`}
                                                    className="text-primary underline"
                                                >
                                                    {msg.agreement.initiatorOrg.name +
                                                        " ↔ " +
                                                        msg.agreement.responderOrg.name}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-2">
                                                <PolicyBadge result={msg.policyResult} />
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-xs">
                                                {msg.costUsd != null
                                                    ? `$${msg.costUsd.toFixed(4)}`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-xs">
                                                {msg.latencyMs != null ? `${msg.latencyMs}ms` : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({
    label,
    value,
    accent
}: {
    label: string;
    value: string | number;
    accent?: "red";
}) {
    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className={`text-3xl font-bold ${accent === "red" ? "text-red-500" : ""}`}>
                {value}
            </p>
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

function PolicyBadge({ result }: { result: string }) {
    const colors: Record<string, string> = {
        approved: "bg-green-500/10 text-green-500",
        filtered: "bg-yellow-500/10 text-yellow-500",
        blocked: "bg-red-500/10 text-red-500"
    };
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[result] ?? "bg-muted text-muted-foreground"}`}
        >
            {result}
        </span>
    );
}
