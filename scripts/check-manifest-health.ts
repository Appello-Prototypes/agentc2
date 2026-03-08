#!/usr/bin/env bun
/**
 * Health check script: Identify PlaybookVersions with invalid manifests
 * 
 * Checks for:
 * - Missing entryPoint field
 * - Null entryPoint value
 * - Invalid entryPoint structure
 * 
 * Usage:
 *   bun run scripts/check-manifest-health.ts
 */

import { prisma } from "../packages/database/src/index";
import { validateManifest } from "../packages/agentc2/src/playbooks/manifest";

interface IssueReport {
    versionId: string;
    playbookId: string;
    playbookSlug: string;
    playbookName: string;
    version: number;
    issue: string;
    severity: "critical" | "high" | "medium";
}

async function main() {
    console.log("\n🔍 Checking PlaybookVersion manifest health...\n");

    const versions = await prisma.playbookVersion.findMany({
        include: {
            playbook: {
                select: { id: true, slug: true, name: true, status: true }
            }
        }
    });

    const issues: IssueReport[] = [];
    let validCount = 0;

    for (const v of versions) {
        const manifest = v.manifest as Record<string, unknown>;

        // Check 1: Missing entryPoint key
        if (!("entryPoint" in manifest)) {
            issues.push({
                versionId: v.id,
                playbookId: v.playbookId,
                playbookSlug: v.playbook.slug,
                playbookName: v.playbook.name,
                version: v.version,
                issue: "Missing entryPoint field entirely",
                severity: "critical"
            });
            continue;
        }

        // Check 2: Null or undefined entryPoint
        if (manifest.entryPoint === null || manifest.entryPoint === undefined) {
            issues.push({
                versionId: v.id,
                playbookId: v.playbookId,
                playbookSlug: v.playbook.slug,
                playbookName: v.playbook.name,
                version: v.version,
                issue: "entryPoint is null or undefined",
                severity: "critical"
            });
            continue;
        }

        // Check 3: Invalid structure (missing type or slug)
        const ep = manifest.entryPoint as Record<string, unknown>;
        if (!ep.type || !ep.slug) {
            issues.push({
                versionId: v.id,
                playbookId: v.playbookId,
                playbookSlug: v.playbook.slug,
                playbookName: v.playbook.name,
                version: v.version,
                issue: `entryPoint missing fields - type: ${ep.type ?? "missing"}, slug: ${ep.slug ?? "missing"}`,
                severity: "high"
            });
            continue;
        }

        // Check 4: Full schema validation
        try {
            validateManifest(manifest);
            validCount++;
        } catch (error) {
            issues.push({
                versionId: v.id,
                playbookId: v.playbookId,
                playbookSlug: v.playbook.slug,
                playbookName: v.playbook.name,
                version: v.version,
                issue: `Schema validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                severity: "high"
            });
        }
    }

    console.log(`Total PlaybookVersions: ${versions.length}`);
    console.log(`Valid manifests: ${validCount}`);
    console.log(`Invalid manifests: ${issues.length}\n`);

    if (issues.length > 0) {
        console.log("❌ Issues found:\n");

        const bySeverity = {
            critical: issues.filter((i) => i.severity === "critical"),
            high: issues.filter((i) => i.severity === "high"),
            medium: issues.filter((i) => i.severity === "medium")
        };

        if (bySeverity.critical.length > 0) {
            console.log(`\n🔴 CRITICAL (${bySeverity.critical.length}):`);
            for (const issue of bySeverity.critical) {
                console.log(
                    `  - ${issue.playbookName} (${issue.playbookSlug}) v${issue.version}: ${issue.issue}`
                );
                console.log(`    Version ID: ${issue.versionId}`);
            }
        }

        if (bySeverity.high.length > 0) {
            console.log(`\n🟠 HIGH (${bySeverity.high.length}):`);
            for (const issue of bySeverity.high) {
                console.log(
                    `  - ${issue.playbookName} (${issue.playbookSlug}) v${issue.version}: ${issue.issue}`
                );
            }
        }

        if (bySeverity.medium.length > 0) {
            console.log(`\n🟡 MEDIUM (${bySeverity.medium.length}):`);
            for (const issue of bySeverity.medium) {
                console.log(
                    `  - ${issue.playbookName} (${issue.playbookSlug}) v${issue.version}: ${issue.issue}`
                );
            }
        }

        console.log(
            `\n⚠️  These playbooks will fail deployment until manifests are repaired.`
        );
        console.log(`   Run scripts/repair-playbook-manifests.ts (to be created) to fix.\n`);

        process.exit(1);
    } else {
        console.log("✅ All manifests are valid!\n");
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Health check failed:", err);
    process.exit(1);
});
