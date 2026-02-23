# AgentC2 — External Vendor Setup Guide

**For:** Human operator responsible for creating accounts and configuring external services
**Time estimate:** 2-4 hours for all services
**Prerequisites:** Company credit card, admin access to DNS (for agentc2.ai domain)

---

## Overview

This guide lists every external vendor the platform depends on. Each section tells you:

1. **What it is** — one sentence
2. **Why we need it** — what breaks without it
3. **How to set it up** — step-by-step
4. **What to hand back** — the env vars / keys needed
5. **Monthly cost**

Once all vendors are configured, add the resulting environment variables to your `.env` file (development) and to Doppler (staging/production).

---

## Priority Order

Set these up in order — later items may depend on earlier ones.

| #   | Vendor                                     | Priority                            | Monthly Cost |
| --- | ------------------------------------------ | ----------------------------------- | ------------ |
| 1   | Supabase (PostgreSQL)                      | **Required** — already configured   | ~$25         |
| 2   | Upstash Redis                              | **Required** for production         | ~$10-50      |
| 3   | Sentry                                     | **Required** for production         | ~$26         |
| 4   | Cloudflare                                 | **Required** for production         | Free-$20     |
| 5   | Betterstack                                | **Recommended**                     | ~$20         |
| 6   | Doppler                                    | **Recommended** for team/production | ~$18/user    |
| 7   | Inngest                                    | **Required** — already configured   | Free-$50     |
| 8   | Log Aggregation (Logtail or Grafana Cloud) | **Recommended**                     | Free-$50     |
| 9   | PostHog                                    | **Optional** — analytics            | Free-$0      |
| 10  | DigitalOcean (Terraform)                   | **Required** — already configured   | ~$288        |

---

## 1. Supabase (PostgreSQL Database)

**What:** Managed PostgreSQL with connection pooling, PITR backups, and dashboard.
**Status:** Already configured. DATABASE_URL exists in .env.

### Verify / Harden

1. Go to [app.supabase.com](https://app.supabase.com) → your project
2. **Settings → Database → SSL Enforcement**: Enable "Enforce SSL on incoming connections"
3. **Settings → Database → Network Restrictions**: Add your DigitalOcean Droplet IPs AND your local dev IP so only your servers can connect. Use the direct connection on port 5432 — AgentC2 is a persistent server, not serverless, so the transaction-mode pooler (port 6543) is not needed and should not be used.
4. **Backups → Point-in-Time Recovery**: Confirm PITR is enabled (requires Pro plan, $25/mo)

### Env Vars (already set)

```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Cost:** ~$25/mo (Pro plan)

---

## 2. Upstash Redis

**What:** Serverless Redis with REST API. Used for rate limiting, circuit breakers, and distributed session state.
**Why:** Without Redis, rate limiting falls back to in-memory (not distributed across PM2 cluster instances). Production requires Redis.

### Setup Steps

1. Go to [console.upstash.com](https://console.upstash.com) and create an account
2. Click **Create Database**
    - Name: `agentc2-production`
    - Region: **US-East-1** (closest to your DigitalOcean NYC3 Droplets)
    - Type: **Regional** (or Global if you need multi-region later)
    - Eviction: **Enabled** (evicts least-recently-used keys when at memory limit)
    - TLS: **Enabled** (default)
3. Once created, go to the database details page
4. Copy the **REST API** credentials (not the Redis protocol ones):
    - `UPSTASH_REDIS_REST_URL` — looks like `https://us1-xxxxx.upstash.io`
    - `UPSTASH_REDIS_REST_TOKEN` — a long JWT-like string

### Env Vars to Add

```
UPSTASH_REDIS_REST_URL="https://us1-xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxxxxxxxxxxxx..."
```

### Verify

After adding env vars, restart the agent app and check logs for:

```
Redis health check: OK
```

**Cost:** Free tier = 10,000 commands/day. Pay-as-you-go starts at ~$0.20/100K commands. Typical: $10-50/mo.

---

## 3. Sentry (Error Tracking)

**What:** Real-time error tracking with stack traces, breadcrumbs, and alerting.
**Why:** Without Sentry, unhandled errors in production are invisible. You rely on users reporting bugs instead of detecting them proactively.

### Setup Steps

1. Go to [sentry.io](https://sentry.io) and create an account (or use SSO)
2. Create an **Organization**: `agentc2`
3. Create **two Projects**:
    - Project 1: **agentc2-agent** (Platform: Next.js)
    - Project 2: **agentc2-frontend** (Platform: Next.js)
4. For each project, Sentry will show you a DSN. Copy both:
    - Agent DSN: `https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY`
    - Frontend DSN: `https://zzzzz@oXXXXX.ingest.sentry.io/ZZZZZZZ`
5. Go to **Settings → Auth Tokens** and create an Org-level auth token:
    - Scopes: `project:releases`, `org:read`
    - Copy the token (starts with `sntrys_...`)
6. **Configure Alerts** (Settings → Alerts):
    - Create a rule: "Alert on first occurrence of new issue" → Slack or email
    - Create a rule: "Alert when error frequency > 10 in 5 minutes" → page on-call

### Env Vars to Add

```
# Agent app (.env or per-app in Doppler)
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY"
SENTRY_ORG="agentc2"
SENTRY_PROJECT="agentc2-agent"
SENTRY_AUTH_TOKEN="sntrys_..."

# Frontend app (if using a separate DSN)
# Set NEXT_PUBLIC_SENTRY_DSN in apps/frontend/.env.local or in Doppler per-app
```

### Verify

After deploying with these env vars:

1. Visit your Sentry dashboard → Projects → agentc2-agent
2. You should see a "Session Started" event within a few minutes
3. To force-test: add `throw new Error("Sentry test")` to any API route, hit it, then check Sentry

**Cost:** Team plan = $26/mo (includes 50K errors, 100K transactions)

---

## 4. Cloudflare (CDN + DDoS Protection)

**What:** Content delivery network, DDoS protection, WAF, and edge caching.
**Why:** Without Cloudflare, your servers are directly exposed to the internet. No edge caching, no DDoS mitigation, no WAF.

### Setup Steps

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and create an account
2. Click **Add a Site** → enter `agentc2.ai`
3. Select the **Free** plan (or Pro at $20/mo for WAF rules)
4. Cloudflare will scan existing DNS records. Verify they match your current setup:
    - `A` record: `agentc2.ai` → your DigitalOcean Load Balancer IP
    - `CNAME`: `www` → `agentc2.ai`
    - `CNAME`: `status` → Betterstack CNAME (added later)
5. **Change your nameservers** at your domain registrar (e.g., Namecheap, GoDaddy) to the Cloudflare-assigned nameservers. This is the critical step — DNS propagation takes up to 24 hours.
6. Once DNS is active, configure these settings:

**Speed → Optimization:**

- Brotli: **ON**
- Auto Minify: **HTML, CSS, JS all ON**
- Early Hints: **ON**

**SSL/TLS:**

- Mode: **Full (Strict)** (requires valid cert on origin — Caddy handles this)
- Always Use HTTPS: **ON**
- Minimum TLS Version: **1.2**
- HTTP Strict Transport Security (HSTS): **Enable** with `max-age=31536000`, `includeSubDomains`

**Caching:**

- Browser Cache TTL: **4 hours**
- Create a Page Rule for `agentc2.ai/_next/static/*` → Cache Level: Cache Everything, Edge TTL: 1 month

**Security:**

- Security Level: **Medium**
- Bot Fight Mode: **ON**
- Challenge Passage: **30 minutes**

7. Copy your **Zone ID** and **API Token** (for the setup script):
    - Zone ID: found on the Overview page sidebar
    - API Token: My Profile → API Tokens → Create Token → "Edit zone DNS" template

### Env Vars to Add

```
CLOUDFLARE_ZONE_ID="your_zone_id"
CLOUDFLARE_API_TOKEN="your_api_token"
```

### Verify

- Run `curl -I https://agentc2.ai` and look for `cf-ray` header (proves Cloudflare is active)
- Check `server: cloudflare` in response headers

**Cost:** Free plan = $0. Pro plan (with WAF) = $20/mo.

---

## 5. Betterstack (Status Page + Uptime Monitoring)

**What:** Public status page and uptime monitoring with incident management.
**Why:** Customers and stakeholders need a way to check if the platform is up. Critical for enterprise trust and SLA transparency.

### Setup Steps

1. Go to [betterstack.com](https://betterstack.com) and create an account
2. **Set up Monitors** (Uptime → Monitors → Create):

    | Monitor Name    | URL                                         | Check Interval | Type                         |
    | --------------- | ------------------------------------------- | -------------- | ---------------------------- |
    | API Health      | `https://agentc2.ai/agent/api/health`       | 60s            | HTTP 200                     |
    | API Readiness   | `https://agentc2.ai/agent/api/health/ready` | 60s            | HTTP 200                     |
    | Frontend        | `https://agentc2.ai`                        | 60s            | HTTP 200                     |
    | SSL Certificate | `agentc2.ai`                                | Daily          | SSL Expiry (warn at 14 days) |

3. **Create a Status Page** (Status Pages → Create):
    - Name: `AgentC2 Status`
    - Subdomain: `agentc2` (will create `agentc2.betteruptime.com`)
    - Custom domain: `status.agentc2.ai` (add a CNAME record in Cloudflare: `status` → the CNAME Betterstack provides)
    - Add all 4 monitors to the status page
    - Customize branding (logo, colors) to match AgentC2

4. **Set up Alerting** (Integrations):
    - Add a Slack integration → post to `#alerts` channel
    - Add email notifications for all team members
    - Optionally add PagerDuty for SEV1 page escalation

5. Copy the **API Token** (Profile → API Tokens) for the automation script.

### Env Vars to Add

```
BETTERSTACK_API_TOKEN="your_api_token"
```

### DNS Record to Add (in Cloudflare)

```
CNAME  status  →  statuspage.betteruptime.com  (proxied OFF / DNS only)
```

### Verify

- Visit `https://status.agentc2.ai` — should show the status page
- Betterstack dashboard should show green checks for all monitors

**Cost:** ~$20/mo (Starter plan)

---

## 6. Doppler (Secrets Management)

**What:** Centralized secrets manager that replaces .env files in production.
**Why:** Without Doppler, secrets live in a .env file on the server. If the server is compromised, all secrets are exposed. Doppler provides encryption, audit trails, access control, and automatic rotation.

### Setup Steps

1. Go to [doppler.com](https://doppler.com) and create an account
2. Install the CLI:

    ```bash
    # macOS
    brew install dopplerhq/cli/doppler

    # Linux
    curl -sLf https://cli.doppler.com/install.sh | sh
    ```

3. Log in:
    ```bash
    doppler login
    ```
4. Create a project:
    ```bash
    doppler projects create agentc2
    ```
5. You'll get 3 environments automatically: `dev`, `stg`, `prd`
6. **Import your current .env** into the `dev` environment:
    ```bash
    doppler secrets upload --project agentc2 --config dev .env
    ```
7. Do the same for `stg` and `prd` configs (with production values)
8. **Generate a Service Token** for each environment (for CI/CD and server access):
    - Dashboard → Project → Config (e.g., `prd`) → Access → Generate Service Token
    - Name it: `production-server`
    - Copy the token (starts with `dp.st.prd.xxxx`)

### Usage on Server

Instead of sourcing `.env`, the server runs:

```bash
doppler run --token dp.st.prd.xxxx -- pm2 start ecosystem.config.js
```

This injects all secrets as environment variables without writing them to disk.

### For GitHub Actions CI/CD

Add the service token as a GitHub Actions secret:

- Secret name: `DOPPLER_TOKEN`
- Value: your production service token

Then in the workflow:

```yaml
- name: Deploy
  env:
      DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
  run: doppler run -- ./deploy.sh
```

### Verify

```bash
doppler secrets --project agentc2 --config dev | head -5
```

Should list your secrets (names only, values redacted unless you use `--no-mask`).

**Cost:** Free for 1 user. Team plan = $18/user/mo.

---

## 7. Inngest (Background Jobs)

**What:** Event-driven background job processing for learning sessions, scheduled triggers, and async tasks.
**Status:** Already configured.

### Verify / Harden

1. Go to [app.inngest.com](https://app.inngest.com)
2. Confirm your app is registered (Settings → Apps → should show your endpoint)
3. **Production environment**: Go to Manage → Signing Key → copy for `.env`
4. **Set up event forwarding** if using multiple environments (dev events → dev Inngest, prod events → prod Inngest)

### Env Vars (already set)

```
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

**Cost:** Free tier = 5K runs/mo. Pro = $50/mo.

---

## 8. Log Aggregation

**What:** Centralized log storage and search so you can debug production issues without SSH-ing into servers.
**Why:** With PM2 cluster mode running 7+ processes across 2 Droplets, you need a single place to search all logs.

### Option A: Logtail (by Betterstack) — Recommended if using Betterstack

1. Go to [logs.betterstack.com](https://logs.betterstack.com)
2. Create a **Source**: Name = `agentc2-production`, Platform = `Node.js`
3. Copy the **Source Token** (a UUID-like string)
4. Add to env:
    ```
    LOGTAIL_SOURCE_TOKEN="your_source_token"
    ```
5. The `log-transport.ts` in the codebase automatically detects this env var and ships logs via pino transport.

### Option B: Grafana Cloud (Loki) — More powerful querying

1. Go to [grafana.com](https://grafana.com) → Create free account
2. **Connections → Add new connection → Grafana Loki**
3. Copy your Loki push URL: `https://logs-prod-us-central1.grafana.net/loki/api/v1/push`
4. Create an API key: My Account → API Keys → Add
5. Set env vars:
    ```
    LOKI_HOST="https://logs-prod-us-central1.grafana.net"
    LOKI_USERNAME="your_grafana_user_id"
    LOKI_PASSWORD="your_grafana_api_key"
    ```

### Verify

After restarting the agent app with the new env vars:

- Make a few requests to the platform
- Check your log dashboard — you should see structured JSON log entries arriving within seconds

**Cost:** Logtail free = 1GB/mo. Grafana Cloud free = 50GB logs/mo.

---

## 9. PostHog (Product Analytics) — Optional

**What:** Privacy-first product analytics to understand how users interact with the platform.
**Why:** Without analytics, you have no data on feature adoption, user flows, or drop-off points. Useful for product decisions but not required for launch.

### Setup Steps

1. Go to [posthog.com](https://posthog.com) and create an account
2. Create a project: `AgentC2`
3. Copy the **Project API Key** from Settings → Project → API Key
4. Note the **Host**: `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU)
5. Set env vars:
    ```
    NEXT_PUBLIC_POSTHOG_KEY="phc_xxxxxxxxxxxx"
    NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
    ```

### Verify

After deploying, visit the platform and check PostHog dashboard — you should see page view events.

**Cost:** Free tier = 1M events/mo. Usually $0 for early-stage.

---

## 10. DigitalOcean + Terraform

**What:** Cloud compute infrastructure managed as code.
**Status:** Already configured (single Droplet running). Terraform files exist at `infrastructure/terraform/`.

### To Provision Full HA Setup

1. Install Terraform:
    ```bash
    brew install terraform  # macOS
    ```
2. Set DigitalOcean API token:
    ```bash
    export TF_VAR_do_token="dop_v1_xxxxx"
    export TF_VAR_cloudflare_api_token="your_cf_token"
    ```
3. Initialize and plan:
    ```bash
    cd infrastructure/terraform
    terraform init
    terraform plan
    ```
4. Review the plan output carefully (it will show what resources will be created)
5. Apply:
    ```bash
    terraform apply
    ```
6. Terraform will output the Droplet IPs and Load Balancer IP. Update Cloudflare DNS `A` record to point to the Load Balancer IP.

### Verify

```bash
terraform output
# Should show: droplet IPs, load balancer IP, spaces bucket domain
```

**Cost:** 2× 32GB Droplets = ~$192/mo. 1× 16GB staging = ~$96/mo. Load Balancer = ~$12/mo.

---

## Summary: All Environment Variables to Add

After completing all vendor setups above, add these new env vars to your `.env` and to Doppler:

```bash
# === Upstash Redis (Section 2) ===
UPSTASH_REDIS_REST_URL="https://us1-xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxxxxxxxxxxxx..."

# === Sentry (Section 3) ===
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY"
SENTRY_ORG="agentc2"
SENTRY_PROJECT="agentc2-agent"
SENTRY_AUTH_TOKEN="sntrys_..."

# === Cloudflare (Section 4) ===
CLOUDFLARE_ZONE_ID="your_zone_id"
CLOUDFLARE_API_TOKEN="your_api_token"

# === Betterstack (Section 5) ===
BETTERSTACK_API_TOKEN="your_api_token"

# === Log Aggregation (Section 8) ===
# Option A: Logtail
LOGTAIL_SOURCE_TOKEN="your_source_token"
# Option B: Grafana Loki
LOKI_HOST="https://logs-prod-us-central1.grafana.net"
LOKI_USERNAME="your_grafana_user_id"
LOKI_PASSWORD="your_grafana_api_key"

# === PostHog (Section 9, optional) ===
NEXT_PUBLIC_POSTHOG_KEY="phc_xxxxxxxxxxxx"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"

# === Prometheus Metrics Access (already coded) ===
METRICS_ALLOWED_IPS="127.0.0.1,::1,YOUR_MONITORING_SERVER_IP"
```

---

## One-Time Engagements (Not Self-Service)

These require hiring external firms. Start the procurement process early as lead times are 4-8 weeks.

### Penetration Test

- **What:** An external security firm attempts to hack your platform and reports vulnerabilities.
- **When:** Before go-live or before signing enterprise customers.
- **Scope document:** See `docs/security/PEN-TEST-SCOPE.md` — share this with the firm.
- **Budget:** $5,000-20,000 depending on firm and depth.
- **Recommended firms:** Bishop Fox, NCC Group, Cobalt, or Synack.
- **Action:** Send the PEN-TEST-SCOPE.md document to 2-3 firms for quotes.

### SOC 2 Type I Audit

- **What:** An audit firm verifies your security controls are designed properly.
- **When:** Before enterprise sales (most enterprise buyers require SOC 2).
- **Evidence matrix:** See `docs/compliance/SOC2-EVIDENCE.md` — this maps controls to artifacts.
- **Budget:** $15,000-50,000 depending on auditor and readiness.
- **Recommended firms:** Vanta + auditor (Vanta automates evidence collection), Drata, Tugboat Logic.
- **Action:** Sign up for Vanta ($15K/year), which automates 80% of evidence collection and connects you to pre-vetted auditors.

### Accessibility Audit (WCAG 2.1 AA)

- **What:** An accessibility specialist tests your UI with screen readers, keyboard navigation, and assistive technologies.
- **When:** Before go-live (legal requirement in many jurisdictions, and good practice).
- **Prep document:** See `docs/compliance/A11Y-AUDIT-PREP.md`.
- **Budget:** $3,000-10,000.
- **Recommended firms:** Deque (makers of axe-core), Level Access, WebAIM.
- **Action:** Contact Deque for a quote — they built the axe-core library we already integrate.

### Legal Review (GDPR/CCPA)

- **What:** A privacy attorney reviews your data processing agreements, privacy policy, and compliance implementation.
- **When:** Before processing EU/CA user data in production.
- **Budget:** $5,000-15,000.
- **Action:** Engage a tech-focused privacy firm. Share the `docs/compliance/` folder as starting material.

---

## Post-Setup Verification Checklist

After all vendors are configured, verify the full stack:

- [ ] `bun run build` succeeds locally with all new env vars
- [ ] `curl https://agentc2.ai/agent/api/health` returns `{ "status": "ok" }`
- [ ] `curl https://agentc2.ai/agent/api/health/ready` returns healthy subsystem statuses
- [ ] Sentry dashboard shows events from both agent and frontend apps
- [ ] Betterstack status page at `status.agentc2.ai` shows all green
- [ ] Upstash Redis dashboard shows incoming commands
- [ ] Log aggregation dashboard shows structured JSON logs
- [ ] `curl -I https://agentc2.ai` returns `cf-ray` header (Cloudflare active)
- [ ] `doppler secrets --project agentc2 --config prd` lists all production secrets
- [ ] Inngest dashboard shows registered functions and recent events
- [ ] Load test: `k6 run tests/load/baseline.js` passes all thresholds
