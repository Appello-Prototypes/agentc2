# Add New MCP Server Integration

**Trigger**: User asks to add a new MCP server, integrate a new external tool, or connect a new service.

**Description**: Adds a new MCP server integration to the AgentC2 platform.

## Instructions

### Step 1: Understand the MCP server

Get from the user:

- **Server name**: What service to integrate (e.g., "Linear", "Notion")
- **Transport type**: stdio, SSE, or Streamable HTTP
- **Package/binary**: npm package or local binary path
- **Authentication**: What API keys or tokens are needed

### Step 2: Read the existing MCP client configuration

```
Read packages/agentc2/src/mcp/client.ts
```

Understand the current MCP server setup pattern.

### Step 3: Check for existing MCP patterns

```
Grep pattern="MCPClient\|mcpClient\|MCP" path=packages/agentc2/src
```

Understand how MCP servers are initialized and connected.

### Step 4: Add environment variables

Add required API keys/tokens to `.env` (and document in CLAUDE.md):

```bash
NEW_SERVICE_API_KEY="..."
```

### Step 5: Configure the MCP server

Add the new server to the MCP client configuration following the existing pattern. Typically:

```typescript
{
    "server-name": {
        command: "npx",
        args: ["-y", "@service/mcp-server"],
        env: {
            API_KEY: process.env.NEW_SERVICE_API_KEY,
        },
    },
}
```

For SSE/HTTP transports:

```typescript
{
    "server-name": {
        url: new URL(process.env.SERVICE_SSE_URL!),
    },
}
```

**Note on SSE**: n8n-style servers only support SSE. Use `mcp-remote` as a bridge if the MCP client doesn't support SSE natively:

```typescript
{
    command: "npx",
    args: ["-y", "mcp-remote", sseUrl],
}
```

### Step 6: Add to Claude Code CLI (if needed)

For adding the MCP server to Claude Code directly:

```bash
claude mcp add-json -s user "ServerName" '{"command":"npx","args":["-y","@service/mcp-server"],"env":{"API_KEY":"..."}}'
```

Remember: server names cannot contain spaces.

### Step 7: Test the connection

- List tools: Verify the MCP server's tools appear
- Execute a simple read-only tool to confirm connectivity
- Check for auth errors

### Step 8: Type-check and build

```bash
bun run type-check && bun run build
```

### Step 9: Document

Update CLAUDE.md with:

- New env vars in the environment variables section
- New server in the MCP Server Integration Details table

## Common Issues

- **SSE connections failing**: Use `mcp-remote` as a bridge (see ATLAS/n8n pattern in MEMORY.md)
- **Server name with spaces**: Replace with hyphens
- **Auth errors**: Check env var is set and not empty
- **Timeout**: Some MCP servers are slow to start — increase timeout if needed
