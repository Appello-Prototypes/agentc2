#!/usr/bin/env bun
/**
 * Test all MCP servers by attempting to connect and list tools.
 * Usage: bun run scripts/test-mcp-servers.ts
 */

import { testMcpServer, MCP_SERVER_CONFIGS } from "../packages/agentc2/src/mcp/index";

const TIMEOUT_MS = 30_000;
const ATLAS_TIMEOUT_MS = 60_000;

async function main() {
    const serverKeys = MCP_SERVER_CONFIGS.map((s) => s.id);

    console.log(`\nTesting ${serverKeys.length} MCP servers...\n`);
    console.log("Servers:", serverKeys.join(", "), "\n");

    const results = await Promise.allSettled(
        serverKeys.map(async (serverKey) => {
            const timeoutMs = serverKey === "atlas" ? ATLAS_TIMEOUT_MS : TIMEOUT_MS;
            const result = await testMcpServer({
                serverId: serverKey,
                organizationId: null,
                userId: null,
                allowEnvFallback: true,
                timeoutMs
            });
            return { serverKey, result };
        })
    );

    let passed = 0;
    let failed = 0;

    for (const settled of results) {
        if (settled.status === "fulfilled") {
            const { serverKey, result } = settled.value;
            const config = MCP_SERVER_CONFIGS.find((s) => s.id === serverKey);
            const name = config?.name ?? serverKey;

            if (result.success) {
                passed++;
                console.log(
                    `✅ ${name.padEnd(20)} ${result.toolCount} tools (${result.totalMs}ms)  [${result.sampleTools?.join(", ")}]`
                );
            } else {
                failed++;
                const lastPhase = result.phases[result.phases.length - 1];
                console.log(
                    `❌ ${name.padEnd(20)} FAILED (${result.totalMs}ms)  ${lastPhase?.detail ?? "Unknown error"}`
                );
            }
        } else {
            failed++;
            const idx = results.indexOf(settled);
            const key = serverKeys[idx]!;
            console.log(
                `❌ ${key.padEnd(20)} EXCEPTION: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`
            );
        }
    }

    console.log(
        `\n--- Summary: ${passed} passed, ${failed} failed out of ${serverKeys.length} ---\n`
    );

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(2);
});
