# SOC 2 Type I Evidence Collection

## Trust Service Criteria Coverage

### CC1: Control Environment

| Control                  | Evidence                                | Status  |
| ------------------------ | --------------------------------------- | ------- |
| Organizational structure | Team roles documented in plan Phase 0.5 | Ready   |
| Code of conduct          | Employee handbook (requires creation)   | Pending |
| Board oversight          | Documented governance framework         | Ready   |

### CC2: Communication & Information

| Control                | Evidence                                  | Status  |
| ---------------------- | ----------------------------------------- | ------- |
| Internal communication | Slack channels, incident response runbook | Ready   |
| External communication | Status page (Betterstack), privacy policy | Ready   |
| Security awareness     | Training program (requires creation)      | Pending |

### CC3: Risk Assessment

| Control             | Evidence                                          | Status |
| ------------------- | ------------------------------------------------- | ------ |
| Risk identification | AI Governance Framework document                  | Ready  |
| Risk mitigation     | Graceful degradation strategies, circuit breakers | Ready  |
| Ongoing monitoring  | Sentry, Prometheus metrics, health checks         | Ready  |

### CC4: Monitoring Activities

| Control               | Evidence                                      | Status |
| --------------------- | --------------------------------------------- | ------ |
| Continuous monitoring | Health checks (liveness, readiness, detailed) | Ready  |
| Anomaly detection     | Sentry error tracking, Prometheus alerting    | Ready  |
| Log review            | Structured pino logging, log aggregation      | Ready  |

### CC5: Control Activities

| Control               | Evidence                                      | Status |
| --------------------- | --------------------------------------------- | ------ |
| Access controls       | Better Auth, role-based access, org isolation | Ready  |
| Change management     | GitHub PR workflow, CI/CD pipeline            | Ready  |
| Segregation of duties | Role-based permissions (owner/admin/member)   | Ready  |

### CC6: Logical & Physical Access

| Control               | Evidence                                    | Status |
| --------------------- | ------------------------------------------- | ------ |
| Authentication        | Better Auth session-based, OAuth, API keys  | Ready  |
| Authorization         | Per-route auth checks, tenant isolation     | Ready  |
| Encryption in transit | TLS 1.3 via Caddy, Cloudflare               | Ready  |
| Encryption at rest    | Supabase (default), AES-256-GCM credentials | Ready  |
| SSH key management    | Key-based SSH only, no password auth        | Ready  |

### CC7: System Operations

| Control                  | Evidence                                 | Status |
| ------------------------ | ---------------------------------------- | ------ |
| Incident response        | Incident Response Runbook                | Ready  |
| Backup & recovery        | Supabase PITR, DR Runbook                | Ready  |
| Vulnerability management | Security gates CI, dependency scanning   | Ready  |
| Change management        | CI/CD with tests, type-check, lint gates | Ready  |

### CC8: Change Management

| Control               | Evidence                            | Status |
| --------------------- | ----------------------------------- | ------ |
| Change authorization  | PR review required                  | Ready  |
| Testing before deploy | CI pipeline: type-check, lint, test | Ready  |
| Rollback capability   | PM2 reload, Terraform IaC           | Ready  |

### CC9: Risk Mitigation

| Control           | Evidence                                         | Status  |
| ----------------- | ------------------------------------------------ | ------- |
| Vendor management | Sub-processor registry in DATA-RESIDENCY.md      | Ready   |
| Insurance         | Cyber liability insurance (requires procurement) | Pending |

## Audit Logging Coverage

All data mutations are logged to `AuditLog` table:

- Agent CRUD operations
- Workflow CRUD operations
- Network CRUD operations
- Settings changes
- Integration connections
- API key management
- DSR processing
- User management

Log format: `{ action, resource, resourceId, actorId, organizationId, before, after, timestamp, ipAddress }`

## Evidence Artifacts

| Artifact                     | Location                                     | Type     |
| ---------------------------- | -------------------------------------------- | -------- |
| Architecture documentation   | CLAUDE.md                                    | Document |
| Security headers config      | next-config headers                          | Code     |
| Rate limiting implementation | rate-limit.ts, rate-limit-policy.ts          | Code     |
| Auth middleware              | api-auth.ts, proxy.ts                        | Code     |
| Encryption implementation    | crypto/index.ts                              | Code     |
| CI/CD pipeline               | .github/workflows/                           | Code     |
| Incident response runbook    | docs/operations/INCIDENT-RESPONSE-RUNBOOK.md | Document |
| DR runbook                   | docs/operations/DR-RUNBOOK.md                | Document |
| Data residency controls      | docs/compliance/DATA-RESIDENCY.md            | Document |
| SLA targets                  | docs/operations/SLA-TARGETS.md               | Document |
| Privacy policy               | Published on website                         | Document |
| Consent management           | ConsentRecord model + API                    | Code     |
| DSR tracking                 | DataSubjectRequest model + API               | Code     |

## Pre-Audit Checklist

- [ ] All "Pending" controls above are addressed
- [ ] Employee security training completed
- [ ] Cyber liability insurance procured
- [ ] Vulnerability scan completed (no critical/high findings)
- [ ] Penetration test completed (all critical/high remediated)
- [ ] All audit log gaps closed
- [ ] Evidence artifacts collected and organized
- [ ] Management assertion letter drafted
