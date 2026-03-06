#!/usr/bin/env bun
/**
 * Migrate Stale Models
 *
 * Audits all Agent, Network, and AgentVersion records for invalid/stale model names,
 * maps them to the closest valid equivalent, and optionally applies the fixes.
 *
 * Usage:
 *   bun run scripts/migrate-stale-models.ts            # Dry-run (default)
 *   bun run scripts/migrate-stale-models.ts --apply     # Apply fixes
 */

import { config } from "dotenv";
import { prisma } from "../packages/database/src";
import { getAllModels, resolveModelAlias } from "../packages/agentc2/src/agents/model-registry";
import type { ModelDefinition, ModelProvider } from "../packages/agentc2/src/agents/model-registry";

config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

const STALE_MODEL_MAP: Record<string, Record<string, string>> = {
    openai: {
        "gpt-4-turbo-preview": "gpt-4-turbo",
        "gpt-4-0613": "gpt-4o",
        "gpt-4-32k": "gpt-4o",
        "gpt-4-32k-0613": "gpt-4o",
        "gpt-4": "gpt-4o",
        "gpt-4-1106-preview": "gpt-4-turbo",
        "gpt-3.5-turbo-16k": "gpt-4o-mini",
        "gpt-3.5-turbo-0125": "gpt-3.5-turbo",
        "gpt-3.5-turbo-1106": "gpt-3.5-turbo"
    },
    anthropic: {
        "claude-3-sonnet-20240229": "claude-sonnet-4-20250514",
        "claude-3-opus-20240229": "claude-opus-4-20250514",
        "claude-3-haiku-20240307": "claude-3-5-haiku-20241022",
        "claude-2.1": "claude-sonnet-4-20250514",
        "claude-2.0": "claude-sonnet-4-20250514",
        "claude-instant-1.2": "claude-3-5-haiku-20241022"
    }
};

interface StaleRecord {
    table: "Agent" | "Network" | "AgentVersion";
    id: string;
    name: string;
    provider: string;
    currentModel: string;
    suggestedModel: string;
    reason: string;
}

function findBestMatch(
    provider: string,
    modelName: string,
    availableModels: ModelDefinition[]
): string | null {
    const resolved = resolveModelAlias(provider, modelName);
    if (availableModels.some((m) => m.id === resolved)) return resolved;

    const knownMapping = STALE_MODEL_MAP[provider]?.[modelName];
    if (knownMapping && availableModels.some((m) => m.id === knownMapping)) {
        return knownMapping;
    }

    const prefixMatch = availableModels.find(
        (m) => modelName.startsWith(m.id) || m.id.startsWith(modelName)
    );
    if (prefixMatch) return prefixMatch.id;

    const providerModels = availableModels.filter((m) => m.provider === provider);
    const flagship = providerModels.find((m) => m.category === "flagship");
    return flagship?.id || providerModels[0]?.id || null;
}

async function main() {
    console.log(`\n=== Stale Model Migration ${APPLY ? "(APPLY MODE)" : "(DRY RUN)"} ===\n`);

    console.log("Fetching live model lists from all providers...");
    const allModels = await getAllModels(null, true);
    console.log(`  Found ${allModels.length} models across all providers.\n`);

    const modelsByProvider = new Map<string, ModelDefinition[]>();
    for (const m of allModels) {
        const existing = modelsByProvider.get(m.provider) || [];
        existing.push(m);
        modelsByProvider.set(m.provider, existing);
    }

    const validModelIds = new Set<string>();
    for (const m of allModels) {
        validModelIds.add(m.id);
        for (const alias of m.aliases) validModelIds.add(alias);
    }

    const staleRecords: StaleRecord[] = [];

    // Scan agents
    const agents = await prisma.agent.findMany({
        select: { id: true, slug: true, name: true, modelProvider: true, modelName: true }
    });

    for (const agent of agents) {
        const resolved = resolveModelAlias(agent.modelProvider, agent.modelName);
        if (validModelIds.has(resolved) || validModelIds.has(agent.modelName)) continue;

        const providerModels = modelsByProvider.get(agent.modelProvider) || [];
        const suggestion = findBestMatch(agent.modelProvider, agent.modelName, providerModels);

        staleRecords.push({
            table: "Agent",
            id: agent.id,
            name: agent.slug || agent.name,
            provider: agent.modelProvider,
            currentModel: agent.modelName,
            suggestedModel: suggestion || "UNKNOWN",
            reason: suggestion ? "mapped" : "no-match"
        });
    }

    // Scan networks
    const networks = await prisma.network.findMany({
        select: { id: true, slug: true, name: true, modelProvider: true, modelName: true }
    });

    for (const network of networks) {
        const resolved = resolveModelAlias(network.modelProvider, network.modelName);
        if (validModelIds.has(resolved) || validModelIds.has(network.modelName)) continue;

        const providerModels = modelsByProvider.get(network.modelProvider) || [];
        const suggestion = findBestMatch(network.modelProvider, network.modelName, providerModels);

        staleRecords.push({
            table: "Network",
            id: network.id,
            name: network.slug || network.name,
            provider: network.modelProvider,
            currentModel: network.modelName,
            suggestedModel: suggestion || "UNKNOWN",
            reason: suggestion ? "mapped" : "no-match"
        });
    }

    // Scan agent versions
    const versions = await prisma.agentVersion.findMany({
        select: {
            id: true,
            agentId: true,
            version: true,
            modelProvider: true,
            modelName: true
        }
    });

    for (const version of versions) {
        if (!version.modelProvider || !version.modelName) continue;
        const resolved = resolveModelAlias(version.modelProvider, version.modelName);
        if (validModelIds.has(resolved) || validModelIds.has(version.modelName)) continue;

        const providerModels = modelsByProvider.get(version.modelProvider) || [];
        const suggestion = findBestMatch(version.modelProvider, version.modelName, providerModels);

        staleRecords.push({
            table: "AgentVersion",
            id: version.id,
            name: `v${version.version} of ${version.agentId}`,
            provider: version.modelProvider,
            currentModel: version.modelName,
            suggestedModel: suggestion || "UNKNOWN",
            reason: suggestion ? "mapped" : "no-match"
        });
    }

    // Report
    if (staleRecords.length === 0) {
        console.log("All agents, networks, and versions use valid models. Nothing to do.\n");
        await prisma.$disconnect();
        return;
    }

    const byTable = {
        Agent: staleRecords.filter((r) => r.table === "Agent"),
        Network: staleRecords.filter((r) => r.table === "Network"),
        AgentVersion: staleRecords.filter((r) => r.table === "AgentVersion")
    };

    for (const [table, records] of Object.entries(byTable)) {
        if (records.length === 0) {
            console.log(`${table}s: [OK] All use valid models.`);
            continue;
        }
        console.log(`${table}s:`);
        for (const r of records) {
            console.log(`  [STALE] "${r.name}" (id: ${r.id}): ${r.provider}/${r.currentModel}`);
            if (r.suggestedModel !== "UNKNOWN") {
                console.log(`         -> Suggested: ${r.provider}/${r.suggestedModel}`);
            } else {
                console.log(`         -> No valid replacement found (provider may have no models)`);
            }
        }
        console.log();
    }

    const mappable = staleRecords.filter((r) => r.suggestedModel !== "UNKNOWN");
    const unmappable = staleRecords.filter((r) => r.suggestedModel === "UNKNOWN");

    console.log(
        `Summary: ${staleRecords.length} stale model(s) found. ` +
            `${mappable.length} can be auto-mapped, ${unmappable.length} need manual review.`
    );

    if (!APPLY) {
        console.log("\nRun with --apply to execute the updates.\n");
        await prisma.$disconnect();
        return;
    }

    // Apply updates
    console.log("\nApplying updates...\n");
    let updated = 0;

    for (const record of mappable) {
        try {
            if (record.table === "Agent") {
                await prisma.agent.update({
                    where: { id: record.id },
                    data: { modelName: record.suggestedModel }
                });
            } else if (record.table === "Network") {
                await prisma.network.update({
                    where: { id: record.id },
                    data: { modelName: record.suggestedModel }
                });
            } else if (record.table === "AgentVersion") {
                await prisma.agentVersion.update({
                    where: { id: record.id },
                    data: { modelName: record.suggestedModel }
                });
            }
            console.log(
                `  [UPDATED] ${record.table} "${record.name}": ` +
                    `${record.currentModel} -> ${record.suggestedModel}`
            );
            updated++;
        } catch (err) {
            console.error(
                `  [ERROR] Failed to update ${record.table} "${record.name}":`,
                err instanceof Error ? err.message : err
            );
        }
    }

    console.log(`\nDone. Updated ${updated}/${mappable.length} records.\n`);
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
