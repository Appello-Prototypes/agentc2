# AgentC2 — Service Level Agreement (SLA) Targets

Defined as part of the Production Readiness Plan (Phase 0).
These targets drive architecture decisions across all subsequent phases.

---

## Availability

| Metric                       | Target         | Notes                            |
| ---------------------------- | -------------- | -------------------------------- |
| Platform uptime              | 99.9%          | ~8.7 hours downtime/year maximum |
| Scheduled maintenance window | < 30 min/month | Zero-downtime deploys preferred  |

## API Latency (excluding AI inference)

| Metric | Target  |
| ------ | ------- |
| P50    | < 200ms |
| P95    | < 1s    |
| P99    | < 3s    |

## AI Chat Latency

| Metric                    | Target                  |
| ------------------------- | ----------------------- |
| Time-to-first-token (P50) | < 1s                    |
| Time-to-first-token (P95) | < 2s                    |
| Total response time (P95) | < 30s (model-dependent) |

## Disaster Recovery

| Metric                         | Target                     |
| ------------------------------ | -------------------------- |
| RTO (Recovery Time Objective)  | < 1 hour                   |
| RPO (Recovery Point Objective) | < 15 minutes               |
| Backup frequency               | Continuous (Supabase PITR) |
| DR test frequency              | Quarterly                  |

## Deployment

| Metric               | Target                          |
| -------------------- | ------------------------------- |
| Deployment frequency | Multiple times per day          |
| Deployment strategy  | Zero-downtime (rolling restart) |
| Rollback time        | < 5 minutes                     |

## Incident Response

| Severity            | Response Time | Resolution Time     |
| ------------------- | ------------- | ------------------- |
| SEV1 (service down) | < 15 minutes  | < 30 minutes (MTTR) |
| SEV2 (degraded)     | < 1 hour      | < 4 hours           |
| SEV3 (minor)        | < 4 hours     | Next business day   |

## Data Subject Requests (GDPR/CCPA)

| Metric           | Target                   |
| ---------------- | ------------------------ |
| Acknowledgment   | < 3 business days        |
| Completion       | < 30 calendar days       |
| Escalation alert | At 20 days if incomplete |

## Rate Limits (per user unless noted)

| Endpoint                     | Limit         |
| ---------------------------- | ------------- |
| Auth endpoints               | 20 / 15 min   |
| Chat endpoints               | 30 / min      |
| Agent invoke                 | 20 / min      |
| File uploads                 | 10 / min      |
| Webhook ingress (per source) | 100 / min     |
| SSE connections (per user)   | 5 concurrent  |
| SSE connections (per org)    | 50 concurrent |

---

_Last updated: 2026-02-21_
_Owner: Engineering_
