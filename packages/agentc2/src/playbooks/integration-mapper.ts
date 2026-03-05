import { prisma } from "@repo/database";
import type { IntegrationMapping } from "./types";

interface IntegrationDependency {
    provider: string;
    requiredTools?: string[];
}

export async function mapIntegrations(opts: {
    requiredIntegrations: string[];
    integrationDependencies?: IntegrationDependency[];
    targetOrgId: string;
    targetWorkspaceId: string;
}): Promise<IntegrationMapping[]> {
    if (opts.requiredIntegrations.length === 0) {
        return [];
    }

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

    // Build dependency map for tool-level checks
    const depMap = new Map<string, string[]>();
    if (opts.integrationDependencies) {
        for (const dep of opts.integrationDependencies) {
            if (dep.requiredTools && dep.requiredTools.length > 0) {
                depMap.set(dep.provider, dep.requiredTools);
            }
        }
    }

    // Load IntegrationTool records for connected providers that have tool-level requirements
    const connectedIds = Array.from(connectionByProvider.values())
        .filter((c) => c.isActive)
        .map((c) => c.id);

    let toolsByConnection = new Map<string, { toolId: string; isEnabled: boolean }[]>();
    if (connectedIds.length > 0 && depMap.size > 0) {
        const tools = await prisma.integrationTool.findMany({
            where: { connectionId: { in: connectedIds } },
            select: { connectionId: true, toolId: true, isEnabled: true }
        });
        for (const tool of tools) {
            const list = toolsByConnection.get(tool.connectionId) ?? [];
            list.push({ toolId: tool.toolId, isEnabled: tool.isEnabled });
            toolsByConnection.set(tool.connectionId, list);
        }
    }

    return opts.requiredIntegrations.map((provider) => {
        const conn = connectionByProvider.get(provider);
        const mapping: IntegrationMapping = {
            provider,
            connected: conn?.isActive ?? false,
            connectionId: conn?.id
        };

        // Check tool-level readiness if dependencies are specified
        const requiredTools = depMap.get(provider);
        if (conn?.isActive && conn.id && requiredTools && requiredTools.length > 0) {
            const connTools = toolsByConnection.get(conn.id) ?? [];
            const connToolMap = new Map(connTools.map((t) => [t.toolId, t.isEnabled]));

            const missingTools: string[] = [];
            const disabledTools: string[] = [];

            for (const reqToolId of requiredTools) {
                if (!connToolMap.has(reqToolId)) {
                    missingTools.push(reqToolId);
                } else if (!connToolMap.get(reqToolId)) {
                    disabledTools.push(reqToolId);
                }
            }

            mapping.toolsReady = missingTools.length === 0 && disabledTools.length === 0;
            mapping.missingTools = missingTools;
            mapping.disabledTools = disabledTools;
        } else if (conn?.isActive) {
            mapping.toolsReady = true;
        }

        return mapping;
    });
}
