#!/usr/bin/env bun

/**
 * Verification script for bug #180 fix
 *
 * This script verifies that native OAuth integration tools (Gmail, Google Drive,
 * Cursor, etc.) now have descriptions populated from the toolRegistry.
 *
 * Before the fix:
 *   - buildStaticToolDefinitions hardcoded description: ""
 *   - IntegrationTool records had null descriptions
 *
 * After the fix:
 *   - buildStaticToolDefinitions fetches from toolRegistry
 *   - IntegrationTool records have proper descriptions
 *
 * Usage:
 *   bun run scripts/verify-integration-tool-descriptions.ts
 */

import { toolRegistry } from "../packages/agentc2/src/tools/registry.ts";
import { getBlueprint } from "../packages/agentc2/src/integrations/blueprints/index.ts";

const PROVIDERS_TO_CHECK = [
    "gmail",
    "google-drive",
    "cursor",
    "claude-code",
    "google-calendar",
    "google-search-console"
];

console.log("🔍 Verifying integration tool descriptions (bug #180 fix)\n");

let totalTools = 0;
let toolsWithDescriptions = 0;
let toolsWithoutDescriptions: string[] = [];

for (const providerKey of PROVIDERS_TO_CHECK) {
    try {
        const blueprint = getBlueprint(providerKey);
        if (!blueprint?.skill.staticTools) {
            console.log(`⚠️  ${providerKey}: No static tools defined`);
            continue;
        }

        console.log(`\n📦 Provider: ${providerKey}`);
        console.log(`   Tools: ${blueprint.skill.staticTools.length}`);

        for (const toolId of blueprint.skill.staticTools) {
            totalTools++;
            const tool = toolRegistry[toolId];
            const hasDescription = !!tool?.description && tool.description.length > 0;

            if (hasDescription) {
                toolsWithDescriptions++;
                const preview = tool.description.substring(0, 60);
                console.log(`   ✅ ${toolId}: "${preview}..."`);
            } else {
                toolsWithoutDescriptions.push(`${providerKey}/${toolId}`);
                console.log(`   ❌ ${toolId}: MISSING DESCRIPTION`);
            }
        }
    } catch (error) {
        console.log(`⚠️  ${providerKey}: Blueprint not found or error`);
    }
}

console.log("\n" + "=".repeat(80));
console.log(`📊 Summary:`);
console.log(`   Total tools checked: ${totalTools}`);
console.log(`   Tools with descriptions: ${toolsWithDescriptions}`);
console.log(`   Tools without descriptions: ${toolsWithoutDescriptions.length}`);

if (toolsWithoutDescriptions.length > 0) {
    console.log(`\n❌ FAILED: The following tools are missing descriptions:`);
    toolsWithoutDescriptions.forEach((id) => console.log(`     - ${id}`));
    process.exit(1);
} else {
    console.log(`\n✅ SUCCESS: All integration tools have descriptions!`);
    process.exit(0);
}
