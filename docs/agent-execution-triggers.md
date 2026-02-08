# Unified Agent Execution Triggers

This document describes the unified trigger model for agent execution. It consolidates schedules and triggers into a single configuration surface while keeping existing storage tables intact.

## Trigger Types

- `scheduled` - Cron-based execution (stored in `AgentSchedule`)
- `webhook` - HTTP webhook endpoint
- `event` - Internal or external event name
- `mcp` - Agent exposed as an MCP tool
- `api` - Programmatic invocation via execution trigger endpoint
- `manual` - On-demand operator execution
- `test` - Test-only execution path

## Unified Trigger Shape

Each unified trigger is returned with:

- `id` - Unified ID (`schedule:{id}` or `trigger:{id}`)
- `type` - One of the trigger types above
- `isActive` - Enable/disable flag
- `config` - Type-specific configuration
- `inputDefaults` - Default input/context/maxSteps/environment
- `filter` / `inputMapping` - Trigger payload handling
- `stats` - Last/next run and counts
- `lastRun` - Latest run status for observability

## REST API

Base path: `/api/agents/{id}/execution-triggers`

- `GET /` - List unified triggers
- `POST /` - Create unified trigger
- `GET /{triggerId}` - Get a unified trigger
- `PATCH /{triggerId}` - Update a unified trigger
- `DELETE /{triggerId}` - Delete a unified trigger
- `POST /{triggerId}/test` - Dry-run (no execution)
- `POST /{triggerId}/execute` - Execute trigger (manual run)

## MCP Toolset

The MCP gateway exposes these tools:

- `agent_trigger_unified_list`
- `agent_trigger_unified_get`
- `agent_trigger_unified_create`
- `agent_trigger_unified_update`
- `agent_trigger_unified_delete`
- `agent_trigger_unified_enable`
- `agent_trigger_unified_disable`
- `agent_trigger_test`
- `agent_trigger_execute`

Use these tools from Cursor or any MCP-aware client to manage and run triggers as code.

## Integrations Hub

The Integrations Hub exposes provider catalogs and connection management:

- `GET /api/integrations/providers` - List providers, status, and connections
- `GET /api/integrations/connections` - List connections (filter by `providerKey`)
- `POST /api/integrations/connections` - Create connections for API-key based providers
- `POST /api/integrations/webhooks` - Create webhook connections wired to unified triggers

Connections map to runtime MCP servers and to the Tier 1 ingestion pipelines.

## Tier 1 Ingestion Pipelines

Trigger payloads from Gmail, Slack, HubSpot, and Fathom are normalized and stored:

- `EmailThread` + `EmailMessage` for Gmail
- `ChatMessage` for Slack
- `MeetingTranscript` for Fathom
- `CrmAuditLog` for inbound CRM/webhook activity
- `ApprovalRequest` for approval-first workflows

Gmail trigger filters support keyword matching, CC inclusion, attachment flags, and
business-hours checks via `matchesTriggerFilter`.

## Approval Flow

When agents require approval, trigger events create `ApprovalRequest` records that
are routed to Slack for review. Slack reactions update approvals and optionally resume
human-approval workflows. Approvals are logged in `CrmAuditLog` for auditability.
