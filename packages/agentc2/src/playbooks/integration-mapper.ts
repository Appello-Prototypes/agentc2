import { prisma } from "@repo/database";
import type { IntegrationMapping } from "./types";

export async function mapIntegrations(opts: {
    requiredIntegrations: string[];
    targetOrgId: string;
    targetWorkspaceId: string;
}): Promise<IntegrationMapping[]> {
    if (opts.requiredIntegrations.length === 0) {
        return [];
    }

    // IntegrationProvider.key matches our integration names (e.g., "hubspot")
    const providers = await prisma.integrationProvider.findMany({
        where: { key: { in: opts.requiredIntegrations } },
        select: { id: true, key: true }
    });

    const providerIdToKey = new Map<string, string>();
    const providerIds: string[] = [];
    for (const p of providers) {
        providerIdToKey.set(p.id, p.key);
        providerIds.push(p.id);
    }

    const connections = await prisma.integrationConnection.findMany({
        where: {
            organizationId: opts.targetOrgId,
            providerId: { in: providerIds }
        },
        select: {
            id: true,
            providerId: true,
            isActive: true
        }
    });

    const connectionByProvider = new Map<string, { id: string; isActive: boolean }>();
    for (const conn of connections) {
        const key = providerIdToKey.get(conn.providerId);
        if (!key) continue;
        if (conn.isActive || !connectionByProvider.has(key)) {
            connectionByProvider.set(key, { id: conn.id, isActive: conn.isActive });
        }
    }

    return opts.requiredIntegrations.map((provider) => {
        const conn = connectionByProvider.get(provider);
        return {
            provider,
            connected: conn?.isActive ?? false,
            connectionId: conn?.id
        };
    });
}
