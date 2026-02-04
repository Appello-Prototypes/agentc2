# MCP Workflow + Network Tools

This guide covers invoking workflows and networks via the MCP gateway and the Cursor MCP server.

## Available Tools (MCP Gateway)

The MCP gateway (`/api/mcp`) exposes these tools:

- `workflow.execute` - Execute a workflow by slug/ID.
- `workflow.list-runs` - List workflow runs with filters.
- `workflow.get-run` - Fetch a workflow run with steps.
- `network.execute` - Execute a network by slug/ID.
- `network.list-runs` - List network runs with filters.
- `network.get-run` - Fetch a network run with steps.

Per-resource tools are also available:

- `workflow-{slug}` - Execute a specific workflow by slug.
- `network-{slug}` - Execute a specific network by slug.

## Example: Execute a Workflow

POST `/api/mcp`

```json
{
    "method": "tools/call",
    "tool": "workflow.execute",
    "params": {
        "workflowSlug": "sample-support-triage",
        "input": {
            "customerName": "Jamie",
            "issue": "Unable to reset password",
            "priority": "medium",
            "channel": "email"
        },
        "environment": "production",
        "triggerType": "api"
    }
}
```

Response:

```json
{
  "success": true,
  "result": {
    "runId": "cuid...",
    "status": "success",
    "output": { "...": "..." },
    "run": { "id": "cuid...", "steps": [ ... ] }
  }
}
```

## Example: List Network Runs

```json
{
    "method": "tools/call",
    "tool": "network.list-runs",
    "params": {
        "networkSlug": "sample-ops-router",
        "status": "COMPLETED",
        "environment": "production",
        "from": "2026-02-01T00:00:00.000Z",
        "to": "2026-02-04T00:00:00.000Z"
    }
}
```

## Cursor MCP Server Notes

The `scripts/mcp-server` adapter sanitizes tool names for Cursor:

- `workflow.execute` becomes `workflow_execute`
- `workflow-{slug}` becomes `workflow_{slug}`
- `network.list-runs` becomes `network_list_runs`
- `network-{slug}` becomes `network_{slug}`

Use the sanitized names inside Cursor. The adapter maps them back to the original MCP tool names automatically.
