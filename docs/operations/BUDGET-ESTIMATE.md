# AgentC2 — Production Readiness Budget Estimate

Defined as part of the Production Readiness Plan (Phase 0).

---

## Recurring Monthly Costs (New)

| Service                        | Purpose                                           | Monthly Cost | Phase Required |
| ------------------------------ | ------------------------------------------------- | ------------ | -------------- |
| Sentry (Team)                  | Error tracking, performance monitoring            | $26          | Phase 2        |
| Upstash Redis                  | Rate limiting, state management, circuit breakers | $10–50       | Phase 3        |
| Grafana Cloud (free) / Logtail | Log aggregation, dashboards                       | $0–50        | Phase 2        |
| Cloudflare (free/pro)          | CDN, DDoS protection, DNS                         | $0–20        | Phase 8        |
| Betterstack                    | Public status page, uptime monitoring             | $20          | Phase 2        |
| Staging Droplet (DO)           | 16GB RAM / 4 vCPU staging environment             | $96          | Phase 0        |
| k6 Cloud (optional)            | Load testing (can self-host for free)             | $0–100       | Phase 9        |
| Doppler                        | Secrets management                                | ~$18/user    | Phase 8        |
| PostHog (free tier)            | Privacy-first product analytics                   | $0           | Phase 6        |

**Estimated monthly total: $200–400**

## One-Time Costs

| Service                               | Purpose                                | Estimated Cost | Phase Required |
| ------------------------------------- | -------------------------------------- | -------------- | -------------- |
| Penetration testing (external firm)   | Full application security audit        | $5,000–20,000  | Phase 10       |
| SOC 2 Type I audit (external auditor) | Compliance certification               | $15,000–50,000 | Phase 10       |
| External accessibility audit          | WCAG 2.1 AA compliance verification    | $3,000–10,000  | Phase 10       |
| Legal counsel (GDPR/CCPA review)      | Privacy policy, data processing review | $5,000–15,000  | Phase 5        |

**Estimated one-time total: $28,000–95,000**

## Budget Approval Milestones

| Milestone                     | Needed By      | Amount                   |
| ----------------------------- | -------------- | ------------------------ |
| Staging + monitoring services | Phase 0 start  | ~$200/mo recurring       |
| Legal counsel engagement      | Phase 5 start  | ~$5,000–15,000 one-time  |
| External audit engagements    | Phase 10 start | ~$23,000–80,000 one-time |

## Existing Costs (No Change)

| Service                           | Purpose               | Status          |
| --------------------------------- | --------------------- | --------------- |
| DigitalOcean Droplet (32GB/8vCPU) | Production server     | Already running |
| Supabase (Pro)                    | PostgreSQL database   | Already running |
| GitHub (Team)                     | Source control, CI/CD | Already running |
| OpenAI / Anthropic                | AI model providers    | Already running |
| ElevenLabs                        | Voice capabilities    | Already running |
| Turbo Remote Cache (Vercel)       | Build caching         | Already running |

---

_Last updated: 2026-02-21_
_Owner: Engineering / Finance_
_Status: PENDING APPROVAL_
