# Data Inventory (PIPEDA)

## Data Classes

| Data Class              | Examples                             | Purpose                            | Legal Basis                          | Storage                                       |
| ----------------------- | ------------------------------------ | ---------------------------------- | ------------------------------------ | --------------------------------------------- |
| Account identity        | Name, email, membership role         | Authentication and tenancy         | Contractual necessity                | `user`, `membership`                          |
| Session/auth data       | Session tokens, auth metadata        | Session management and security    | Legitimate interest                  | `session`, auth cookies                       |
| Agent runtime data      | Prompts, outputs, traces, tool calls | Service delivery and observability | Contractual necessity                | `agent_run`, `agent_trace`, `agent_tool_call` |
| Integration credentials | OAuth tokens, API keys               | Third-party integrations           | User consent + contractual necessity | Encrypted JSON fields                         |
| Support data            | Tickets, comments                    | Customer support                   | Contractual necessity                | Support tables                                |
| Analytics/metrics       | Aggregated usage and cost metrics    | Reliability and billing insights   | Legitimate interest                  | Metric tables                                 |

## Sensitive Data Handling

- OAuth credentials are encrypted at rest.
- API keys are masked in read APIs; full values returned only on creation.
- Guardrails and moderation checks are applied on agent IO pathways.
- Access to org-level data is membership-scoped and role-checked.

## Data Flow Summary

1. User authenticates and obtains session.
2. User invokes app features; requests are scoped by org/workspace.
3. Runtime events and operational telemetry are stored for observability.
4. Integrations execute with encrypted credentials.
5. Retention policies purge stale operational records.

## Cross-Border Considerations

- Third-party services may process data outside Canada.
- Vendor data processing terms must be maintained and reviewed.
- Data residency controls should be documented per integration.
