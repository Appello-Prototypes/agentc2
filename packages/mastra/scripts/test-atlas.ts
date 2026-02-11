/**
 * One-off test of ATLAS MCP (supergateway + n8n SSE).
 * Run from repo root: bun run packages/mastra/scripts/test-atlas.ts
 * Or: cd packages/mastra && bun run scripts/test-atlas.ts
 */
import { MCPClient } from "@mastra/mcp"

const atlasDefinition = {
    command: "npx",
    args: [
        "-y",
        "supergateway",
        "--sse",
        "https://useappello.app.n8n.cloud/mcp/dfbad0dd-acf3-4796-ab7a-87fdd03f51a8/sse",
        "--timeout",
        "600000",
        "--keep-alive-timeout",
        "600000",
        "--retry-after-disconnect",
        "--reconnect-interval",
        "1000"
    ]
}

const client = new MCPClient({
    id: "atlas-test",
    servers: { atlas: atlasDefinition },
    timeout: 60000
})

console.log("Connecting to ATLAS (n8n SSE)...")
const start = Date.now()
try {
    const tools = await client.listTools()
    const ms = Date.now() - start
    const names = Object.keys(tools)
    console.log(`OK in ${ms}ms — ${names.length} tool(s):`)
    names.slice(0, 20).forEach((n) => console.log("  -", n))
    if (names.length > 20) console.log(`  ... and ${names.length - 20} more`)
    await client.disconnect()
    process.exit(0)
} catch (err) {
    console.error("Error after", Date.now() - start, "ms:", (err as Error).message)
    process.exit(1)
}
