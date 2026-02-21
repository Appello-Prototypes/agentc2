# Go-Live Readiness Checklist

## Pre-Launch Verification

### Infrastructure

- [ ] 2+ production Droplets provisioned and healthy
- [ ] Load balancer configured with health checks
- [ ] Staging environment operational (staging.agentc2.ai)
- [ ] Cloudflare CDN configured and proxying
- [ ] DNS records correct (A records, CNAME for status page)
- [ ] TLS certificates valid and auto-renewing (Caddy)
- [ ] Firewall rules applied (SSH, HTTP, HTTPS only)
- [ ] PM2 cluster mode enabled (agent x4, frontend x2)
- [ ] Terraform state stored remotely (DO Spaces)

### Security

- [ ] Penetration test completed — all critical/high findings remediated
- [ ] All API routes have authentication (or documented as intentionally public)
- [ ] Rate limiting active on all endpoints
- [ ] Redis required in production (no in-memory fallback)
- [ ] CSRF protection enabled
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options, Permissions-Policy)
- [ ] Webhook signature verification on all ingress points
- [ ] Secret scanning in CI pipeline
- [ ] Secrets managed via Doppler (no .env on server)
- [ ] SSH keys rotated and audited

### Observability

- [ ] Sentry configured for both apps (agent + frontend)
- [ ] Prometheus metrics exposed at /api/metrics
- [ ] Structured logging (pino JSON) shipping to aggregator
- [ ] Health check endpoints operational (/api/health, /api/health/ready, /api/health/detailed)
- [ ] Status page live at status.agentc2.ai
- [ ] Alerting configured (SEV1 → page, SEV2 → Slack, SEV3 → digest)
- [ ] On-call rotation established

### Database

- [ ] PgBouncer connection pooling enabled
- [ ] Point-in-Time Recovery (PITR) verified on Supabase
- [ ] Database indexes applied (schema.prisma verified)
- [ ] Slow query monitoring enabled (pg_stat_statements)
- [ ] Backup restoration tested (restore to staging, verify)

### Compliance

- [ ] GDPR erasure endpoint functional (DELETE /api/users/me)
- [ ] GDPR data export functional (GET /api/users/me/export)
- [ ] Consent management system operational
- [ ] DSR tracking system operational
- [ ] Privacy policy published and reviewed by counsel
- [ ] Terms of service published and reviewed by counsel
- [ ] Cookie consent banner on public pages
- [ ] "Do Not Sell" link in footer (CCPA)
- [ ] Data residency documentation complete (TIA, sub-processor registry)
- [ ] AI content watermarking (X-AI-Generated header)
- [ ] SOC 2 Type I report obtained (or readiness assessment complete)

### Performance

- [ ] Baseline load test passed (k6 baseline.js)
- [ ] Spike test passed (k6 spike.js)
- [ ] Stress test identified breaking point — within acceptable range
- [ ] 24-hour soak test passed — no memory leaks, latency degradation
- [ ] SLA targets met (P50 < 200ms, P95 < 1s, P99 < 3s)

### Frontend

- [ ] Error boundaries on all major routes
- [ ] Loading skeletons on all major routes
- [ ] Empty states on all list/table views
- [ ] WCAG 2.1 AA accessibility audit passed (or findings documented)
- [ ] i18n framework operational (next-intl)
- [ ] English locale file complete
- [ ] RTL support functional (Arabic locale)

### API

- [ ] OpenAPI documentation published at /api/docs
- [ ] API versioning strategy implemented (/api/v1/)
- [ ] Rate limit headers returned (X-RateLimit-Remaining, Retry-After)

### Disaster Recovery

- [ ] DR runbook documented and reviewed
- [ ] DR drill completed (simulated failure → recovery < RTO)
- [ ] Backup restoration tested within RPO window
- [ ] Terraform IaC can recreate full infrastructure

### Deployment

- [ ] CI pipeline blocks on: type errors, lint errors, test failures
- [ ] Staging deployment verified (develop → staging.agentc2.ai)
- [ ] Production deployment uses `pm2 reload` (zero-downtime)
- [ ] Rollback procedure documented and tested
- [ ] Feature flags configured for gradual rollout

## Launch Day Procedure

1. **T-24h:** Final staging verification, all checklists green
2. **T-4h:** Team standup, confirm go/no-go
3. **T-1h:** Lower alert thresholds for heightened monitoring
4. **T-0:** Deploy to production via `git push origin main`
5. **T+15m:** Verify health checks, run smoke tests
6. **T+1h:** Monitor error rates, latency, user reports
7. **T+4h:** First checkpoint — review metrics dashboard
8. **T+24h:** All-clear or escalation decision

## Rollback Triggers

Initiate rollback if ANY of the following occur within 4 hours of launch:

- Error rate > 2% sustained for 10 minutes
- P95 latency > 5s sustained for 10 minutes
- Health checks failing on any production instance
- Data integrity issues reported
- Security vulnerability discovered

## Rollback Procedure

```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Or use feature flags to disable new functionality
# (preferred — faster, no deployment needed)

# 3. If database migration involved:
# Run rollback migration script
# Verify data integrity
```
