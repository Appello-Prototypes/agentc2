# Data Retention Policy

## Objectives

- Retain only what is needed for operational and legal purposes.
- Support privacy-by-design and PIPEDA minimization principles.

## Retention Schedule

| Dataset                             | Retention                                             | Rationale                                     |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Agent run traces and tool call logs | 180 days (default)                                    | Debugging, incident response, product quality |
| Security audit logs                 | 2 years                                               | Compliance and forensic requirements          |
| Support tickets and comments        | 2 years after closure                                 | Customer support history                      |
| Session records                     | 30 days from expiry                                   | Security and abuse investigation              |
| Integration credential metadata     | While active + 90 days                                | Operational continuity and rollback           |
| Deactivated credentials             | Immediate key invalidation; metadata retained 90 days | Auditability                                  |

## Disposal Process

1. Scheduled purge jobs identify expired records.
2. Hard delete for operational data where no legal hold exists.
3. Legal hold exceptions are tagged and excluded.
4. Purge activity is logged with dataset and row counts.

## Exceptions

- Legal/regulatory obligations override standard retention.
- Incident investigations may temporarily extend retention.
