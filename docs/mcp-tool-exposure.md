# MCP Tool Exposure for Workflows and Networks

## Overview

Active workflows and networks are exposed as MCP tools via the gateway endpoint at `/api/mcp`.
Tools are discovered dynamically from the database, so new workflows and networks appear without manual registration.

## Tool Naming

- Workflows: `workflow-<slug>`
- Networks: `network-<slug>`

## Tool Schemas

- Workflow tools use `Workflow.inputSchemaJson` and `Workflow.outputSchemaJson` when available.
- Network tools use a default schema that accepts `message` (required) and optional execution metadata.

## Invocation Mapping

- `workflow-<slug>` → `POST /api/workflows/<slug>/execute`
- `network-<slug>` → `POST /api/networks/<slug>/execute`

## Gateway Response

`GET /api/mcp` returns tool definitions including `inputSchema` and `outputSchema` for use by MCP clients such as Cursor.
