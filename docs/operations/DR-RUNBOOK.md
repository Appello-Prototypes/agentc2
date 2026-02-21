# Disaster Recovery Runbook

## Recovery Objectives

| Metric  | Target       | Description              |
| ------- | ------------ | ------------------------ |
| **RTO** | < 1 hour     | Time to restore service  |
| **RPO** | < 15 minutes | Maximum data loss window |

## Scenario 1: Single Droplet Failure

**Detection:** Health check failure on one production Droplet (Betterstack alert)

**Impact:** Partial capacity. Load balancer routes traffic to healthy Droplet.

**Response:**

1. Verify load balancer has removed unhealthy Droplet
2. Check PM2 status on affected Droplet: `ssh prod-1 'pm2 status'`
3. Attempt restart: `ssh prod-1 'pm2 restart all'`
4. If Droplet is unresponsive, provision replacement:
    ```bash
    cd infrastructure/terraform
    terraform apply -target=digitalocean_droplet.production
    ```
5. Deploy latest code to new Droplet
6. Add to load balancer
7. Verify health checks pass

**Estimated Time:** 15-30 minutes

## Scenario 2: Complete Infrastructure Failure

**Detection:** All health checks failing, DNS not resolving

**Impact:** Total outage

**Response:**

1. Triage: Determine root cause (provider outage, DNS, security incident)
2. If DigitalOcean outage:
    - Check https://status.digitalocean.com
    - If extended outage, spin up in backup region:
        ```bash
        cd infrastructure/terraform
        terraform workspace new dr-recovery
        terraform apply -var="region=sfo3"
        ```
3. Restore database from Supabase PITR:
    - Go to Supabase Dashboard > Database > Backups
    - Select point-in-time to restore to
    - Execute restoration
4. Deploy application code
5. Update DNS records (via Cloudflare)
6. Verify all health checks pass
7. Gradually shift traffic back

**Estimated Time:** 45-60 minutes

## Scenario 3: Database Corruption / Data Loss

**Detection:** Application errors referencing database, Sentry alerts

**Impact:** Data integrity issues, potential partial outage

**Response:**

1. Immediately set application to read-only mode (if read replica available)
2. Assess scope of corruption
3. Restore from Supabase PITR:
    - Identify last known good timestamp
    - Restore to that point in time
4. Validate data integrity:
    ```sql
    SELECT count(*) FROM agent;
    SELECT count(*) FROM agent_run;
    SELECT count(*) FROM "user";
    ```
5. Re-enable write operations
6. Post-incident: identify root cause and add safeguards

**Estimated Time:** 30-45 minutes

## Scenario 4: Security Incident

**Detection:** Sentry alert, suspicious audit log entries, rate limiting spike

**Impact:** Varies — potential data exposure

**Response:**

1. **Contain:** Rotate all compromised credentials immediately
2. **Investigate:** Review audit logs, access logs, Sentry events
3. **Remediate:** Patch vulnerability, deploy fix
4. **Notify:** If data breach, follow incident response procedures:
    - Internal notification within 1 hour
    - Customer notification within 72 hours (GDPR requirement)
    - Regulatory notification as required
5. **Post-incident review:** Within 5 business days

## Backup Verification Schedule

| Type                   | Frequency | Method                                     |
| ---------------------- | --------- | ------------------------------------------ |
| Database PITR test     | Monthly   | Restore to staging, verify data            |
| Full DR drill          | Quarterly | Simulate failure, time recovery            |
| Backup integrity check | Weekly    | Automated: verify backup size and checksum |
| Terraform plan         | Weekly    | `terraform plan` to detect drift           |

## Contact List

| Role             | Responsibility         | Escalation Time |
| ---------------- | ---------------------- | --------------- |
| On-call Engineer | Initial response       | Immediate       |
| Platform Lead    | Incident commander     | 15 minutes      |
| Security Lead    | Security incidents     | 15 minutes      |
| CEO/CTO          | Customer communication | 30 minutes      |

## Post-Incident Review Template

1. **Incident Summary:** One-line description
2. **Timeline:** Minute-by-minute from detection to resolution
3. **Root Cause:** What failed and why
4. **Impact:** Users affected, duration, data lost (if any)
5. **What Went Well:** Response actions that worked
6. **What Needs Improvement:** Gaps in monitoring, playbooks, tooling
7. **Action Items:** Specific tasks with owners and deadlines
