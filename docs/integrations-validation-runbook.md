# Integrations Validation Runbook

Use this checklist to validate integrations, triggers, and approval workflows.

## Build + Quality

1. `bun run type-check`
2. `bun run lint`
3. `bun run format`
4. `bun run build`

## Provider Catalog

- Visit `/mcp` and confirm provider cards render.
- Open a provider detail page and verify connection statuses.
- Run a connection test and verify the status updates.

## Webhook Triggers

- Create a webhook connection at `/mcp/webhooks`.
- POST a payload to the generated webhook URL.
- Confirm a `TriggerEvent` record is created and an agent run is queued.

## Gmail Pipeline

- Connect Gmail via `/mcp/gmail`.
- Confirm Gmail webhook events create `EmailThread` + `EmailMessage`.
- Verify follow-up action items appear for stale inbound threads.
- Trigger an agent run that generates a draft and confirm an approval request is created.

## Slack Approvals

- Verify approval requests send Slack DMs.
- React with ✅ and ❌ to confirm approval status updates.
- Confirm `CrmAuditLog` entries for requested/approved/rejected.

## HubSpot + Fathom Webhooks

- POST sample events to `/api/integrations/hubspot/webhook`.
- POST sample transcripts to `/api/integrations/fathom/webhook`.
- Validate `TriggerEvent`, `CrmAuditLog`, and storage tables.
