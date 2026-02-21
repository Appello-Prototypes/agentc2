# AgentC2 — Incident Response Runbook

## Severity Classification

| Severity | Criteria                                                  | Response Time | Resolution Target |
| -------- | --------------------------------------------------------- | ------------- | ----------------- |
| SEV1     | Service fully down, data breach, security incident        | < 15 min      | < 30 min          |
| SEV2     | Degraded performance, partial outage, non-critical errors | < 1 hour      | < 4 hours         |
| SEV3     | Minor issues, isolated errors, cosmetic problems          | < 4 hours     | Next business day |

## SEV1 Response Procedure

1. **Acknowledge** — Respond in Slack `#alerts-critical` within 15 minutes
2. **Assess** — Determine scope: full outage, partial, data breach
3. **Contain** — If security incident, disable affected endpoints/API keys immediately
4. **Communicate** — Update status page, notify affected customers
5. **Resolve** — Apply fix, verify health checks pass
6. **Recover** — Monitor for 30 minutes post-fix
7. **Post-mortem** — Schedule within 48 hours

## SEV2 Response Procedure

1. **Acknowledge** — Respond in Slack `#alerts` within 1 hour
2. **Investigate** — Check logs, metrics, health endpoints
3. **Fix** — Apply hotfix or rollback
4. **Verify** — Confirm resolution via monitoring
5. **Document** — Update incident log

## Common Scenarios

### Application Down (PM2 process crash-looping)

```bash
ssh root@$DO_HOST
pm2 status
pm2 logs agent --lines 100
pm2 restart agent
# If persistent, rollback:
cd /var/www/agentc2
git log --oneline -5
git reset --hard HEAD~1
bun install && bun run db:generate
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
pm2 restart ecosystem.config.js --update-env
```

### Database Connection Exhausted

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
# Kill idle connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"
```

### High Error Rate

1. Check Sentry for error grouping
2. Check `/api/health/ready` for subsystem status
3. Check PM2 logs: `pm2 logs --lines 200`
4. Check circuit breaker states: `GET /api/health/detailed`

### Database Restore

```bash
# Supabase PITR - use Supabase dashboard
# Navigate: Project > Database > Backups > Point-in-Time Recovery
# Select timestamp, restore to new project or same project
```

## Contact List

| Role             | Contact | Escalation             |
| ---------------- | ------- | ---------------------- |
| On-call Engineer | TBD     | First responder        |
| Engineering Lead | TBD     | SEV1 escalation        |
| Security Lead    | TBD     | Data breach            |
| CEO              | TBD     | External communication |

## Post-Incident Review Template

1. **Timeline** — Minute-by-minute account
2. **Root Cause** — What failed and why
3. **Impact** — Users affected, duration, data impact
4. **Resolution** — What fixed it
5. **Action Items** — Preventive measures with owners and deadlines

---

_Last updated: 2026-02-21_
_Owner: Engineering_
_Review cycle: Quarterly_
