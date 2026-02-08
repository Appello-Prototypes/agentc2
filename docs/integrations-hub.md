# Integrations Hub

The Integrations Hub is the control plane for MCP providers, credentials, and webhooks.
It surfaces provider metadata and connection health while routing inbound events into the
unified trigger pipeline.

## UI Entry Points

- `/mcp` - Provider catalog and connection status overview
- `/mcp/providers/[providerKey]` - Provider detail view (connections, actions/triggers, testing)
- `/mcp/webhooks` - Create webhook connections wired to agent triggers
- `/mcp/setup-chat` - MCP setup chat for importing and testing MCP JSON
- `/mcp/setup` - Legacy setup/debug tooling
- `/mcp/gmail` - Gmail OAuth setup and integration management

## Core APIs

Provider catalog and connections:

- `GET /api/integrations/providers`
- `GET /api/integrations/connections?providerKey=hubspot`
- `POST /api/integrations/connections`
- `POST /api/integrations/connections/[connectionId]/test`
- `GET /api/integrations/connections/[connectionId]/actions`

Webhook connections:

- `POST /api/integrations/webhooks`
- `POST /api/webhooks/{path}` (inbound trigger endpoint)

## MCP JSON Import (Chat)

The MCP setup chat accepts raw `mcp.json` (or unstructured text) and automatically:

1. Parses MCP servers and matches them to known providers (via `importHints`)
2. Creates or updates `IntegrationProvider` + `IntegrationConnection` records
3. Runs tests and summarizes pass/fail per MCP

The chat lives at `/mcp/setup-chat` and uses the `mcp-setup-agent` SYSTEM agent.

Example input:

```json
{
    "mcpServers": {
        "Slack": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-slack"],
            "env": {
                "SLACK_BOT_TOKEN": "xoxb-...",
                "SLACK_TEAM_ID": "T123..."
            }
        }
    }
}
```

## Tier 1 Webhooks

Dedicated ingestion endpoints for Tier 1 systems:

- `POST /api/integrations/hubspot/webhook?connectionId=...`
- `POST /api/integrations/fathom/webhook?connectionId=...`

These endpoints normalize payloads into `TriggerEvent`, `CrmAuditLog`,
and downstream storage tables, then fan out to `agent/trigger.fire` when
an `agentTriggerId` is linked.

## Approval Flow

When agents require approval, completed runs create `ApprovalRequest` records with
Slack DMs for review. Slack reactions (`:white_check_mark:` or `:x:`) update the
approval status and optionally resume the human-approval workflow.
