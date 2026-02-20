---
name: MCP Config Tool
overview: Add a Mastra tool that lets agents read MCP config, preview impact, and apply updates with confirmation gating (default replace mode).
todos: []
isProject: false
---

# MCP Config Tool (Mastra)

## Goal

Create a Mastra tool that Cursor users can invoke to read MCP config, preview impact, and apply updates with explicit confirmation, using existing config import/export logic.

## Scope & Defaults

- Tool location: `@repo/agentc2` tool registry (per your selection)
- Default write mode: `replace`
- Impact gate: required confirmation when agents would be affected

## Implementation Plan

1. **Add the tool in `[packages/agentc2/src/tools/integration-import-tools.ts](packages/agentc2/src/tools/integration-import-tools.ts)**`

- Create a new `createTool` entry (e.g., `integration-mcp-config`) alongside `integrationImportMcpJsonTool`.
- Inputs:
    - `action`: `read | plan | apply` (default `read`)
    - `config` (object) and/or `rawText` (JSON string) for write/plan
    - `mode`: `replace | merge` (default `replace`)
    - `confirm`: boolean (required if impact exists)
    - `organizationId` / `userId` for org resolution
- Behavior:
    - `read`: call `exportMcpConfig()` and return `config` + pretty `configText`
    - `plan`: normalize config (from `rawText` or `config`), call `analyzeMcpConfigImpact()` and return impact
    - `apply`: run `analyzeMcpConfigImpact()`; if impact and `confirm !== true`, return `{ requiresConfirmation: true, impact }`; otherwise call `importMcpConfig()` and return the result
- Reuse existing helpers in this file for parsing JSON (e.g., `parseMcpServers`) and org resolution (`resolveOrganizationId`).

1. **Register and export the tool**

- Add the new tool export in `[packages/agentc2/src/tools/index.ts](packages/agentc2/src/tools/index.ts)` alongside the other integration tools.
- Import and register it in `[packages/agentc2/src/tools/registry.ts](packages/agentc2/src/tools/registry.ts)` with a new key (e.g., `integration-mcp-config`).

1. **Validate outputs**

- Ensure the tool’s output schema includes:
    - `success`, `action`, `config`/`configText` for reads
    - `impact`, `requiresConfirmation` for plans/unsafe applies
    - `result` (the import result) when apply succeeds

## Files to Change

- `[packages/agentc2/src/tools/integration-import-tools.ts](packages/agentc2/src/tools/integration-import-tools.ts)`
- `[packages/agentc2/src/tools/index.ts](packages/agentc2/src/tools/index.ts)`
- `[packages/agentc2/src/tools/registry.ts](packages/agentc2/src/tools/registry.ts)`

## Test Plan

- Run `bun run type-check`
- Run `bun run build`
