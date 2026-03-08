#!/usr/bin/env bun
import { prisma } from "../packages/database/src/index";
import { validateManifest, isValidManifest } from "../packages/agentc2/src/playbooks/manifest";
import type { PlaybookManifest } from "../packages/agentc2/src/playbooks/types";

const dryRun = !process.argv.includes("--apply");

interface RepairResult {
    versionId: string;
    playbookSlug: string;
    version: number;
    action: "inferred" | "failed" | "skipped";
    inferredEntryPoint?: { type: string; slug: string };
    error?: string;
}

async function main() {
    console.log(`\n🔧 Playbook Manifest Repair ${dryRun ? "(DRY RUN)" : "(APPLYING)"}\n`);

    const versions = await prisma.playbookVersion.findMany({
        include: { playbook: { select: { slug: true, name: true } } }
    });

    const results: RepairResult[] = [];
    let repairedCount = 0;
    let failedCount = 0;

    for (const v of versions) {
        const manifest = v.manifest as any;

        if (isValidManifest(manifest)) {
            continue;
        }

        const result: RepairResult = {
            versionId: v.id,
            playbookSlug: v.playbook.slug,
            version: v.version,
            action: "failed"
        };

        const agents = manifest.agents ?? [];
        const networks = manifest.networks ?? [];
        const workflows = manifest.workflows ?? [];

        let inferredEntryPoint: { type: string; slug: string } | null = null;

        if (agents.length === 1 && networks.length === 0 && workflows.length === 0) {
            inferredEntryPoint = { type: "agent", slug: agents[0].slug };
        } else if (networks.length === 1 && agents.length === 0 && workflows.length === 0) {
            inferredEntryPoint = { type: "network", slug: networks[0].slug };
        } else if (workflows.length === 1 && agents.length === 0 && networks.length === 0) {
            inferredEntryPoint = { type: "workflow", slug: workflows[0].slug };
        } else if (agents.length > 0) {
            inferredEntryPoint = { type: "agent", slug: agents[0].slug };
        } else if (networks.length > 0) {
            inferredEntryPoint = { type: "network", slug: networks[0].slug };
        } else if (workflows.length > 0) {
            inferredEntryPoint = { type: "workflow", slug: workflows[0].slug };
        }

        if (inferredEntryPoint) {
            const repairedManifest = { ...manifest, entryPoint: inferredEntryPoint };

            try {
                validateManifest(repairedManifest);
                result.action = "inferred";
                result.inferredEntryPoint = inferredEntryPoint;

                if (!dryRun) {
                    await prisma.playbookVersion.update({
                        where: { id: v.id },
                        data: { manifest: repairedManifest as any }
                    });
                    repairedCount++;
                }
            } catch (error) {
                result.action = "failed";
                result.error = error instanceof Error ? error.message : "Validation failed";
                failedCount++;
            }
        } else {
            result.action = "failed";
            result.error = "Cannot infer entryPoint - no components found";
            failedCount++;
        }

        results.push(result);
    }

    console.log(`Total versions scanned: ${versions.length}`);
    console.log(`Valid manifests: ${versions.length - results.length}`);
    console.log(`Invalid manifests found: ${results.length}`);
    console.log(`Repaired: ${repairedCount}`);
    console.log(`Failed to repair: ${failedCount}\n`);

    if (results.length > 0) {
        console.log("Results:\n");
        for (const r of results) {
            const icon = r.action === "inferred" ? "✅" : "❌";
            console.log(`${icon} ${r.playbookSlug} v${r.version}`);
            if (r.inferredEntryPoint) {
                console.log(
                    `   Inferred: ${r.inferredEntryPoint.type}/${r.inferredEntryPoint.slug}`
                );
            }
            if (r.error) {
                console.log(`   Error: ${r.error}`);
            }
        }
    }

    if (dryRun && results.length > 0) {
        console.log("\n📋 DRY RUN - No changes applied.");
        console.log("   Run with --apply to execute repairs.\n");
    } else if (!dryRun && repairedCount > 0) {
        console.log(`\n✅ Repaired ${repairedCount} manifests.\n`);
    }

    if (failedCount > 0) {
        console.log(`\n⚠️  ${failedCount} manifests could not be auto-repaired.`);
        console.log("   Manual review required.\n");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Repair failed:", err);
    process.exit(1);
});
