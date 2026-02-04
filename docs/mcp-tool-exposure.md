# MCP Tool Exposure for Workflows and Networks

## Overview

Active workflows and networks are exposed as MCP tools via the gateway endpoint at `/api/mcp`.
Tools are discovered dynamically from the database, so new workflows and networks appear without manual registration.

## Tool Naming

- Workflows: `workflow-<slug>`
- Networks: `network-<slug>`
- CRUD management tools: `agent-*`, `workflow-*`, `network-*` (hyphen-only, no dots)

## CRUD Management Tools

The MCP gateway exposes full lifecycle CRUD tools for agents, workflows, and networks:

- Agents: `agent-create`, `agent-read`, `agent-update`, `agent-delete`
- Workflows: `workflow-create`, `workflow-read`, `workflow-update`, `workflow-delete`
- Networks: `network-create`, `network-read`, `network-update`, `network-delete`

These tools surface all configuration primitives supported by the current system. The canonical schema definitions live in `docs/mcp-crud-tools-spec.json`.

## Tool Schemas

- Workflow tools use `Workflow.inputSchemaJson` and `Workflow.outputSchemaJson` when available.
- Network tools use a default schema that accepts `message` (required) and optional execution metadata.

## Invocation Mapping

- `workflow-<slug>` → `POST /api/workflows/<slug>/execute`
- `network-<slug>` → `POST /api/networks/<slug>/execute`

## Gateway Response

`GET /api/mcp` returns tool definitions including `inputSchema` and `outputSchema` for use by MCP clients such as Cursor.
